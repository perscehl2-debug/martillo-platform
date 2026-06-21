'use client'
import Link from 'next/link'
import { Auction } from '@/types'
import { useEffect, useState } from 'react'

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Finalizado'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return <span className="text-[#c8902a] font-mono text-sm font-bold">{timeLeft}</span>
}

export function AuctionCard({ auction }: { auction: Auction }) {
  const img = auction.image_urls?.[0] || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600'
  const isAuto = auction.type === 'auto'

  return (
    <Link href={`/auctions/${auction.id}`}>
      <div className="group rounded-xl overflow-hidden border border-white/10 bg-[#070b18] card-hover hover:border-[#c8902a]/40 cursor-pointer">
        {/* Image */}
        <div className="relative h-52 overflow-hidden">
          <img src={img} alt={auction.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b18] via-transparent" />

          {/* Type badge */}
          <div className="absolute top-3 left-3">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAuto ? 'bg-blue-900/80 text-blue-300' : 'bg-emerald-900/80 text-emerald-300'}`}>
              {isAuto ? '🚗 AUTO' : '🏠 VIVIENDA'}
            </span>
          </div>

          {/* Status */}
          {auction.status === 'live' && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-900/80 text-red-300 text-xs px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              EN VIVO
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4">
          <h3 className="font-semibold text-white text-sm leading-snug mb-3 line-clamp-2">{auction.title}</h3>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Oferta actual</span>
              <span className="text-[#c8902a] font-bold text-sm">{formatPrice(auction.current_price || auction.base_price)}</span>
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-2">
              <span className="text-xs text-gray-500">Cierra en</span>
              <Countdown endsAt={auction.ends_at} />
            </div>
          </div>

          <button className="mt-4 w-full py-2.5 bg-[#c8902a] hover:bg-[#e8a830] text-black text-xs font-bold rounded-lg transition-colors">
            PUJAR AHORA
          </button>
        </div>
      </div>
    </Link>
  )
}
