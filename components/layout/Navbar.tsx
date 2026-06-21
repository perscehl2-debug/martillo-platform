'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setIsAdmin(data?.role === 'admin')
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setIsAdmin(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-[#04060d]/95 backdrop-blur-md border-b border-[#c8902a]/20' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#c8902a] rounded flex items-center justify-center text-black font-black text-sm">M</div>
          <span className="font-black text-lg tracking-tight text-white">MARTILLO</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-6">
          <Link href="/auctions?type=auto" className="text-sm text-gray-400 hover:text-white transition-colors">
            Autos
          </Link>
          <Link href="/auctions?type=vivienda" className="text-sm text-gray-400 hover:text-white transition-colors">
            Viviendas
          </Link>
          <Link href="/auctions" className="text-sm text-gray-400 hover:text-white transition-colors">
            Remates
          </Link>
          <Link href="/como-funciona" className="text-sm text-gray-400 hover:text-white transition-colors">
            ¿Cómo funciona?
          </Link>
          <Link href="/quienes-somos" className="text-sm text-gray-400 hover:text-white transition-colors">
            Quiénes somos
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-sm text-[#c8902a] hover:text-[#e8a830] transition-colors">
              Admin
            </Link>
          )}
        </div>

        {/* Auth */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-xs text-gray-500 hidden lg:block">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-sm px-4 py-2 rounded border border-[#c8902a]/40 text-gray-300 hover:text-white hover:border-[#c8902a] transition-all"
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2">
                Iniciar sesión
              </Link>
              <Link href="/auth/register"
                className="text-sm px-4 py-2 bg-[#c8902a] text-black font-semibold rounded hover:bg-[#e8a830] transition-all">
                Registrarse
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-white p-2" onClick={() => setMenuOpen(!menuOpen)}>
          <div className="space-y-1.5">
            <span className="block w-6 h-0.5 bg-white"/>
            <span className="block w-6 h-0.5 bg-white"/>
            <span className="block w-4 h-0.5 bg-white"/>
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-[#070b18] border-t border-[#c8902a]/20 px-4 py-4 space-y-3">
          <Link href="/auctions?type=auto" className="block text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Autos</Link>
          <Link href="/auctions?type=vivienda" className="block text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Viviendas</Link>
          <Link href="/auctions" className="block text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Todos los remates</Link>
          <Link href="/como-funciona" className="block text-gray-300 py-2" onClick={() => setMenuOpen(false)}>¿Cómo funciona?</Link>
          <Link href="/quienes-somos" className="block text-gray-300 py-2" onClick={() => setMenuOpen(false)}>Quiénes somos</Link>
          <Link href="/preguntas-frecuentes" className="block text-gray-300 py-2" onClick={() => setMenuOpen(false)}>FAQ</Link>
          {isAdmin && <Link href="/admin" className="block text-[#c8902a] py-2" onClick={() => setMenuOpen(false)}>Panel Admin</Link>}
          {user ? (
            <button onClick={handleSignOut} className="block text-gray-400 py-2 w-full text-left">Cerrar sesión</button>
          ) : (
            <div className="flex gap-3 pt-2">
              <Link href="/auth/login" className="flex-1 text-center py-2 border border-[#c8902a]/40 rounded text-sm text-gray-300" onClick={() => setMenuOpen(false)}>Iniciar sesión</Link>
              <Link href="/auth/register" className="flex-1 text-center py-2 bg-[#c8902a] rounded text-sm text-black font-semibold" onClick={() => setMenuOpen(false)}>Registrarse</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
