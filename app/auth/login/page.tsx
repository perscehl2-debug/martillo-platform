'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const params = useSearchParams()
  const redirect = params.get('redirect') || '/'
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push(redirect)
    router.refresh()
  }

  return (
    <div className="border border-white/10 rounded-xl p-8 bg-[#070b18]">
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-[#c8902a] focus:outline-none transition-colors"
            placeholder="tu@email.com" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-[#c8902a] focus:outline-none transition-colors"
            placeholder="••••••••" />
        </div>
        {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-3.5 bg-[#c8902a] hover:bg-[#e8a830] disabled:opacity-50 text-black font-black rounded-xl transition-all mt-2">
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-6">
        ¿Sin cuenta?{' '}
        <Link href="/auth/register" className="text-[#c8902a] hover:text-[#e8a830]">Registrarse gratis</Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-[#c8902a] rounded mx-auto mb-4 flex items-center justify-center text-black font-black">M</div>
          <h1 className="text-2xl font-black text-white">Iniciar sesión</h1>
          <p className="text-gray-500 text-sm mt-1">Accede a tu cuenta de Martillo</p>
        </div>
        <Suspense fallback={<div className="text-center text-gray-500">Cargando...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
