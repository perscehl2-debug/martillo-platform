import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '¿Quiénes somos? — Martillo Remates',
  description: 'Martillo es la primera plataforma digital de remates online de automóviles y viviendas en Chile. Transparencia, seguridad y eficiencia.',
}

const PILLARS = [
  {
    letter: 'T',
    title: 'Transparencia',
    desc: 'Todos los procesos, condiciones y políticas son públicos y claros. Publicamos reglas, plazos y montos de garantía antes de cada remate. Sin letra chica.',
  },
  {
    letter: 'S',
    title: 'Seguridad',
    desc: 'Operamos con respaldo institucional y legal en cada transacción. Todos los bienes cuentan con documentación verificada y nuestros procesos están respaldados legalmente.',
  },
  {
    letter: 'E',
    title: 'Eficiencia',
    desc: 'Tecnología de punta para que cada remate sea rápido y confiable. Plataforma en tiempo real con actualizaciones instantáneas de ofertas y notificaciones automáticas.',
  },
  {
    letter: 'T',
    title: 'Trayectoria',
    desc: 'Equipo especializado en subastas con experiencia en el mercado chileno. Conocemos la industria automotriz e inmobiliaria y operamos con los más altos estándares.',
  },
]

export default function QuienesSomosPage() {
  return (
    <div className="min-h-screen bg-[#04060d] pt-20 pb-24">

      {/* Hero */}
      <div className="relative h-72 md:h-96 overflow-hidden">
        <img
          src="/images/auctions/casa.png"
          alt="Martillo Remates"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#04060d]/40 via-[#04060d]/20 to-[#04060d]" />
        <div className="absolute bottom-0 left-0 right-0 px-6 md:px-12 pb-12 max-w-screen-lg mx-auto w-full">
          <p className="text-[10px] tracking-[0.4em] text-amber-500/70 uppercase font-mono mb-3">Martillo SpA · Santiago, Chile</p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">¿Quiénes somos?</h1>
        </div>
      </div>

      <div className="max-w-screen-lg mx-auto px-6 md:px-12">

        {/* Mission */}
        <div className="py-16 border-b border-white/6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-gray-300 text-lg leading-relaxed mb-6">
                Martillo es la primera plataforma digital de remates online de automóviles y viviendas en Chile, diseñada para conectar compradores y vendedores en un entorno de subasta online totalmente transparente y en tiempo real.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed">
                Creemos que las subastas deben ser accesibles, justas y seguras para todos. Por eso construimos una plataforma donde cada proceso — desde la publicación del lote hasta la transferencia del bien — está documentado, verificado y disponible para todos los participantes.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '+500', label: 'Lotes subastados' },
                { value: '$4.800M', label: 'CLP transaccionados' },
                { value: '3.500+', label: 'Compradores activos' },
                { value: '98%', label: 'Adjudicaciones exitosas' },
              ].map(s => (
                <div key={s.label} className="border border-white/6 rounded-lg p-5 text-center">
                  <p className="text-2xl font-black text-white mb-1">{s.value}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pillars */}
        <div className="py-16 border-b border-white/6">
          <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-14 font-mono">Nuestros valores</p>
          <div className="grid sm:grid-cols-2 gap-6">
            {PILLARS.map((p) => (
              <div key={p.title} className="border border-white/6 rounded-lg p-8 hover:border-white/12 transition-colors">
                <div className="w-10 h-10 border border-amber-500/30 rounded flex items-center justify-center text-amber-400 font-black text-lg mb-6">
                  {p.letter}
                </div>
                <h3 className="text-white font-bold text-lg mb-3">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How we operate */}
        <div className="py-16 border-b border-white/6">
          <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-12 font-mono">Cómo operamos</p>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Verificación de lotes</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Cada bien publicado en Martillo pasa por un proceso de verificación documental antes de salir a remate. Vehículos con revisión técnica, propiedades con estudio de títulos.
              </p>
            </div>
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Garantías de participación</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                El sistema de abono previo garantiza la seriedad de los participantes y protege a vendedores de ofertas sin respaldo. Si no adjudicas, recuperas el 100% de tu garantía.
              </p>
            </div>
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Proceso post-remate</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Al adjudicar, te enviamos las instrucciones de pago en menos de 4 horas. Coordinamos la entrega o transferencia legal del bien con el apoyo de nuestro equipo.
              </p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="py-16 border-b border-white/6">
          <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-12 font-mono">Contacto</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-5">
              {[
                ['Dirección', 'Av. Providencia 1234, Piso 8, Santiago, Chile'],
                ['Teléfono', '+56 2 2580 9200'],
                ['Email general', 'info@martillo.cl'],
                ['Email garantías', 'garantias@martillo.cl'],
                ['Horario de atención', 'Lunes a Viernes, 9:00 – 18:00 hrs'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-6 border-b border-white/5 pb-4">
                  <dt className="text-gray-600 text-xs uppercase tracking-widest w-36 flex-shrink-0 pt-0.5">{label}</dt>
                  <dd className="text-white text-sm">{value}</dd>
                </div>
              ))}
            </div>
            <div className="border border-white/6 rounded-lg p-7">
              <p className="text-xs text-white/30 uppercase tracking-widest mb-5">Horarios de remates</p>
              <div className="space-y-3 text-sm">
                {[
                  ['Lunes', 'Devolución de garantías (tarde)'],
                  ['Martes y Jueves', 'Exhibición de lotes, 9:00 – 18:00'],
                  ['Miércoles', 'Remate online en vivo, 10:00 AM'],
                  ['Viernes', 'Cierre Marketplace, 10:00 AM'],
                ].map(([day, info]) => (
                  <div key={day} className="flex justify-between gap-4 border-b border-white/5 pb-3">
                    <span className="text-amber-400/70 font-medium">{day}</span>
                    <span className="text-gray-400 text-right">{info}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="py-12 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <p className="text-white font-bold text-lg mb-1">¿Querés vender tus bienes a través de Martillo?</p>
            <p className="text-gray-500 text-sm">Contáctanos y te explicamos cómo publicar tus lotes.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/contacto"
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm rounded tracking-wider uppercase transition-all">
              Contáctanos
            </Link>
            <Link href="/como-funciona"
              className="px-6 py-3 border border-white/10 hover:border-white/20 text-white text-sm font-semibold rounded tracking-wider uppercase transition-all">
              Cómo funciona
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
