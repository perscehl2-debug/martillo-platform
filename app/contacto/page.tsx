import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contacto — Martillo Remates',
  description: 'Contáctanos para consultas sobre remates, garantías, venta de bienes y más.',
}

const CONTACTS = [
  { label: 'Información general', email: 'info@martillo.cl', desc: 'Consultas sobre la plataforma, registro y remates' },
  { label: 'Garantías y abonos', email: 'garantias@martillo.cl', desc: 'Comprobantes de transferencia y devoluciones' },
  { label: 'Vender con nosotros', email: 'ventas@martillo.cl', desc: 'Publicar tus bienes en nuestros remates' },
  { label: 'Soporte técnico', email: 'soporte@martillo.cl', desc: 'Problemas con la plataforma o tu cuenta' },
]

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-[#04060d] pt-20 pb-24">
      <div className="max-w-screen-lg mx-auto px-6 md:px-12">

        <div className="pt-16 pb-14 border-b border-white/6">
          <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-5 font-mono">Atención al cliente</p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-5">Contacto</h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-xl">
            Estamos disponibles de lunes a viernes de 9:00 a 18:00 hrs. Responderemos tu consulta en un plazo máximo de 24 horas hábiles.
          </p>
        </div>

        <div className="py-16">
          <div className="grid md:grid-cols-2 gap-8">

            {/* Contact cards */}
            <div className="space-y-4">
              <p className="text-xs text-white/30 uppercase tracking-widest mb-7">Canales de contacto</p>
              {CONTACTS.map((c) => (
                <a key={c.email} href={`mailto:${c.email}`}
                  className="block border border-white/6 rounded-lg p-6 hover:border-amber-500/20 hover:bg-amber-500/3 transition-all group">
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">{c.label}</p>
                  <p className="text-amber-400 font-medium group-hover:text-amber-300 transition-colors mb-1">{c.email}</p>
                  <p className="text-gray-500 text-xs">{c.desc}</p>
                </a>
              ))}
            </div>

            {/* Office + schedule */}
            <div className="space-y-6">
              <div className="border border-white/6 rounded-lg p-7">
                <p className="text-xs text-white/30 uppercase tracking-widest mb-6">Oficina central</p>
                <dl className="space-y-4">
                  {[
                    ['Dirección', 'Av. Providencia 1234, Piso 8\nProvidencia, Santiago'],
                    ['Teléfono', '+56 2 2580 9200'],
                    ['Horario oficina', 'Lun–Vie, 9:00 – 18:00 hrs'],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-white/5 pb-4">
                      <dt className="text-gray-600 text-xs uppercase tracking-widest mb-1">{label}</dt>
                      <dd className="text-white text-sm whitespace-pre-line">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="border border-white/6 rounded-lg p-7">
                <p className="text-xs text-white/30 uppercase tracking-widest mb-6">Horarios de exhibición</p>
                <div className="space-y-3">
                  {[
                    ['Martes', '9:00 – 18:00 hrs'],
                    ['Miércoles', 'Remate online 10:00 AM'],
                    ['Jueves', '9:00 – 18:00 hrs'],
                    ['Viernes', 'Marketplace 10:00 AM'],
                    ['Lunes', 'Devolución de garantías (tarde)'],
                  ].map(([day, info]) => (
                    <div key={day} className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-amber-400/70 text-sm font-medium">{day}</span>
                      <span className="text-gray-400 text-sm">{info}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-amber-500/15 rounded-lg p-6 bg-amber-500/3">
                <p className="text-xs text-amber-500/60 uppercase tracking-widest mb-3">Para garantías</p>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Si ya realizaste tu abono, envía el comprobante a <strong className="text-amber-400">garantias@martillo.cl</strong> indicando tu nombre y el número de lote.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
