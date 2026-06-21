import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y condiciones — Martillo Remates',
  description: 'Términos y condiciones de uso de la plataforma Martillo Remates.',
}

const SECTIONS = [
  {
    title: '1. Aceptación de términos',
    content: `Al registrarte y participar en la plataforma Martillo, aceptas íntegramente estos Términos y Condiciones. Si no estás de acuerdo con alguna de las disposiciones aquí establecidas, no debes utilizar nuestros servicios.

Martillo SpA se reserva el derecho de modificar estos términos en cualquier momento. Los cambios serán informados mediante correo electrónico o a través del sitio web y entrarán en vigencia desde su publicación.`,
  },
  {
    title: '2. Registro y cuenta de usuario',
    content: `Para participar en los remates de Martillo debes crear una cuenta con información veraz y actualizada. Eres responsable de mantener la confidencialidad de tu contraseña y de todas las actividades realizadas desde tu cuenta.

Martillo se reserva el derecho de suspender o cancelar cuentas que incumplan estos términos, proporcionen información falsa, o realicen prácticas fraudulentas.`,
  },
  {
    title: '3. Garantía de participación (Abono)',
    content: `Para participar en cualquier remate es obligatorio transferir previamente una garantía según los montos establecidos por tipo de bien:

- Vehículos y automóviles: $250.000 CLP
- Propiedades e inmuebles: $500.000 CLP
- Maquinaria y equipos: $300.000 CLP

La garantía debe acreditarse antes de las 10:00 AM del día del remate. En caso de no adjudicar, se reembolsará el 100% el lunes siguiente al remate. En caso de adjudicar y no completar el pago en los plazos establecidos, la garantía queda a favor de Martillo sin derecho a devolución.`,
  },
  {
    title: '4. Proceso de remate y ofertas',
    content: `Las ofertas realizadas en la plataforma son irrevocables una vez confirmadas. El participante que realice la oferta más alta al cierre del remate queda obligado a completar la compra.

Martillo puede extender el tiempo de cierre de un remate si se reciben ofertas en los últimos minutos, a fin de asegurar condiciones justas para todos los participantes. El sistema notificará automáticamente al ganador dentro de las 4 horas siguientes al cierre.`,
  },
  {
    title: '5. Pago y adjudicación',
    content: `Al adjudicar un bien, el comprador recibirá instrucciones de pago por correo electrónico. El pago del saldo debe completarse en el plazo indicado en dichas instrucciones. Martillo acepta transferencia bancaria y cheque certificado como medios de pago.

El incumplimiento de los plazos de pago faculta a Martillo para anular la adjudicación, retener la garantía y ofrecer el bien a otros participantes o a un nuevo remate.`,
  },
  {
    title: '6. Estado de los bienes',
    content: `Los bienes subastados se ofrecen en el estado en que se encuentran al momento del remate ("as is"), salvo indicación expresa en la ficha del lote. Martillo facilita la exhibición previa de los bienes para que los interesados puedan inspeccionarlos.

Martillo no otorga garantías sobre el estado, funcionamiento, origen o legalidad de los bienes más allá de lo explícitamente indicado en cada lote. Es responsabilidad del comprador verificar la información durante el período de exhibición.`,
  },
  {
    title: '7. Responsabilidades y limitaciones',
    content: `Martillo actúa como intermediario en la transacción entre vendedor y comprador. La plataforma no es responsable por defectos ocultos en los bienes, conflictos entre las partes posteriores a la adjudicación, ni por daños derivados del uso de la plataforma.

La responsabilidad total de Martillo frente a cualquier reclamación no podrá exceder el monto de la garantía aportada por el reclamante.`,
  },
  {
    title: '8. Privacidad y protección de datos',
    content: `Martillo trata los datos personales de sus usuarios conforme a la Ley N° 19.628 sobre Protección de la Vida Privada vigente en Chile. Los datos recopilados se utilizan exclusivamente para la operación de la plataforma y no son cedidos a terceros sin consentimiento expreso.

Al registrarte, autorizas el envío de comunicaciones relacionadas con los remates y actualizaciones de la plataforma a tu correo electrónico.`,
  },
  {
    title: '9. Ley aplicable y jurisdicción',
    content: `Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia derivada de su interpretación o cumplimiento se someterá a la jurisdicción de los tribunales ordinarios de justicia de la ciudad de Santiago, con renuncia expresa a cualquier otro fuero que pudiera corresponder.`,
  },
]

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#04060d] pt-20 pb-24">
      <div className="max-w-screen-md mx-auto px-6 md:px-12">

        <div className="pt-16 pb-12 border-b border-white/6">
          <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-5 font-mono">Legal</p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-5">Términos y condiciones</h1>
          <p className="text-gray-500 text-sm">Última actualización: Junio 2025 · Martillo SpA · RUT 77.123.456-7</p>
        </div>

        <div className="py-14 space-y-12">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-white font-bold text-base mb-5">{s.title}</h2>
              <p className="text-gray-400 text-sm leading-loose whitespace-pre-line">{s.content}</p>
            </div>
          ))}
        </div>

        <div className="py-8 border-t border-white/6">
          <p className="text-gray-600 text-xs leading-relaxed">
            Para consultas sobre estos términos, contáctanos en <span className="text-amber-500/70">legal@martillo.cl</span> o visita nuestra página de{' '}
            <a href="/contacto" className="text-amber-500/70 hover:text-amber-400 transition-colors">contacto</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
