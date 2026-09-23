import { z } from 'zod'
import { validarReglas } from '@/lib/siniestros/reglas'
import { ErrorHttp, requerirSesion, respuestaError } from '@/lib/siniestros/servidor'
import type { ReglasProducto } from '@/lib/siniestros/tipos'

const esquema = z.object({
  json_reglas: z.unknown(),
  vigente_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/** Publica una nueva versión de reglas (supervisor). Los casos abiertos conservan la versión con que se crearon. */
export async function POST(req: Request) {
  try {
    const { supabase, usuario } = await requerirSesion(['supervisor'])
    const { json_reglas, vigente_desde } = esquema.parse(await req.json())
    const validacion = validarReglas(json_reglas)
    if (!validacion.valido) return Response.json(validacion, { status: 422 })
    const reglas = json_reglas as ReglasProducto
    const { data: producto } = await supabase.from('productos_seguro').select('id').eq('id', reglas.producto).maybeSingle()
    if (!producto) throw new ErrorHttp(400, `Producto ${reglas.producto} no registrado en productos_seguro`)
    const { error } = await supabase.from('reglas_producto').insert({
      producto_id: reglas.producto,
      version: reglas.version_reglas,
      json_reglas: reglas,
      vigente_desde,
      publicado_por: usuario.id,
    })
    if (error) throw new ErrorHttp(error.code === '23505' ? 409 : 403, error.code === '23505' ? 'Esa versión ya fue publicada' : error.message)
    return Response.json({ ok: true }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Datos inválidos', detalle: e.issues }, { status: 400 })
    return respuestaError(e)
  }
}
