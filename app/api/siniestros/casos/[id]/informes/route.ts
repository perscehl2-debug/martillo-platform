import { z } from 'zod'
import { construirContenido } from '@/lib/siniestros/informe'
import { requerirSesion, respuestaError } from '@/lib/siniestros/servidor'

const esquema = z.object({
  tipo: z.enum(['preinforme', 'informe_liquidacion', 'finiquito']),
  conclusion: z.string().max(5000).nullish(),
})

/** El liquidador redacta un informe; queda pendiente de aprobación del supervisor. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, usuario } = await requerirSesion(['liquidador', 'supervisor'])
    const { tipo, conclusion } = esquema.parse(await req.json())
    const contenido = await construirContenido(supabase, params.id, tipo, usuario, conclusion ?? null)
    const { data, error } = await supabase
      .from('informes')
      .insert({
        caso_id: params.id,
        tipo,
        estado: 'pendiente_aprobacion',
        json_contenido: contenido,
        monto_uf: contenido.total_uf,
        monto_clp: contenido.total_clp,
        valor_uf: contenido.valor_uf.valor,
        fecha_valor_uf: contenido.valor_uf.fecha,
        redactado_por: usuario.id,
      })
      .select('id')
      .single()
    if (error) throw error
    return Response.json({ id: data.id }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Datos inválidos', detalle: e.issues }, { status: 400 })
    return respuestaError(e)
  }
}
