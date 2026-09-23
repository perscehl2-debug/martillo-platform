import { clienteServicio, requerirSesion, respuestaError } from '@/lib/siniestros/servidor'
import { sincronizarUf } from '@/lib/siniestros/uf'

export const runtime = 'nodejs'

/** Job diario (Vercel Cron envía `Authorization: Bearer $CRON_SECRET`). */
export async function GET(req: Request) {
  try {
    const secreto = process.env.CRON_SECRET
    if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    const n = await sincronizarUf(clienteServicio())
    return Response.json({ ok: true, valores: n })
  } catch (e) {
    return respuestaError(e)
  }
}

/** Sincronización manual por un supervisor. */
export async function POST() {
  try {
    await requerirSesion(['supervisor'])
    const n = await sincronizarUf(clienteServicio())
    return Response.json({ ok: true, valores: n })
  } catch (e) {
    return respuestaError(e)
  }
}
