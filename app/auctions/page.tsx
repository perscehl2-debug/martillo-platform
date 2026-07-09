import { createPublicClient } from '@/lib/supabase/server'
import { AuctionCard } from '@/components/auctions/AuctionCard'

export const revalidate = 30
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ type?: string; status?: string }>
}

export default async function AuctionsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = createPublicClient()

  let query = supabase.from('auctions').select('*').eq('status', 'live').order('ends_at', { ascending: true })
  if (params.type === 'auto' || params.type === 'vivienda') query = query.eq('type', params.type)

  const { data: auctions } = await query

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-10">
          <p className="text-xs tracking-[0.3em] text-[#c8902a] uppercase mb-3">Catálogo</p>
          <h1 className="text-4xl font-black text-white mb-6">
            {params.type === 'auto' ? 'Autos en remate' :
             params.type === 'vivienda' ? 'Viviendas en remate' :
             'Todos los remates'}
          </h1>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Todos', type: '' },
              { label: 'Autos', type: 'auto' },
              { label: 'Viviendas', type: 'vivienda' },
            ].map(f => (
              <a key={f.type} href={f.type ? `/auctions?type=${f.type}` : '/auctions'}
                className={`px-4 py-2 rounded-full text-sm transition-all ${
                  params.type === f.type || (!params.type && !f.type)
                    ? 'bg-[#c8902a] text-black font-bold'
                    : 'border border-white/10 text-gray-400 hover:border-[#c8902a]/40 hover:text-white'
                }`}>
                {f.label}
              </a>
            ))}
          </div>
        </div>

        {auctions && auctions.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {auctions.map(a => <AuctionCard key={a.id} auction={a} />)}
          </div>
        ) : (
          <div className="border border-white/10 rounded-xl p-16 text-center">
            <p className="text-gray-400 text-lg">No hay remates activos en este momento.</p>
            <p className="text-gray-600 text-sm mt-2">Vuelve pronto — publicamos nuevos remates cada semana.</p>
          </div>
        )}
      </div>
    </div>
  )
}
