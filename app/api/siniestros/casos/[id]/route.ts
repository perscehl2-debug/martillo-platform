import { z } from 'zod'
import { normalizarPatente } from '@/lib/siniestros/patente'
import { ErrorHttp, reglasDelCaso, requerirSesion, respuestaError, sincronizarPlazos, type CasoDb } from '@/lib/siniestros/servidor'

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()

const esquema = z.object({
  estado: z.enum(['recepcion', 'en_analisis', 'preinforme', 'informe_emitido', 'impugnado', 'finiquito', 'pagado', 'rechazado', 'cerrado']),
  fecha_aviso: fecha,
  fecha_fallecimiento: fecha,
  lugar_accidente: z.string().nullable(),
  relato: z.string().nullable(),
  patente: z.string().nullable(),
  poliza_numero: z.string().nullable(),
  poliza_vigencia_desde: fecha,
  poliza_vigencia_hasta: fecha,
  tipo_liquidacion: z.enum(['directa', 'registrada']),
  fecha_comunicacion_tipo_liquidacion: fecha,
  prorroga_liquidacion: z.boolean(),
  prorroga_fundamento: z.string().nullable(),
  fecha_antecedentes_completos: fecha,
  fecha_certificado_incapacidad: fecha,
  fecha_impugnacion: fecha,
  fecha_pago: fecha,
  exclusion_confirmada: z.string().nullable(),
  liquidador_id: z.string().uuid().nullable(),
  supervisor_id: z.string().uuid().nullable(),
}).partial()

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requerirSesion()
    const cambios = esquema.parse(await req.json())
    if (cambios.patente !== undefined) cambios.patente = normalizarPatente(cambios.patente)
    if (cambios.prorroga_liquidacion && !cambios.prorroga_fundamento?.trim()) {
      throw new ErrorHttp(400, 'La prórroga requiere fundamento y gestiones concretas (DS 1.055 art. 23)')
    }
    const { data: caso, error } = await supabase
      .from('casos_siniestro')
      .update(cambios)
      .eq('id', params.id)
      .select('*')
      .maybeSingle<CasoDb>()
    if (error) throw new ErrorHttp(403, error.message)
    if (!caso) throw new ErrorHttp(404, 'Caso no encontrado o sin permiso de edición')
    const reglas = await reglasDelCaso(supabase, caso)
    await sincronizarPlazos(supabase, caso, reglas)
    return Response.json({ ok: true })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Datos inválidos', detalle: e.issues }, { status: 400 })
    return respuestaError(e)
  }
}
