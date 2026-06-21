import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default async function AdminAuctionsPage() {
  const supabase = await createClient()
  const { data: auctions } = await supabase.from('auctions').select('*').order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-white">Remates</h1>
        <Link href="/admin/auctions/new" className="px-4 py-2.5 bg-[#c8902a] hover:bg-[#e8a830] text-black font-bold text-sm rounded-lg transition-colors">
          + Nuevo remate
        </Link>
      </div>

      <div className="bg-[#070b18] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Título</th>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Tipo</th>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Estado</th>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Precio</th>
              <th className="text-left px-6 py-4 text-gray-500 font-medium">Cierra</th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {auctions?.map(a => (
              <tr key={a.id} className="hover:bg-white/2 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-white font-medium truncate max-w-xs">{a.title}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400 uppercase">{a.type}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    a.status === 'live' ? 'bg-green-900/50 text-green-400' :
                    a.status === 'draft' ? 'bg-gray-800 text-gray-400' :
                    a.status === 'ended' ? 'bg-red-900/50 text-red-400' :
                    'bg-yellow-900/50 text-yellow-400'
                  }`}>{a.status}</span>
                </td>
                <td className="px-6 py-4 text-[#c8902a] font-mono">{formatPrice(a.current_price || a.base_price)}</td>
                <td className="px-6 py-4 text-gray-400 text-xs">
                  {new Date(a.ends_at).toLocaleDateString('es-CL')}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/admin/auctions/${a.id}`} className="text-xs text-gray-400 hover:text-[#c8902a] transition-colors">
                    Editar →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!auctions?.length && (
          <div className="py-16 text-center text-gray-500">No hay remates. <Link href="/admin/auctions/new" className="text-[#c8902a]">Crea el primero →</Link></div>
        )}
      </div>
    </div>
  )
}
