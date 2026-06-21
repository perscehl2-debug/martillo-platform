import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#04060d] pt-16">
      {/* Admin sidebar */}
      <div className="flex">
        <aside className="w-56 fixed left-0 top-16 bottom-0 bg-[#070b18] border-r border-white/5 p-4">
          <div className="mb-6 px-2">
            <p className="text-xs text-gray-600 uppercase tracking-widest">Panel Admin</p>
          </div>
          <nav className="space-y-1">
            {[
              { href: '/admin', label: 'Dashboard' },
              { href: '/admin/auctions', label: 'Remates' },
              { href: '/admin/auctions/new', label: '+ Nuevo remate' },
              { href: '/', label: '← Volver al sitio' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="block px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="ml-56 flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
