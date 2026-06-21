'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Auction, Bid } from '@/types'

interface BidFormProps {
  auction: Auction
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export function BidForm({ auction }: BidFormProps) {
  const [currentPrice, setCurrentPrice] = useState(auction.current_price || auction.base_price)
  const [bids, setBids] = useState<Bid[]>([])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const supabase = createClient()

  const minBid = currentPrice + 100000 // Min increment: $100k CLP

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const loadBids = useCallback(async () => {
    const { data } = await supabase
      .from('bids')
      .select('*, profiles(email, full_name)')
      .eq('auction_id', auction.id)
      .order('amount', { ascending: false })
      .limit(10)
    if (data) setBids(data)
  }, [auction.id])

  useEffect(() => {
    loadBids()

    // Realtime subscription
    const channel = supabase
      .channel(`auction-${auction.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bids',
        filter: `auction_id=eq.${auction.id}`,
      }, (payload) => {
        const newBid = payload.new as Bid
        setCurrentPrice(prev => Math.max(prev, newBid.amount))
        setBids(prev => [newBid, ...prev.slice(0, 9)])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [auction.id, loadBids])

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!user) { setError('Debes iniciar sesión para pujar'); return }

    const bidAmount = parseFloat(amount.replace(/\D/g, ''))
    if (isNaN(bidAmount) || bidAmount < minBid) {
      setError(`La oferta mínima es ${formatPrice(minBid)}`); return
    }

    setLoading(true)
    const { error: bidError } = await supabase.from('bids').insert({
      auction_id: auction.id,
      user_id: user.id,
      amount: bidAmount,
    })

    if (bidError) {
      setError(bidError.message || 'Error al realizar la oferta')
    } else {
      setSuccess(`¡Oferta de ${formatPrice(bidAmount)} registrada!`)
      setAmount('')
      setCurrentPrice(bidAmount)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Current price */}
      <div className="glass rounded-xl p-5 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Oferta actual</p>
        <p className="text-4xl font-black text-[#c8902a]">{formatPrice(currentPrice)}</p>
        <p className="text-xs text-gray-500 mt-1">Precio base: {formatPrice(auction.base_price)}</p>
      </div>

      {/* Bid form */}
      {auction.status === 'live' ? (
        <form onSubmit={handleBid} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">
              Tu oferta (mínimo {formatPrice(minBid)})
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={minBid}
              step={100000}
              placeholder={String(minBid)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-[#c8902a] focus:outline-none transition-colors text-lg font-bold"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-400 text-sm">{success}</p>}

          {user ? (
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#c8902a] hover:bg-[#e8a830] disabled:opacity-50 text-black font-black text-sm rounded-xl transition-colors"
            >
              {loading ? 'ENVIANDO...' : 'HACER OFERTA'}
            </button>
          ) : (
            <a href="/auth/login"
              className="block text-center w-full py-4 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl transition-colors">
              Iniciar sesión para pujar
            </a>
          )}
        </form>
      ) : (
        <div className="glass rounded-xl p-4 text-center text-gray-400 text-sm">
          Este remate ha {auction.status === 'ended' ? 'finalizado' : 'cerrado'}
        </div>
      )}

      {/* Bid history */}
      {bids.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs text-gray-400 uppercase tracking-widest">Últimas ofertas</h3>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {bids.map((bid, i) => (
              <div key={bid.id}
                className={`flex justify-between items-center py-2 px-3 rounded-lg text-sm ${i === 0 ? 'bg-[#c8902a]/10 border border-[#c8902a]/20' : 'bg-white/3'}`}>
                <span className="text-gray-400 truncate max-w-[60%]">
                  {bid.profiles?.email?.split('@')[0] ?? 'Usuario'}
                  {i === 0 && <span className="ml-1 text-[#c8902a] text-xs">★ Lider</span>}
                </span>
                <span className={`font-bold tabular-nums ${i === 0 ? 'text-[#c8902a]' : 'text-white'}`}>
                  {formatPrice(bid.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
