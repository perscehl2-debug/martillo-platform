'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })

    if (error) { setError(error.message); setLoading(false); return }

    // Update full_name in profile
    if (data.user) {
      await supabase.from('profiles').update({ full_name: fullName }).eq('id', data.user.id)
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-black text-white mb-3">¡Cuenta creada!</h1>
          <p className="text-gray-400 mb-6">Revisa tu email para confirmar tu cuenta y luego inicia sesión.</p>
          <Link href="/auth/login" className="inline-block px-6 py-3 bg-[#c8902a] text-black font-black rounded-xl hover:bg-[#e8a830] transition-colors">
            Ir al login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-[#c8902a] rounded mx-auto mb-4 flex items-center justify-center text-black font-black">M</div>
          <h1 className="text-2xl font-black text-white">Crear cuenta</h1>
          <p className="text-gray-500 text-sm mt-1">Únete a la plataforma de remates online</p>
        </div>

        <div className="border border-white/10 rounded-xl p-8 bg-[#070b18]">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Nombre completo</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-[#c8902a] focus:outline-none transition-colors"
                placeholder="Tu nombre" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-[#c8902a] focus:outline-none transition-colors"
                placeholder="tu@email.com" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1.5">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-[#c8902a] focus:outline-none transition-colors"
                placeholder="Mínimo 8 caracteres" />
            </div>
            {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-[#c8902a] hover:bg-[#e8a830] disabled:opacity-50 text-black font-black rounded-xl transition-all mt-2">
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
          <p className="text-xs text-gray-600 text-center mt-4">
            Al registrarte aceptas nuestros Términos de uso y Política de privacidad.
          </p>
          <p className="text-center text-sm text-gray-500 mt-4">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-[#c8902a] hover:text-[#e8a830]">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
