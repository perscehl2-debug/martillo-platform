import Link from 'next/link'
import { sesionSiniestros } from '@/lib/siniestros/servidor'

export const metadata = { title: 'Siniestros — Finiquitización SOAP' }

export default async function SiniestrosLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionSiniestros()
  if (!sesion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#04060d] px-4 pt-16">
        <div className="max-w-md rounded-xl border border-white/10 bg-[#070b18] p-8 text-center">
          <h1 className="mb-2 text-xl font-bold text-white">Sin acceso al módulo de siniestros</h1>
          <p className="text-sm text-gray-400">Tu cuenta no tiene un rol activo (liquidador, supervisor o administrativo). Solicita acceso a un supervisor.</p>
        </div>
      </div>
    )
  }
  const { usuario } = sesion
  const nav = [
    { href: '/siniestros', label: 'Bandeja de casos' },
    { href: '/siniestros/nuevo', label: '+ Nuevo denuncio' },
    { href: '/siniestros/plazos', label: 'Plazos y alertas' },
    { href: '/siniestros/reglas', label: 'Reglas de productos' },
  ]
  return (
    <div className="min-h-screen bg-[#04060d] pt-16">
      <div className="lg:flex">
        <aside className="border-b border-white/5 bg-[#070b18] p-4 lg:fixed lg:bottom-0 lg:left-0 lg:top-16 lg:w-56 lg:border-b-0 lg:border-r">
          <div className="mb-4 px-2">
            <p className="text-xs uppercase tracking-widest text-gray-600">Siniestros · SOAP</p>
            <p className="mt-2 truncate text-sm text-white">{usuario.nombre}</p>
            <p className="text-xs capitalize text-[#c8902a]">{usuario.rol}</p>
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
            {nav.map(item => (
              <Link key={item.href} href={item.href} className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 lg:ml-56 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
