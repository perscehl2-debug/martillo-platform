'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function EditAuctionPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'auto', title: '', description: '', base_price: '', ends_at: '', status: 'draft',
  })

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('auctions').select('*').eq('id', id).single()
      if (data) {
        setForm({
          type: data.type,
          title: data.title,
          description: data.description || '',
          base_price: String(data.base_price),
          ends_at: new Date(data.ends_at).toISOString().slice(0, 16),
          status: data.status,
        })
      }
      setFetching(false)
    }
    load()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('auctions').update({
      type: form.type,
      title: form.title,
      description: form.description,
      base_price: parseFloat(form.base_price),
      ends_at: new Date(form.ends_at).toISOString(),
      status: form.status,
    }).eq('id', id as string)

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/admin/auctions')
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este remate? Esta acción no se puede deshacer.')) return
    await supabase.from('auctions').delete().eq('id', id as string)
    router.push('/admin/auctions')
    router.refresh()
  }

  if (fetching) return <div className="text-gray-500 py-12 text-center">Cargando...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-white">Editar remate</h1>
        <button onClick={handleDelete} className="px-4 py-2 text-sm text-red-400 hover:text-red-300 border border-red-400/20 hover:border-red-400/40 rounded-lg transition-colors">
          Eliminar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 bg-[#070b18] border border-white/10 rounded-xl p-6">
        <div>
          <label className="text-xs text-gray-400 block mb-2">Tipo</label>
          <div className="flex gap-3">
            {(['auto', 'vivienda'] as const).map(t => (
              <button type="button" key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${form.type === t ? 'bg-[#c8902a] border-[#c8902a] text-black' : 'bg-white/5 border-white/10 text-gray-300'}`}>
                {t === 'auto' ? '🚗 Auto' : '🏠 Vivienda'}
              </button>
            ))}
          </div>
        </div>

        {[
          { key: 'title', label: 'Título', type: 'text' },
          { key: 'base_price', label: 'Precio base (CLP)', type: 'number' },
          { key: 'ends_at', label: 'Cierra el', type: 'datetime-local' },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs text-gray-400 block mb-1.5">{f.label}</label>
            <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#c8902a] focus:outline-none" />
          </div>
        ))}

        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Descripción</label>
          <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#c8902a] focus:outline-none resize-none" />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Estado</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#c8902a] focus:outline-none">
            <option value="draft">Borrador</option>
            <option value="scheduled">Programado</option>
            <option value="live">En vivo</option>
            <option value="ended">Finalizado</option>
            <option value="sold">Vendido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-3 border border-white/10 text-gray-400 rounded-xl text-sm">Cancelar</button>
          <button type="submit" disabled={loading} className="flex-1 py-3 bg-[#c8902a] hover:bg-[#e8a830] disabled:opacity-50 text-black font-black rounded-xl text-sm">
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
