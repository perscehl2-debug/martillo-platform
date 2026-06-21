import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: totalAuctions },
    { count: liveAuctions },
    { count: totalBids },
    { count: totalUsers },
  ] = await Promise.all([
    supabase.from('auctions').select('*', { count: 'exact', head: true }),
    supabase.from('auctions').select('*', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('bids').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  const { data: recentAuctions } = await supabase
    .from('auctions').select('*').order('created_at', { ascending: false }).limit(5)

  const { data: recentBids } = await supabase
    .from('bids').select('*, profiles(email), auctions(title)')
    .order('created_at', { ascending: false }).limit(5)

  const stats = [
    { label: 'Total remates', value: totalAuctions ?? 0, color: 'text-white' },
    { label: 'En vivo ahora', value: liveAuctions ?? 0, color: 'text-green-400' },
    { label: 'Total pujas', value: totalBids ?? 0, color: 'text-[#c8902a]' },
    { label: 'Usuarios', value: totalUsers ?? 0, color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Panel de administración de Martillo</p>
        </div>
        <Link href="/admin/auctions/new"
          className="px-4 py-2.5 bg-[#c8902a] hover:bg-[#e8a830] text-black font-bold text-sm rounded-lg transition-colors">
          + Nuevo remate
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-[#070b18] border border-white/10 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent auctions */}
      <div className="bg-[#070b18] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-bold text-white">Remates recientes</h2>
          <Link href="/admin/auctions" className="text-xs text-[#c8902a] hover:text-[#e8a830]">Ver todos →</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Título</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Tipo</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Estado</th>
              <th className="text-left px-6 py-3 text-gray-500 font-medium">Precio actual</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {recentAuctions?.map(a => (
              <tr key={a.id} className="border-b border-white/5 hover:bg-white/2">
                <td className="px-6 py-4 text-white truncate max-w-xs">{a.title}</td>
                <td className="px-6 py-4">
                  <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">{a.type}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold ${a.status === 'live' ? 'text-green-400' : 'text-gray-500'}`}>{a.status}</span>
                </td>
                <td className="px-6 py-4 text-[#c8902a] font-mono">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(a.current_price || a.base_price)}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/admin/auctions/${a.id}`} className="text-xs text-gray-400 hover:text-white">Editar →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent bids */}
      <div className="bg-[#070b18] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-bold text-white">Últimas pujas</h2>
        </div>
        <div className="divide-y divide-white/5">
          {recentBids?.map(bid => (
            <div key={bid.id} className="flex items-center justify-between px-6 py-3">
              <div>
                <p className="text-sm text-white">{(bid as any).profiles?.email ?? 'Usuario'}</p>
                <p className="text-xs text-gray-500 truncate max-w-xs">{(bid as any).auctions?.title}</p>
              </div>
              <p className="text-[#c8902a] font-bold font-mono text-sm">
                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(bid.amount)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
