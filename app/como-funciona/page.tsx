import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '¿Cómo funciona? — Martillo Remates',
  description: 'Aprende cómo participar en los remates online de Martillo. Proceso de abono, pujas en tiempo real y adjudicación paso a paso.',
}

const STEPS = [
  {
    n: '01',
    title: 'Regístrate',
    desc: 'Crea tu cuenta en Martillo con tu email y contraseña. El proceso toma menos de 2 minutos. Si ya tienes cuenta, inicia sesión normalmente.',
    detail: null,
    highlight: false,
  },
  {
    n: '02',
    title: 'Transfiere tu garantía (Abono)',
    desc: 'Para participar en cualquier remate debes transferir una garantía antes de las 10:00 AM del día del remate. Sin garantía no es posible realizar ofertas.',
    detail: [
      'Si no adjudicas → devolvemos el 100% de tu abono el lunes siguiente',
      'Si adjudicas → el abono se descuenta del precio final',
    ],
    highlight: true,
  },
  {
    n: '03',
    title: 'Accede al remate en vivo',
    desc: 'El día del remate, ingresa desde tu cuenta al lote que te interesa y realiza tus ofertas en tiempo real. Puedes ofertar cuantas veces quieras aumentando el último valor.',
    detail: null,
    highlight: false,
  },
  {
    n: '04',
    title: 'Adjudicación',
    desc: 'Si tu oferta es la más alta al cierre del remate, eres el ganador. Recibirás las instrucciones de pago dentro de las 4 horas siguientes al cierre.',
    detail: null,
    highlight: false,
  },
  {
    n: '05',
    title: 'Pago y transferencia',
    desc: 'Completa el pago según las instrucciones recibidas. Nuestro equipo coordinará contigo la entrega o transferencia del bien adjudicado.',
    detail: null,
    highlight: false,
  },
]

const MODALITIES = [
  {
    title: 'Remate de Automóviles',
    abono: '$250.000 CLP',
    desc: 'Vehículos particulares, SUVs, camionetas, camiones, maquinaria y equipos. Todos con revisión técnica y documentación completa.',
    link: '/auctions?type=auto',
  },
  {
    title: 'Remate de Propiedades',
    abono: '$500.000 CLP',
    desc: 'Casas, departamentos, terrenos y propiedades comerciales. Todos los lotes cuentan con documentación legal verificada.',
    link: '/auctions?type=vivienda',
  },
  {
    title: 'Marketplace',
    abono: 'Próximamente',
    desc: 'Modalidad de precio fijo con remate en plataforma. La oferta más alta sostenida por 1 minuto adjudica el bien.',
    link: null,
  },
]

const ABONO_TABLE = [
  { tipo: 'Vehículos y automóviles', monto: '$250.000 CLP', plazo: 'Antes 10:00 AM del día del remate' },
  { tipo: 'Propiedades e inmuebles', monto: '$500.000 CLP', plazo: 'Antes 10:00 AM del día del remate' },
  { tipo: 'Maquinaria y equipos', monto: '$300.000 CLP', plazo: 'Antes 10:00 AM del día del remate' },
]

export default function ComoFuncionaPage() {
  return (
    <div className="min-h-screen bg-[#04060d] pt-20 pb-24">
      <div className="max-w-screen-lg mx-auto px-6 md:px-12">

        {/* Header */}
        <div className="pt-16 pb-16 border-b border-white/6">
          <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-5 font-mono">Proceso de remate</p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-5">¿Cómo funciona?</h1>
          <p className="text-gray-400 text-base md:text-lg max-w-2xl leading-relaxed">
            Martillo opera bajo un sistema de remates online en tiempo real. Para participar, debes registrarte y transferir una garantía previamente. El proceso es simple, transparente y seguro.
          </p>
        </div>

        {/* Steps */}
        <div className="py-20">
          <h2 className="text-xs tracking-[0.35em] text-amber-500/60 uppercase mb-14 font-mono">El proceso en 5 pasos</h2>
          <div className="space-y-8">
            {STEPS.map((step) => (
              <div key={step.n}
                className={`relative border rounded-lg p-7 md:p-9 transition-colors ${
                  step.highlight
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-white/6 hover:border-white/12'
                }`}>
                {step.highlight && (
                  <span className="absolute -top-px left-8 px-3 py-0.5 bg-amber-500 text-black text-[10px] font-black tracking-widest uppercase rounded-b-sm">
                    Importante
                  </span>
                )}
                <div className="flex gap-8 items-start">
                  <span className="text-4xl md:text-5xl font-black text-white/10 select-none leading-none flex-shrink-0 w-14">
                    {step.n}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-lg mb-3">{step.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">{step.desc}</p>
                    {step.detail && (
                      <ul className="space-y-2">
                        {step.detail.map((d, i) => (
                          <li key={i} className="text-sm text-amber-400/80 flex gap-2">
                            <span className="text-amber-500 flex-shrink-0">→</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modalities */}
        <div className="py-16 border-t border-white/6">
          <h2 className="text-xs tracking-[0.35em] text-amber-500/60 uppercase mb-12 font-mono">Modalidades de remate</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {MODALITIES.map((m) => (
              <div key={m.title} className="border border-white/6 rounded-lg p-7 hover:border-white/12 transition-colors">
                <p className="text-[10px] tracking-[0.3em] text-amber-500/60 uppercase font-mono mb-4">Abono requerido</p>
                <p className="text-2xl font-black text-amber-400 mb-5">{m.abono}</p>
                <h3 className="text-white font-bold mb-3">{m.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{m.desc}</p>
                {m.link ? (
                  <Link href={m.link}
                    className="text-xs text-white/50 hover:text-amber-400 tracking-widest uppercase transition-colors">
                    Ver remates activos →
                  </Link>
                ) : (
                  <span className="text-xs text-white/20 tracking-widest uppercase">Próximamente</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Abono table */}
        <div className="py-16 border-t border-white/6">
          <h2 className="text-xs tracking-[0.35em] text-amber-500/60 uppercase mb-12 font-mono">Montos de garantía por categoría</h2>
          <div className="border border-white/8 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/2">
                  <th className="text-left px-6 py-4 text-gray-500 font-medium tracking-wider text-xs uppercase">Tipo de bien</th>
                  <th className="text-left px-6 py-4 text-gray-500 font-medium tracking-wider text-xs uppercase">Abono requerido</th>
                  <th className="text-left px-6 py-4 text-gray-500 font-medium tracking-wider text-xs uppercase">Plazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ABONO_TABLE.map((row) => (
                  <tr key={row.tipo} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 text-white">{row.tipo}</td>
                    <td className="px-6 py-4 text-amber-400 font-bold font-mono">{row.monto}</td>
                    <td className="px-6 py-4 text-gray-400">{row.plazo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-600 mt-4 tracking-wide">
            * Si no adjudicas, el 100% de la garantía es devuelta el lunes siguiente al remate.
          </p>
        </div>

        {/* Bank transfer info */}
        <div className="py-16 border-t border-white/6">
          <h2 className="text-xs tracking-[0.35em] text-amber-500/60 uppercase mb-12 font-mono">Datos para transferir tu garantía</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-amber-500/20 rounded-lg p-7 bg-amber-500/3">
              <p className="text-xs text-amber-500/60 tracking-widest uppercase font-mono mb-6">Transferencia bancaria</p>
              <dl className="space-y-4">
                {[
                  ['Banco', 'Banco de Chile'],
                  ['Titular', 'Martillo SpA'],
                  ['RUT', '77.123.456-7'],
                  ['Tipo de cuenta', 'Cuenta Corriente'],
                  ['Número de cuenta', '123-456789'],
                  ['Email comprobante', 'garantias@martillo.cl'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center gap-4 border-b border-white/5 pb-3">
                    <dt className="text-gray-500 text-xs uppercase tracking-wider">{label}</dt>
                    <dd className="text-white font-medium text-sm">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="border border-white/6 rounded-lg p-7 flex flex-col justify-between">
              <div>
                <p className="text-xs text-amber-500/60 tracking-widest uppercase font-mono mb-6">Instrucciones</p>
                <ol className="space-y-4 text-sm text-gray-400">
                  <li className="flex gap-3">
                    <span className="text-amber-500 font-bold flex-shrink-0">1.</span>
                    Realiza la transferencia según los montos indicados para el tipo de bien que te interesa
                  </li>
                  <li className="flex gap-3">
                    <span className="text-amber-500 font-bold flex-shrink-0">2.</span>
                    Envía el comprobante a <strong className="text-white">garantias@martillo.cl</strong> indicando tu nombre y el lote
                  </li>
                  <li className="flex gap-3">
                    <span className="text-amber-500 font-bold flex-shrink-0">3.</span>
                    Recibirás confirmación por email y ya podrás participar en el remate
                  </li>
                  <li className="flex gap-3">
                    <span className="text-amber-500 font-bold flex-shrink-0">4.</span>
                    La garantía debe acreditarse antes de las <strong className="text-white">10:00 AM</strong> del día del remate
                  </li>
                </ol>
              </div>
              <div className="mt-8 pt-6 border-t border-white/6">
                <p className="text-xs text-gray-600 leading-relaxed">
                  ¿Tienes dudas sobre la transferencia? Contáctanos antes del remate a través de nuestra página de contacto o al email indicado.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="py-12 border-t border-white/6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <p className="text-white font-bold text-lg mb-1">¿Listo para participar?</p>
            <p className="text-gray-500 text-sm">Crea tu cuenta y encuentra tu próxima adjudicación.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link href="/auth/register"
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm rounded tracking-wider uppercase transition-all">
              Crear cuenta
            </Link>
            <Link href="/preguntas-frecuentes"
              className="px-6 py-3 border border-white/10 hover:border-white/20 text-white text-sm font-semibold rounded tracking-wider uppercase transition-all">
              Ver FAQ
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
