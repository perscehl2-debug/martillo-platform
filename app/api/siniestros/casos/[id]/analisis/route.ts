import { analizarCaso } from '@/lib/siniestros/analisis'
import { resumirChecklist } from '@/lib/siniestros/checklist'
import { hoyIso } from '@/lib/siniestros/fechas'
import { analizarCasoIA, ErrorIA } from '@/lib/siniestros/ia/claude'
import { clienteServicio, ErrorHttp, reglasDelCaso, requerirSesion, respuestaError, type CasoDb } from '@/lib/siniestros/servidor'
import { valorUfA } from '@/lib/siniestros/uf'
import type { ExtraccionDocumento, Persona } from '@/lib/siniestros/tipos'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Auto-análisis del caso: validaciones cruzadas + cálculo art. 26 (código
 * determinístico) + resumen y observaciones de Claude. Queda como PROPUESTA
 * hasta que el liquidador la marque revisada.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, usuario } = await requerirSesion(['liquidador', 'supervisor'])
    const { con_ia = true } = await req.json().catch(() => ({}))

    const { data: caso } = await supabase.from('casos_siniestro').select('*').eq('id', params.id).maybeSingle<CasoDb>()
    if (!caso) throw new ErrorHttp(404, 'Caso no encontrado')
    const reglas = await reglasDelCaso(supabase, caso)

    const [{ data: personas }, { data: docs }, { data: coberturas }, { data: requisitos }] = await Promise.all([
      supabase.from('personas').select('*').eq('caso_id', caso.id),
      supabase
        .from('documentos')
        .select('id, tipo, nombre_archivo, extracciones(json_datos, estado, created_at)')
        .eq('caso_id', caso.id),
      supabase.from('coberturas_caso').select('cobertura, grado_incapacidad').eq('caso_id', caso.id),
      supabase.from('requisitos_caso').select('nombre, obligatorio, estado').eq('caso_id', caso.id),
    ])

    const documentos = (docs ?? []).flatMap(d => {
      const ultima = (d.extracciones as { json_datos: ExtraccionDocumento | null; estado: string; created_at: string }[])
        .filter(x => x.estado === 'ok' && x.json_datos)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      return ultima ? [{ documento_id: d.tipo, nombre_archivo: d.nombre_archivo, extraccion: ultima.json_datos as ExtraccionDocumento }] : []
    })

    // Casos vinculados: se cuentan con el backend porque el liquidador no ve casos ajenos.
    const admin = clienteServicio()
    let casosVinculados = 0
    if (caso.patente) {
      const { count } = await admin.from('casos_siniestro').select('id', { count: 'exact', head: true }).eq('patente', caso.patente).neq('id', caso.id)
      casosVinculados += count ?? 0
    }
    const victima = (personas ?? []).find(p => p.rol === 'victima')
    if (victima?.rut) {
      const { count } = await admin.from('personas').select('id', { count: 'exact', head: true }).eq('rut', victima.rut).eq('rol', 'victima').neq('caso_id', caso.id)
      casosVinculados += count ?? 0
    }

    const valorUf = await valorUfA(supabase, hoyIso(), { admin }).catch(async () => {
      // Fines de semana/feriados: último valor disponible localmente.
      const { data } = await supabase.from('valores_uf').select('fecha, valor').order('fecha', { ascending: false }).limit(1).maybeSingle()
      if (!data) throw new ErrorHttp(503, 'No hay valor UF disponible; sincronice /api/siniestros/uf')
      return { fecha: data.fecha as string, valor: Number(data.valor) }
    })

    const resultado = analizarCaso({
      reglas,
      caso,
      personas: (personas ?? []) as Persona[],
      documentos,
      grados: Object.fromEntries((coberturas ?? []).map(c => [c.cobertura, c.grado_incapacidad === null ? null : Number(c.grado_incapacidad)])),
      valor_uf: valorUf,
      casos_vinculados: casosVinculados,
    })

    let ia: Awaited<ReturnType<typeof analizarCasoIA>> | null = null
    let errorIa: string | null = null
    if (con_ia && process.env.ANTHROPIC_API_KEY) {
      try {
        ia = await analizarCasoIA({
          producto: reglas.producto,
          regimen: resultado.regimen,
          caso: {
            coberturas: caso.coberturas,
            fecha_accidente: caso.fecha_accidente,
            fecha_fallecimiento: caso.fecha_fallecimiento,
            fecha_denuncio: caso.fecha_denuncio,
            lugar_accidente: caso.lugar_accidente,
            relato: caso.relato,
            tipo_liquidacion: caso.tipo_liquidacion,
          },
          // Minimización: roles y parentescos, sin RUT ni datos de contacto.
          personas: (personas ?? []).map(p => ({ rol: p.rol, nombre: p.nombre, parentesco: p.parentesco })),
          checklist: resumirChecklist(requisitos ?? []),
          datos_extraidos: documentos.map(d => ({ documento: d.documento_id, campos: Object.fromEntries(Object.entries(d.extraccion.campos).filter(([k]) => !k.startsWith('rut')).map(([k, v]) => [k, v.valor])), comprobantes: d.extraccion.comprobantes?.length, posible_alteracion: d.extraccion.posible_alteracion })),
          validaciones: resultado.validacion,
          calculo_sistema: resultado.calculo.map(c => ({ cobertura: c.cobertura, procede: c.procede, monto_uf: c.monto_uf, pasos: c.pasos, advertencias: c.advertencias })),
          beneficiarios: resultado.beneficiarios && { clase: resultado.beneficiarios.nombre_clase, personas: resultado.beneficiarios.beneficiarios.map(b => b.nombre), advertencias: resultado.beneficiarios.advertencias },
          valor_uf: valorUf,
        })
      } catch (e) {
        errorIa = e instanceof ErrorIA || e instanceof Error ? e.message : 'Error en análisis IA'
      }
    }

    const { data: analisis, error } = await supabase
      .from('analisis_caso')
      .insert({
        caso_id: caso.id,
        json_validaciones: resultado.validacion.validaciones,
        json_inconsistencias: resultado.validacion.inconsistencias,
        json_banderas_rojas: resultado.validacion.banderas_rojas,
        json_exclusiones: resultado.validacion.indicios_exclusion,
        json_calculo: { resultados: resultado.calculo, beneficiarios: resultado.beneficiarios, total_uf: resultado.total_uf, total_clp: resultado.total_clp },
        json_ia: ia ? ia.analisis : errorIa ? { error: errorIa } : null,
        resumen: ia?.analisis.resumen_ejecutivo ?? null,
        recomendacion_uf: resultado.total_uf,
        valor_uf_referencia: valorUf.valor,
        fecha_valor_uf: valorUf.fecha,
        modelo: ia?.modelo ?? null,
        created_por: usuario.id,
      })
      .select('id')
      .single()
    if (error) throw error

    const ahora = new Date().toISOString()
    await Promise.all(
      resultado.calculo.map(c =>
        supabase
          .from('coberturas_caso')
          .update({
            estado: c.procede ? 'propuesta' : 'rechazada',
            monto_uf_propuesto: c.monto_uf,
            valor_uf_referencia: valorUf.valor,
            fecha_valor_uf: valorUf.fecha,
            fecha_calculo: ahora,
            json_calculo: c,
          })
          .eq('caso_id', caso.id)
          .eq('cobertura', c.cobertura),
      ),
    )
    if (caso.estado === 'recepcion') {
      await supabase.from('casos_siniestro').update({ estado: 'en_analisis' }).eq('id', caso.id)
    }

    return Response.json({ id: analisis.id, ...resultado, ia: ia?.analisis ?? null, error_ia: errorIa })
  } catch (e) {
    return respuestaError(e)
  }
}

/** El liquidador marca el análisis como revisado (human-in-the-loop). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, usuario } = await requerirSesion(['liquidador', 'supervisor'])
    const { analisis_id } = await req.json()
    const { data, error } = await supabase
      .from('analisis_caso')
      .update({ estado: 'revisado', revisado_por: usuario.id, revisado_at: new Date().toISOString() })
      .eq('id', analisis_id)
      .eq('caso_id', params.id)
      .select('id')
    if (error) throw error
    if (!data?.length) throw new ErrorHttp(404, 'Análisis no encontrado')
    return Response.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
