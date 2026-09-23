import { z } from 'zod'
import { hoyIso } from '@/lib/siniestros/fechas'
import { generarPdfInforme, type ContenidoInforme } from '@/lib/siniestros/pdf/informe'
import {
  clienteServicio, ErrorHttp, reglasDelCaso, requerirSesion, respuestaError, sha256Hex, sincronizarPlazos, type CasoDb,
} from '@/lib/siniestros/servidor'

export const runtime = 'nodejs'

const esquema = z.object({
  accion: z.enum(['aprobar', 'devolver']),
  observacion: z.string().max(2000).nullish(),
})

const ESTADO_CASO = { preinforme: 'preinforme', informe_liquidacion: 'informe_emitido', finiquito: 'finiquito' } as const

/**
 * Aprobación del supervisor (cuatro ojos: la BD impide que el redactor apruebe
 * su propio informe). Al aprobar se genera el PDF definitivo, se guarda con su
 * hash y el informe queda emitido e inmutable.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, usuario } = await requerirSesion(['supervisor'])
    const { accion, observacion } = esquema.parse(await req.json())
    const { data: informe } = await supabase.from('informes').select('*').eq('id', params.id).maybeSingle()
    if (!informe) throw new ErrorHttp(404, 'Informe no encontrado')
    if (informe.estado !== 'pendiente_aprobacion') throw new ErrorHttp(409, `El informe está ${informe.estado}`)

    if (accion === 'devolver') {
      const contenido = { ...(informe.json_contenido as ContenidoInforme), observacion_supervisor: observacion ?? null }
      const { error } = await supabase.from('informes').update({ estado: 'anulado', json_contenido: contenido }).eq('id', informe.id)
      if (error) throw new ErrorHttp(403, error.message)
      return Response.json({ ok: true, estado: 'anulado' })
    }

    const ahora = new Date().toISOString()
    const aprobado = await supabase
      .from('informes')
      .update({ estado: 'aprobado', aprobado_por: usuario.id, aprobado_at: ahora })
      .eq('id', informe.id)
    if (aprobado.error) throw new ErrorHttp(403, aprobado.error.message)

    const contenido: ContenidoInforme = {
      ...(informe.json_contenido as ContenidoInforme),
      aprobado_por: { id: usuario.id, nombre: usuario.nombre, fecha: ahora },
      generado_at: ahora,
    }
    const pdf = await generarPdfInforme(contenido)
    const hash = await sha256Hex(pdf)
    const ruta = `${informe.caso_id}/informes/${informe.tipo}-${informe.id}.pdf`
    const subida = await clienteServicio().storage.from('siniestros-documentos').upload(ruta, pdf, { contentType: 'application/pdf', upsert: false })
    if (subida.error) throw subida.error

    const emitido = await supabase
      .from('informes')
      .update({ estado: 'emitido', json_contenido: contenido, pdf_path: ruta, pdf_hash_sha256: hash, emitido_por: usuario.id, emitido_at: ahora })
      .eq('id', informe.id)
    if (emitido.error) throw emitido.error

    const cambiosCaso: Record<string, unknown> = { estado: ESTADO_CASO[informe.tipo as keyof typeof ESTADO_CASO] }
    if (informe.tipo === 'informe_liquidacion') cambiosCaso.fecha_informe_liquidacion = hoyIso()
    const { data: caso, error: errCaso } = await supabase.from('casos_siniestro').update(cambiosCaso).eq('id', informe.caso_id).select('*').single<CasoDb>()
    if (errCaso) throw errCaso

    if (informe.tipo === 'finiquito') {
      await Promise.all(
        contenido.coberturas.map(c =>
          supabase
            .from('coberturas_caso')
            .update({ estado: c.procede ? 'aprobada' : 'rechazada', monto_uf_aprobado: c.monto_uf_aprobado, aprobado_por: usuario.id, aprobado_at: ahora })
            .eq('caso_id', informe.caso_id)
            .eq('cobertura', c.cobertura),
        ),
      )
    }
    await sincronizarPlazos(supabase, caso, await reglasDelCaso(supabase, caso))
    return Response.json({ ok: true, estado: 'emitido', pdf_hash_sha256: hash })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Datos inválidos', detalle: e.issues }, { status: 400 })
    return respuestaError(e)
  }
}
