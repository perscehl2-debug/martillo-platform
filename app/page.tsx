import nextDynamic from 'next/dynamic'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase/server'

const KlingHero = nextDynamic(() => import('@/components/3d/KlingHero').then(m => ({ default: m.KlingHero })), {
  ssr: false,
  loading: () => (
    <div style={{ height: '800vh' }} className="relative">
      <div className="sticky top-0 h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
      </div>
    </div>
  ),
})

export const revalidate = 30
export const dynamic = 'force-dynamic'

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function Countdown({ endsAt }: { endsAt: string }) {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return <span className="text-gray-600">Finalizado</span>
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return (
    <span className="font-mono text-amber-400 text-xs tracking-wider">
      {d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`}
    </span>
  )
}

// Auction card images — Kling-generated, matched by title keywords
const AUCTION_IMAGES: Record<string, string> = {
  'Porsche': '/images/auctions/porsche.png',
  'Ferrari': '/images/auctions/ferrari.png',
  'BMW':     '/images/auctions/bmw.png',
  'Casa':    '/images/auctions/casa.png',
  'Depto':   '/images/auctions/depto.png',
  'Departamento': '/images/auctions/depto.png',
  'Villa':   '/images/auctions/villa.png',
  'Vitacura': '/images/auctions/villa.png',
  'Condes':  '/images/auctions/casa.png',
  'auto':    '/images/auctions/porsche.png',
}

function getAuctionImage(title: string, imageUrls: string[], type: string) {
  // Skip Unsplash placeholders — use Kling images instead
  const ownImg = imageUrls?.find(u => u && !u.includes('unsplash'))
  if (ownImg) return ownImg
  // Match by keyword in title
  for (const [key, path] of Object.entries(AUCTION_IMAGES)) {
    if (title.toLowerCase().includes(key.toLowerCase())) return path
  }
  // Fallback by type
  return type === 'auto' ? '/images/auctions/porsche.png' : '/images/auctions/casa.png'
}

function AuctionCard({ auction }: { auction: any }) {
  const img = getAuctionImage(auction.title, auction.image_urls || [], auction.type)
  const isAuto = auction.type === 'auto'

  return (
    <Link href={`/auctions/${auction.id}`}>
      <article className="group relative overflow-hidden rounded-lg border border-white/8 bg-[#0a0d1a] hover:border-amber-500/30 transition-all duration-500 cursor-pointer">
        {/* Image */}
        <div className="relative h-56 overflow-hidden bg-[#0f1220]">
          {img ? (
            <img src={img} alt={auction.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center ${isAuto ? 'bg-[#0a1030]' : 'bg-[#0a1a0a]'}`}>
              <div className="text-white/10 text-7xl font-black">{isAuto ? 'AUTO' : 'PROP'}</div>
            </div>
          )}
          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1a] via-transparent to-transparent" />
          {/* Type label */}
          <div className="absolute top-3 left-3">
            <span className={`text-[10px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 rounded-sm
              ${isAuto ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'}`}>
              {isAuto ? 'Automóvil' : 'Propiedad'}
            </span>
          </div>
          {/* Live badge */}
          {auction.status === 'live' && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-red-500/30 rounded-sm px-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-red-300 text-[10px] font-bold tracking-widest uppercase">En vivo</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-white font-semibold text-sm leading-snug mb-4 line-clamp-2">{auction.title}</h3>
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Oferta actual</p>
                <p className="text-amber-400 font-bold text-base tracking-tight">
                  {formatPrice(auction.current_price || auction.base_price)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Cierra</p>
                <Countdown endsAt={auction.ends_at} />
              </div>
            </div>
            <div className="pt-3 border-t border-white/5">
              <span className="text-[10px] text-gray-600 uppercase tracking-widest">
                Base: {formatPrice(auction.base_price)}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}

export default async function HomePage() {
  const supabase = createPublicClient()
  const { data: autos, error: e1 } = await supabase.from('auctions').select('*').eq('type', 'auto').eq('status', 'live').order('ends_at', { ascending: true }).limit(3)
  const { data: viviendas, error: e2 } = await supabase.from('auctions').select('*').eq('type', 'vivienda').eq('status', 'live').order('ends_at', { ascending: true }).limit(3)
  if (e1) console.error('Autos error:', e1)
  if (e2) console.error('Viviendas error:', e2)

  return (
    <>
      <KlingHero />

      {/* ─── CONTENT ─── */}
      <div className="bg-[#04060d]">

        {/* AUTOS */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-12 py-28">
          <div className="flex items-end justify-between mb-14">
            <div>
              <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-4 font-mono">Subastas activas</p>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Automóviles</h2>
            </div>
            <Link href="/auctions?type=auto"
              className="text-xs text-gray-500 hover:text-amber-400 transition-colors tracking-widest uppercase">
              Ver todos →
            </Link>
          </div>

          {autos && autos.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {autos.map(a => <AuctionCard key={a.id} auction={a} />)}
            </div>
          ) : (
            <EmptyState type="auto" />
          )}
        </section>

        {/* DIVIDER */}
        <div className="max-w-screen-xl mx-auto px-6 md:px-12">
          <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
        </div>

        {/* VIVIENDAS */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-12 py-28">
          <div className="flex items-end justify-between mb-14">
            <div>
              <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-4 font-mono">Propiedades</p>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Viviendas</h2>
            </div>
            <Link href="/auctions?type=vivienda"
              className="text-xs text-gray-500 hover:text-amber-400 transition-colors tracking-widest uppercase">
              Ver todas →
            </Link>
          </div>

          {viviendas && viviendas.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {viviendas.map(a => <AuctionCard key={a.id} auction={a} />)}
            </div>
          ) : (
            <EmptyState type="vivienda" />
          )}
        </section>

        {/* STATS BAR */}
        <section className="border-y border-white/5 py-16">
          <div className="max-w-screen-xl mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '+$4.800M', label: 'CLP transaccionados' },
              { value: '1.248',   label: 'Lotes subastados' },
              { value: '3.540',   label: 'Compradores activos' },
              { value: '98%',     label: 'Tasa de adjudicación' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">{s.value}</p>
                <p className="text-[11px] text-gray-600 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="max-w-screen-xl mx-auto px-6 md:px-12 py-28">
          <div className="flex items-end justify-between mb-16 flex-wrap gap-4">
            <div>
              <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-4 font-mono">El proceso</p>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Cómo funciona</h2>
            </div>
            <Link href="/como-funciona" className="text-xs text-gray-500 hover:text-amber-400 tracking-widest uppercase transition-colors">
              Ver proceso completo →
            </Link>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {[
              { n: '01', t: 'Regístrate', d: 'Crea tu cuenta con email y contraseña en menos de 2 minutos.' },
              { n: '02', t: 'Transfiere garantía', d: 'Abona antes de las 10 AM del remate. Si no adjudicas, te devolvemos el 100%.', highlight: true },
              { n: '03', t: 'Puja en vivo', d: 'Accede al remate y realiza tus ofertas en tiempo real.' },
              { n: '04', t: 'Adjudicación', d: 'Si ganas, recibes las instrucciones de pago en 4 horas.' },
              { n: '05', t: 'Pago y entrega', d: 'Completa el pago y coordinamos la entrega del bien.' },
            ].map(s => (
              <div key={s.n} className={`relative rounded-lg p-6 transition-colors ${
                (s as any).highlight
                  ? 'border border-amber-500/30 bg-amber-500/5'
                  : 'border border-white/6 hover:border-white/12'
              }`}>
                {(s as any).highlight && (
                  <span className="absolute -top-px left-4 px-2 py-0.5 bg-amber-500 text-black text-[9px] font-black tracking-widest uppercase rounded-b-sm">
                    Importante
                  </span>
                )}
                <span className="block text-4xl font-black text-white/8 select-none mb-3">{s.n}</span>
                <h3 className="text-sm font-bold text-white mb-2">{s.t}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 border border-amber-500/15 rounded-lg px-7 py-5 bg-amber-500/3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-amber-400/80">
              Recuerda: si no adjudicas, devolvemos el <strong className="text-amber-400">100% de tu garantía</strong> el lunes siguiente al remate.
            </p>
            <Link href="/como-funciona" className="text-xs text-amber-400 hover:text-amber-300 tracking-widest uppercase whitespace-nowrap transition-colors">
              Ver montos y datos bancarios →
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-radial from-amber-500/4 via-transparent to-transparent" />
          <div className="relative max-w-2xl mx-auto px-6 text-center">
            <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-6 font-mono">Acceso gratuito</p>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-6">
              Tu próxima compra<br />comienza acá.
            </h2>
            <p className="text-gray-500 mb-12 leading-relaxed">
              Únete a la plataforma de remates premium. Sin comisión hasta adjudicación.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/auth/register"
                className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm rounded tracking-wider uppercase transition-all hover:-translate-y-0.5">
                Crear cuenta
              </Link>
              <Link href="/auctions"
                className="px-8 py-3.5 border border-white/10 hover:border-white/20 text-white font-semibold text-sm rounded tracking-wider uppercase transition-all">
                Ver remates
              </Link>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/5 py-14">
          <div className="max-w-screen-xl mx-auto px-6 md:px-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 bg-amber-500 rounded flex items-center justify-center text-black font-black text-xs">M</div>
                  <span className="font-black text-sm text-white tracking-wider">MARTILLO</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">Plataforma de remates premium de automóviles y viviendas en Chile.</p>
              </div>
              <div>
                <p className="text-[10px] text-white/20 uppercase tracking-widest mb-4">Remates</p>
                <div className="space-y-2">
                  <Link href="/auctions?type=auto" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">Automóviles</Link>
                  <Link href="/auctions?type=vivienda" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">Propiedades</Link>
                  <Link href="/auctions" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">Todos los lotes</Link>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-white/20 uppercase tracking-widest mb-4">Información</p>
                <div className="space-y-2">
                  <Link href="/como-funciona" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">¿Cómo funciona?</Link>
                  <Link href="/quienes-somos" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">Quiénes somos</Link>
                  <Link href="/preguntas-frecuentes" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">Preguntas frecuentes</Link>
                  <Link href="/contacto" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">Contacto</Link>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-white/20 uppercase tracking-widest mb-4">Legal</p>
                <div className="space-y-2">
                  <Link href="/terminos" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">Términos y condiciones</Link>
                  <a href="/terminos" className="block text-xs text-gray-600 hover:text-gray-400 transition-colors">Política de privacidad</a>
                </div>
                <div className="mt-6 pt-4 border-t border-white/5">
                  <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Garantías</p>
                  <a href="mailto:garantias@martillo.cl" className="text-xs text-amber-500/50 hover:text-amber-400 transition-colors">garantias@martillo.cl</a>
                </div>
              </div>
            </div>
            <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-[11px] text-gray-700 tracking-wider">© 2025 Martillo SpA · RUT 77.123.456-7 · Santiago de Chile</p>
              <p className="text-[11px] text-gray-700">info@martillo.cl · +56 2 2580 9200</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="border border-white/5 rounded-lg p-16 text-center">
      <p className="text-gray-700 text-sm tracking-wider uppercase">
        No hay remates de {type === 'auto' ? 'automóviles' : 'viviendas'} activos en este momento
      </p>
    </div>
  )
}
