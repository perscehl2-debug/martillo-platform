import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AuctionCard } from '@/components/auctions/AuctionCard'

const CarScene = dynamic(() => import('@/components/3d/CarScene').then(m => ({ default: m.CarScene })), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-[#050508] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#c8902a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm tracking-widest uppercase">Cargando escena</p>
      </div>
    </div>
  ),
})

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()
  const { data: autos } = await supabase.from('auctions').select('*').eq('type', 'auto').eq('status', 'live').order('ends_at', { ascending: true }).limit(4)
  const { data: viviendas } = await supabase.from('auctions').select('*').eq('type', 'vivienda').eq('status', 'live').order('ends_at', { ascending: true }).limit(4)

  return (
    <>
      <CarScene />
      <div className="bg-[#04060d]">
        {/* AUTOS */}
        <section className="max-w-7xl mx-auto px-4 py-24">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs tracking-[0.3em] text-[#c8902a] uppercase mb-3">Subastas activas</p>
              <h2 className="text-4xl font-black text-white">Autos en remate</h2>
            </div>
            <Link href="/auctions?type=auto" className="text-sm text-gray-400 hover:text-[#c8902a] transition-colors border border-white/10 hover:border-[#c8902a]/40 px-4 py-2 rounded-lg">Ver todos →</Link>
          </div>
          {autos && autos.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {autos.map(a => <AuctionCard key={a.id} auction={a} />)}
            </div>
          ) : (
            <div className="border border-white/10 rounded-xl p-12 text-center">
              <p className="text-4xl mb-4">🚗</p>
              <p className="text-gray-400">No hay remates de autos activos. Vuelve pronto.</p>
            </div>
          )}
        </section>

        <div className="max-w-7xl mx-auto px-4"><div className="border-t border-white/5" /></div>

        {/* VIVIENDAS */}
        <section className="max-w-7xl mx-auto px-4 py-24">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs tracking-[0.3em] text-[#c8902a] uppercase mb-3">Propiedades</p>
              <h2 className="text-4xl font-black text-white">Viviendas en remate</h2>
            </div>
            <Link href="/auctions?type=vivienda" className="text-sm text-gray-400 hover:text-[#c8902a] transition-colors border border-white/10 hover:border-[#c8902a]/40 px-4 py-2 rounded-lg">Ver todas →</Link>
          </div>
          {viviendas && viviendas.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {viviendas.map(a => <AuctionCard key={a.id} auction={a} />)}
            </div>
          ) : (
            <div className="border border-white/10 rounded-xl p-12 text-center">
              <p className="text-4xl mb-4">🏠</p>
              <p className="text-gray-400">No hay remates de viviendas activos.</p>
            </div>
          )}
        </section>

        {/* COMO FUNCIONA */}
        <section className="py-24 bg-[#070b18]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <p className="text-xs tracking-[0.3em] text-[#c8902a] uppercase mb-3">El proceso</p>
              <h2 className="text-4xl font-black text-white">Cómo funciona Martillo</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { n: '01', t: 'Regístrate', d: 'Crea tu cuenta en segundos. Verificación rápida y segura para participar en cualquier subasta.' },
                { n: '02', t: 'Explora y puja', d: 'Navega autos y viviendas. Haz tu oferta en tiempo real. Recibe alertas si te superan.' },
                { n: '03', t: 'Gana y cierra', d: 'Si ganas, te contactamos. Coordinamos transferencia y entrega con plena transparencia.' },
              ].map(s => (
                <div key={s.n} className="border border-white/10 rounded-xl p-8 relative overflow-hidden hover:border-[#c8902a]/30 transition-colors">
                  <div className="absolute top-4 right-4 text-7xl font-black text-[#c8902a]/8">{s.n}</div>
                  <div className="text-[#c8902a] text-sm font-bold mb-3">{s.n}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{s.t}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 text-center">
          <div className="max-w-2xl mx-auto px-4">
            <h2 className="text-5xl font-black text-white mb-6 leading-tight">Tu próxima compra<br /><span className="text-[#c8902a]">comienza acá.</span></h2>
            <p className="text-gray-400 mb-10 text-lg">Miles de compradores confían en Martillo para las mejores oportunidades.</p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/auth/register" className="px-8 py-4 bg-[#c8902a] hover:bg-[#e8a830] text-black font-black rounded-xl transition-all hover:scale-105">Crear cuenta gratis</Link>
              <Link href="/auctions" className="px-8 py-4 border border-white/10 hover:border-[#c8902a]/40 text-white font-semibold rounded-xl transition-all">Ver remates activos</Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/5 py-8">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#c8902a] rounded flex items-center justify-center text-black font-black text-xs">M</div>
              <span className="font-black text-sm">MARTILLO</span>
            </div>
            <p className="text-xs text-gray-600">© 2025 Martillo SpA · Santiago de Chile</p>
          </div>
        </footer>
      </div>
    </>
  )
}
