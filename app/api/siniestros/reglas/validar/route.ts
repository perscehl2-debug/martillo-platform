import { validarReglas } from '@/lib/siniestros/reglas'
import { requerirSesion, respuestaError } from '@/lib/siniestros/servidor'

export async function POST(req: Request) {
  try {
    await requerirSesion()
    const texto = await req.text()
    let json: unknown
    try {
      json = JSON.parse(texto)
    } catch (e) {
      return Response.json({ valido: false, errores: [`JSON mal formado: ${(e as Error).message}`] })
    }
    return Response.json(validarReglas(json))
  } catch (e) {
    return respuestaError(e)
  }
}
