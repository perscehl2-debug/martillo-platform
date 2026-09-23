import { z } from 'zod'
import { ErrorHttp, requerirSesion, respuestaError } from '@/lib/siniestros/servidor'

const esquema = z.object({
  cobertura: z.string(),
  grado_incapacidad: z.number().min(0).max(1).nullable(),
})

/** El liquidador ingresa o corrige el grado de incapacidad certificado (arts. 27-28). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requerirSesion(['liquidador', 'supervisor'])
    const { cobertura, grado_incapacidad } = esquema.parse(await req.json())
    const { data, error } = await supabase
      .from('coberturas_caso')
      .update({ grado_incapacidad })
      .eq('caso_id', params.id)
      .eq('cobertura', cobertura)
      .select('id')
    if (error) throw error
    if (!data?.length) throw new ErrorHttp(404, 'Cobertura no encontrada')
    return Response.json({ ok: true })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Datos inválidos', detalle: e.issues }, { status: 400 })
    return respuestaError(e)
  }
}
