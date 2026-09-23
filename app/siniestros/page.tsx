import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Chip, ChipPlazo, ESTADOS_CASO, inputCls, botonCls } from '@/components/siniestros/ui'
import { formatearFecha, hoyIso } from '@/lib/siniestros/fechas'
import { estadoPlazo, type EstadoPlazo } from '@/lib/siniestros/plazos'
import { sesionSiniestros } from '@/lib/siniestros/servidor'

export const dynamic = 'force-dynamic'

interface Fila {
  id: string
  numero: string
  estado: string
  coberturas: string[]
  regimen_cobertura: string
  fecha_accidente: string
  fecha_denuncio: string
  patente: string | null
  liquidador_id: string | null
  usuarios: { nombre: string } | null
  personas: { rol: string; nombre: string }[]
  plazos_caso: { tipo_plazo: string; nombre: string; fecha_limite: string; cumplido_el: string | null }[]
}

const PRIORIDAD: Record<EstadoPlazo, number> = { vencido: 0, critico: 1, proximo: 2, en_plazo: 3, cumplido_fuera_plazo: 4, cumplido: 5 }

export default async function Bandeja({ searchParams }: { searchParams: { estado?: string; liquidador?: string; alerta?: string; q?: string } }) {
  const sesion = await sesionSiniestros()
  if (!sesion) redirect('/auth/login?redirect=/siniestros')
  const { supabase, usuario } = sesion

  let consulta = supabase
    .from('casos_siniestro')
    .select('id, numero, estado, coberturas, regimen_cobertura, fecha_accidente, fecha_denuncio, patente, liquidador_id, usuarios!casos_siniestro_liquidador_id_fkey(nombre), personas(rol, nombre), plazos_caso(tipo_plazo, nombre, fecha_limite, cumplido_el)')
    .order('fecha_denuncio', { ascending: false })
    .limit(200)
  if (searchParams.estado) consulta = consulta.eq('estado', searchParams.estado)
  if (searchParams.liquidador) consulta = consulta.eq('liquidador_id', searchParams.liquidador)
  if (searchParams.q) consulta = consulta.or(`numero.ilike.%${searchParams.q.replace(/[,()%]/g, '')}%,patente.ilike.%${searchParams.q.replace(/[,()%]/g, '')}%`)

  const [{ data, error }, { data: liquidadores }] = await Promise.all([
    consulta.returns<Fila[]>(),
    supabase.from('usuarios').select('id, nombre').eq('rol', 'liquidador').eq('activo', true),
  ])

  const hoy = hoyIso()
  const filas = (data ?? [])
    .map(c => {
      const abiertos = c.plazos_caso
        .filter(p => !p.cumplido_el)
        .map(p => ({ ...p, ...estadoPlazo(p, hoy) }))
        .sort((a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado] || a.fecha_limite.localeCompare(b.fecha_limite))
      return { ...c, proximo: abiertos[0] ?? null }
    })
    .filter(c => !searchParams.alerta || c.proximo?.estado === searchParams.alerta)
    .sort((a, b) => (a.proximo ? PRIORIDAD[a.proximo.estado] : 9) - (b.proximo ? PRIORIDAD[b.proximo.estado] : 9))

  const conteo = (e: EstadoPlazo) => filas.filter(f => f.proximo?.estado === e).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white md:text-3xl">Bandeja de casos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {usuario.rol === 'liquidador' ? 'Casos asignados a ti' : 'Todos los casos'} · ordenados por urgencia de plazo
          </p>
        </div>
        <Link href="/siniestros/nuevo" className={botonCls}>+ Nuevo denuncio</Link>
      </div>

      <div className="grid grid-cols-3 gap-3 md:max-w-xl">
        {([['vencido', 'Vencidos', 'text-red-400'], ['critico', 'Críticos (≤3 d)', 'text-red-300'], ['proximo', 'Próximos (≤7 d)', 'text-amber-300']] as const).map(([k, l, c]) => (
          <Link key={k} href={`/siniestros?alerta=${k}`} className="rounded-xl border border-white/10 bg-[#070b18] p-4 hover:border-white/20">
            <p className="text-xs text-gray-500">{l}</p>
            <p className={`text-2xl font-black ${c}`}>{conteo(k)}</p>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={searchParams.q} placeholder="N° de caso o patente" className={`${inputCls} max-w-[200px]`} />
        <select name="estado" defaultValue={searchParams.estado ?? ''} className={`${inputCls} max-w-[180px]`}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_CASO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {usuario.rol !== 'liquidador' && (
          <select name="liquidador" defaultValue={searchParams.liquidador ?? ''} className={`${inputCls} max-w-[200px]`}>
            <option value="">Todos los liquidadores</option>
            {(liquidadores ?? []).map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        )}
        <select name="alerta" defaultValue={searchParams.alerta ?? ''} className={`${inputCls} max-w-[160px]`}>
          <option value="">Toda alerta</option>
          <option value="vencido">Vencido</option>
          <option value="critico">Crítico</option>
          <option value="proximo">Próximo</option>
          <option value="en_plazo">En plazo</option>
        </select>
        <button className={botonCls}>Filtrar</button>
      </form>

      {error && <p className="text-sm text-red-400">Error al cargar casos: {error.message}</p>}

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#070b18]">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Caso</th>
              <th className="px-4 py-3 font-medium">Víctima</th>
              <th className="px-4 py-3 font-medium">Coberturas</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Liquidador</th>
              <th className="px-4 py-3 font-medium">Próximo plazo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(c => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/siniestros/${c.id}`} className="font-mono font-bold text-[#c8902a] hover:underline">{c.numero}</Link>
                  <p className="text-xs text-gray-500">Accidente {formatearFecha(c.fecha_accidente)}{c.patente ? ` · ${c.patente}` : ''}</p>
                </td>
                <td className="px-4 py-3 text-white">{c.personas.find(p => p.rol === 'victima')?.nombre ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {c.coberturas.map(x => <Chip key={x}>{x.replace('_', ' ')}</Chip>)}
                    <Chip color={c.regimen_cobertura === 'post_ley_jacinta' ? 'azul' : 'gris'}>{c.regimen_cobertura === 'post_ley_jacinta' ? '600 UF' : '300 UF'}</Chip>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">{ESTADOS_CASO[c.estado] ?? c.estado}</td>
                <td className="px-4 py-3 text-gray-400">{c.usuarios?.nombre ?? <span className="text-amber-400">Sin asignar</span>}</td>
                <td className="px-4 py-3">
                  {c.proximo ? (
                    <div>
                      <ChipPlazo estado={c.proximo.estado} dias={c.proximo.dias_restantes} />
                      <p className="mt-1 text-xs text-gray-500">{c.proximo.nombre} · {formatearFecha(c.proximo.fecha_limite)}</p>
                    </div>
                  ) : <span className="text-gray-600">—</span>}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No hay casos con estos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
