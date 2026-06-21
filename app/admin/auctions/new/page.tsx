'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NewAuctionPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])

  const [form, setForm] = useState({
    type: 'auto' as 'auto' | 'vivienda',
    title: '',
    description: '',
    base_price: '',
    ends_at: '',
    status: 'draft' as string,
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setImageUploading(true)

    const urls: string[] = []
    for (const file of Array.from(files)) {
      const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      const { data, error } = await supabase.storage.from('auction-images').upload(filename, file)
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from('auction-images').getPublicUrl(data.path)
        urls.push(publicUrl)
      }
    }
    setImageUrls(prev => [...prev, ...urls])
    setImageUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('No autenticado'); setLoading(false); return }

    const { error } = await supabase.from('auctions').insert({
      type: form.type,
      title: form.title,
      description: form.description,
      base_price: parseFloat(form.base_price),
      current_price: parseFloat(form.base_price),
      ends_at: new Date(form.ends_at).toISOString(),
      status: form.status,
      image_urls: imageUrls,
      created_by: user.id,
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Nuevo remate</h1>
        <p className="text-gray-500 text-sm mt-1">Completa los datos para publicar un nuevo remate</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-[#070b18] border border-white/10 rounded-xl p-6">
        {/* Type */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">Tipo</label>
          <div className="flex gap-3">
            {(['auto', 'vivienda'] as const).map(t => (
              <button type="button" key={t}
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all border ${
                  form.type === t ? 'bg-[#c8902a] border-[#c8902a] text-black' : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                }`}>
                {t === 'auto' ? '🚗 Auto' : '🏠 Vivienda'}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Título *</label>
          <input type="text" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#c8902a] focus:outline-none"
            placeholder="Ej: Ferrari 458 Italia 2013 — 570 CV" />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Descripción</label>
          <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#c8902a] focus:outline-none resize-none"
            placeholder="Describe el artículo en detalle..." />
        </div>

        {/* Price */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Precio base (CLP) *</label>
          <input type="number" required min={0} value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#c8902a] focus:outline-none"
            placeholder="180000000" />
        </div>

        {/* Ends at */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Fecha y hora de cierre *</label>
          <input type="datetime-local" required value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#c8902a] focus:outline-none" />
        </div>

        {/* Status */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Estado</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-[#c8902a] focus:outline-none">
            <option value="draft">Borrador</option>
            <option value="scheduled">Programado</option>
            <option value="live">En vivo</option>
          </select>
        </div>

        {/* Images */}
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Imágenes</label>
          <div className="border border-dashed border-white/20 rounded-lg p-6 text-center hover:border-[#c8902a]/40 transition-colors">
            <input type="file" accept="image/*" multiple onChange={handleImageUpload}
              className="hidden" id="image-upload" />
            <label htmlFor="image-upload" className="cursor-pointer">
              <p className="text-gray-500 text-sm">
                {imageUploading ? 'Subiendo...' : 'Clic para subir imágenes (o arrastrar)'}
              </p>
              <p className="text-xs text-gray-600 mt-1">PNG, JPG, WEBP · Máx 10MB por imagen</p>
            </label>
          </div>
          {imageUrls.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-16 h-12 object-cover rounded-lg" />
                  <button type="button" onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-3 border border-white/10 text-gray-400 hover:text-white rounded-xl text-sm transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading || imageUploading}
            className="flex-1 py-3 bg-[#c8902a] hover:bg-[#e8a830] disabled:opacity-50 text-black font-black rounded-xl text-sm transition-colors">
            {loading ? 'Guardando...' : 'Crear remate'}
          </button>
        </div>
      </form>
    </div>
  )
}
