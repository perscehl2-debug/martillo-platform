import { createClient } from '@/lib/supabase/server'
import { BidForm } from '@/components/auctions/BidForm'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default async function AuctionDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auction } = await supabase.from('auctions').select('*').eq('id', id).single()
  if (!auction) notFound()

  const { count: bidCount } = await supabase.from('bids').select('*', { count: 'exact', head: true }).eq('auction_id', id)

  const imgs = auction.image_urls?.length ? auction.image_urls : ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200']

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-4">
        <Link href="/auctions" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-8 transition-colors">
          ← Volver a remates
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Images + Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main image */}
            <div className="relative rounded-xl overflow-hidden aspect-video bg-[#070b18]">
              <img src={imgs[0]} alt={auction.title} className="w-full h-full object-cover" />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${auction.type === 'auto' ? 'bg-blue-900/90 text-blue-300' : 'bg-emerald-900/90 text-emerald-300'}`}>
                  {auction.type === 'auto' ? '🚗 AUTO' : '🏠 VIVIENDA'}
                </span>
                {auction.status === 'live' && (
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-900/90 text-red-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> EN VIVO
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail strip */}
            {imgs.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imgs.slice(1).map((url: string, i: number) => (
                  <div key={i} className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border border-white/10">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Details */}
            <div className="border border-white/10 rounded-xl p-6 bg-[#070b18]">
              <h1 className="text-2xl font-black text-white mb-4">{auction.title}</h1>
              <p className="text-gray-400 leading-relaxed">{auction.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Precio base</p>
                  <p className="text-white font-bold">{formatPrice(auction.base_price)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total pujas</p>
                  <p className="text-white font-bold">{bidCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Cierra</p>
                  <p className="text-white font-bold text-sm">{new Date(auction.ends_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Estado</p>
                  <p className={`font-bold text-sm capitalize ${auction.status === 'live' ? 'text-green-400' : 'text-gray-400'}`}>{auction.status}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bid sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <BidForm auction={auction} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
