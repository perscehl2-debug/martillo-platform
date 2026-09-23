// Valor UF desde mindicador.cl (espejo del Banco Central), con historial
// local en la tabla valores_uf. Nunca se fija el valor en código.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ValorUf } from './calculo'

const MINDICADOR = 'https://mindicador.cl/api/uf'

interface RespuestaMindicador {
  serie: { fecha: string; valor: number }[]
}

function aSerie(json: RespuestaMindicador): ValorUf[] {
  return (json.serie ?? []).map(s => ({ fecha: s.fecha.slice(0, 10), valor: Number(s.valor) }))
}

/** Últimos ~30 valores publicados. */
export async function obtenerSerieUf(fetcher: typeof fetch = fetch): Promise<ValorUf[]> {
  const res = await fetcher(MINDICADOR, { cache: 'no-store' })
  if (!res.ok) throw new Error(`mindicador.cl respondió ${res.status}`)
  return aSerie(await res.json())
}

/** Valor para una fecha específica (dd-mm-yyyy en la API). */
export async function obtenerUfFecha(fecha: string, fetcher: typeof fetch = fetch): Promise<ValorUf | null> {
  const [y, m, d] = fecha.split('-')
  const res = await fetcher(`${MINDICADOR}/${d}-${m}-${y}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`mindicador.cl respondió ${res.status}`)
  return aSerie(await res.json())[0] ?? null
}

/** Descarga la serie reciente y la guarda (upsert) en valores_uf. Requiere cliente service_role. */
export async function sincronizarUf(admin: SupabaseClient, fetcher: typeof fetch = fetch): Promise<number> {
  const serie = await obtenerSerieUf(fetcher)
  if (serie.length === 0) return 0
  const { error } = await admin.from('valores_uf').upsert(
    serie.map(s => ({ fecha: s.fecha, valor: s.valor, fuente: 'mindicador.cl' })),
    { onConflict: 'fecha' },
  )
  if (error) throw error
  return serie.length
}

/**
 * Valor UF vigente a una fecha: primero la tabla local; si no existe, consulta
 * mindicador.cl y lo persiste cuando se entrega un cliente con permisos.
 */
export async function valorUfA(
  db: SupabaseClient,
  fecha: string,
  opciones: { admin?: SupabaseClient; fetcher?: typeof fetch } = {},
): Promise<ValorUf> {
  const { data } = await db.from('valores_uf').select('fecha, valor').eq('fecha', fecha).maybeSingle()
  if (data) return { fecha: data.fecha, valor: Number(data.valor) }
  const remoto = await obtenerUfFecha(fecha, opciones.fetcher)
  if (!remoto) throw new Error(`No hay valor UF publicado para ${fecha}`)
  if (opciones.admin) {
    await opciones.admin.from('valores_uf').upsert({ ...remoto, fuente: 'mindicador.cl' }, { onConflict: 'fecha' })
  }
  return remoto
}
