import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChipPlazo, Tarjeta } from '@/components/siniestros/ui'
import { formatearFecha, hoyIso } from '@/lib/siniestros/fechas'
import { estadoPlazo } from '@/lib/siniestros/plazos'
import { sesionSiniestros } from '@/lib/siniestros/servidor'

export const dynamic = 'force-dynamic'

export default async function TableroPlazos() {
  const sesion = await sesionSiniestros()
  if (!sesion) redirect('/auth/login?redirect=/siniestros/plazos')
  const hasta = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  const { data } = await sesion.supabase
    .from('plazos_caso')
    .select('id, tipo_plazo, nombre, fundamento, fecha_limite, computo, cumplido_el, caso_id, casos_siniestro(numero, estado)')
    .is('cumplido_el', null)
    .lte('fecha_limite', hasta)
    .order('fecha_limite')
    .limit(500)

  const hoy = hoyIso()
  const filas = (data ?? []).map(p => ({ ...p, ...estadoPlazo(p, hoy), caso: p.casos_siniestro as unknown as { numero: string; estado: string } | null }))
  const grupos = [
    { titulo: 'Vencidos', items: filas.filter(f => f.estado === 'vencido') },
    { titulo: 'Críticos (≤ 3 días)', items: filas.filter(f => f.estado === 'critico') },
    { titulo: 'Próximos (≤ 7 días)', items: filas.filter(f => f.estado === 'proximo') },
    { titulo: 'Próximos 30 días', items: filas.filter(f => f.estado === 'en_plazo') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white md:text-3xl">Plazos y alertas</h1>
        <p className="mt-1 text-sm text-gray-500">Liquidación 45 días corridos (DS 1.055 art. 23) · pago 10 días / 7 días hábiles en muerte (Ley 18.490 art. 30) · prescripción 1 año (art. 13) · comunicación 3 días hábiles.</p>
      </div>
      {grupos.map(g => (
        <Tarjeta key={g.titulo} titulo={`${g.titulo} (${g.items.length})`}>
          {g.items.length === 0 ? <p className="text-sm text-gray-500">Sin plazos.</p> : (
            <ul className="divide-y divide-white/5">
              {g.items.map(p => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <Link href={`/siniestros/${p.caso_id}`} className="font-mono text-sm font-bold text-[#c8902a] hover:underline">{p.caso?.numero}</Link>
                    <span className="ml-2 text-sm text-white">{p.nombre}</span>
                    <p className="text-xs text-gray-500">{p.fundamento} · vence {formatearFecha(p.fecha_limite)} ({p.computo})</p>
                  </div>
                  <ChipPlazo estado={p.estado} dias={p.dias_restantes} />
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      ))}
    </div>
  )
}
