import { createPublicClient } from '@/lib/supabase/server'
import { BidForm } from '@/components/auctions/BidForm'
import { notFound } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function getAbonoAmount(type: string): string {
  if (type === 'auto') return '$250.000'
  if (type === 'vivienda') return '$500.000'
  return '$300.000'
}

export default async function AuctionDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = createPublicClient()

  const { data: auction } = await supabase.from('auctions').select('*').eq('id', id).single()
  if (!auction) notFound()

  const { count: bidCount } = await supabase.from('bids').select('*', { count: 'exact', head: true }).eq('auction_id', id)

  const imgs = auction.image_urls?.filter((u: string) => u && u.length > 0)
  const mainImg = imgs?.[0] || null

  const closingDate = new Date(auction.ends_at)
  const closingDateStr = closingDate.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#04060d] pt-20 pb-16">
      <div className="max-w-screen-xl mx-auto px-6 md:px-12">
        <div className="pt-8 mb-8">
          <Link href="/auctions" className="inline-flex items-center gap-2 text-gray-600 hover:text-white text-xs uppercase tracking-widest transition-colors">
            ← Volver a remates
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Images + Info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Main image */}
            <div className="relative rounded-lg overflow-hidden aspect-video bg-[#0a0d1a]">
              {mainImg ? (
                <img src={mainImg} alt={auction.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl font-black text-white/5">{auction.type === 'auto' ? 'AUTO' : 'PROP'}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent" />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className={`text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-sm uppercase ${
                  auction.type === 'auto'
                    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                }`}>
                  {auction.type === 'auto' ? 'Automóvil' : 'Propiedad'}
                </span>
                {auction.status === 'live' && (
                  <span className="text-[10px] font-bold px-3 py-1.5 rounded-sm flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-red-500/30 text-red-300 uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> En vivo
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {imgs && imgs.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imgs.slice(1).map((url: string, i: number) => (
                  <div key={i} className="flex-shrink-0 w-20 h-14 rounded overflow-hidden border border-white/8">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {/* Main info */}
            <div className="border border-white/6 rounded-lg p-7 bg-[#07090f]">
              <h1 className="text-2xl md:text-3xl font-black text-white mb-5 tracking-tight">{auction.title}</h1>
              {auction.description && (
                <p className="text-gray-400 leading-relaxed text-sm mb-7">{auction.description}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-white/6 pt-6">
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Precio base</p>
                  <p className="text-white font-bold">{formatPrice(auction.base_price)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Total pujas</p>
                  <p className="text-white font-bold">{bidCount ?? 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Cierre</p>
                  <p className="text-white font-bold text-xs capitalize">{closingDateStr}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Estado</p>
                  <p className={`font-bold text-sm capitalize ${
                    auction.status === 'live' ? 'text-green-400' :
                    auction.status === 'ended' ? 'text-gray-500' :
                    'text-gray-400'
                  }`}>{
                    auction.status === 'live' ? 'En vivo' :
                    auction.status === 'ended' ? 'Finalizado' :
                    auction.status
                  }</p>
                </div>
              </div>
            </div>

            {/* Exhibition note */}
            <div className="border border-white/6 rounded-lg p-5 flex gap-4 items-start">
              <div className="w-6 h-6 border border-white/10 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white/30 text-xs font-bold">i</span>
              </div>
              <div>
                <p className="text-white text-sm font-medium mb-1">Exhibición previa disponible</p>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Podés inspeccionar el bien antes del remate. Consulta los horarios de exhibición en{' '}
                  <Link href="/contacto" className="text-amber-400/70 hover:text-amber-400 transition-colors">nuestra página de contacto</Link>.
                  Recomendamos verificar el estado del bien antes de participar.
                </p>
              </div>
            </div>
          </div>

          {/* Bid sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <BidForm auction={auction} />

              {/* Abono / participación panel */}
              {auction.status === 'live' && (
                <div className="border border-amber-500/20 rounded-lg p-6 bg-amber-500/3">
                  <p className="text-[10px] text-amber-500/60 uppercase tracking-widest font-mono mb-5">Para participar</p>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-xs text-gray-500">Abono requerido</span>
                      <span className="text-amber-400 font-black text-lg font-mono">{getAbonoAmount(auction.type)} CLP</span>
                    </div>
                    <div className="flex justify-between items-start gap-4 border-t border-white/5 pt-4">
                      <span className="text-xs text-gray-500">Plazo límite</span>
                      <span className="text-white text-xs font-medium text-right">10:00 AM del día del remate</span>
                    </div>
                  </div>

                  <div className="border-t border-amber-500/10 pt-5 mb-5">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Datos para transferencia</p>
                    <dl className="space-y-2">
                      {[
                        ['Banco', 'Banco de Chile'],
                        ['Titular', 'Martillo SpA'],
                        ['RUT', '77.123.456-7'],
                        ['Cta. corriente', '123-456789'],
                        ['Email comprobante', 'garantias@martillo.cl'],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between gap-3 text-xs">
                          <dt className="text-gray-600">{l}</dt>
                          <dd className="text-white text-right">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="bg-black/20 rounded px-4 py-3 border border-white/5">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Si no adjudicas, devolvemos el{' '}
                      <strong className="text-amber-400">100% de tu garantía</strong>{' '}
                      el lunes siguiente al remate.
                    </p>
                  </div>

                  <Link href="/como-funciona"
                    className="block mt-4 text-center text-xs text-gray-600 hover:text-amber-400 transition-colors tracking-widest uppercase">
                    Ver proceso completo →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
