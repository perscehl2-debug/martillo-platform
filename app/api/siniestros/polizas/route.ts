import { buscarPolizas } from '@/lib/siniestros/polizas'
import { requerirSesion, respuestaError } from '@/lib/siniestros/servidor'

export const dynamic = 'force-dynamic'

/** Busca pólizas por número o patente. */
export async function GET(req: Request) {
  try {
    const { supabase } = await requerirSesion()
    const q = new URL(req.url).searchParams.get('q') ?? ''
    return Response.json(await buscarPolizas(supabase, q))
  } catch (e) {
    return respuestaError(e)
  }
}
