import Link from 'next/link'
import type { Metadata } from 'next'
import { FAQAccordion } from '@/components/ui/FAQAccordion'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes — Martillo Remates',
  description: 'Todo lo que necesitas saber para participar en los remates de Martillo. Abono, proceso, adjudicación y más.',
}

const FAQS = [
  {
    q: '¿Qué es un remate Martillo?',
    a: 'Un remate Martillo es una subasta online en tiempo real donde los participantes compiten por adjudicarse un bien (vehículo, propiedad u otro) mediante ofertas progresivas. El participante con la oferta más alta al cierre del remate es el ganador.',
  },
  {
    q: '¿Cómo me registro para participar?',
    a: 'Ve a la sección de registro en martillo.cl, ingresa tu email y crea una contraseña. El proceso toma menos de 2 minutos. Una vez registrado, deberás transferir tu garantía para poder participar en cualquier remate.',
  },
  {
    q: '¿Qué es el abono y cuánto es?',
    a: 'El abono es una garantía de seriedad que debes transferir previamente para poder participar en el remate. El monto varía según el tipo de bien: vehículos $250.000 CLP, propiedades $500.000 CLP, maquinaria $300.000 CLP. Si no adjudicas, te devolvemos el 100% el lunes siguiente.',
  },
  {
    q: '¿Qué pasa si no adjudico? ¿Me devuelven el abono?',
    a: 'Sí, si no resultas ganador del remate, te devolvemos el 100% de tu garantía. La devolución se procesa el lunes siguiente al día del remate, mediante transferencia bancaria a la misma cuenta desde la que realizaste el abono.',
  },
  {
    q: '¿Cuándo se devuelve el abono si no adjudiqué?',
    a: 'El reembolso de la garantía se realiza el lunes siguiente al día del remate, en el transcurso de la tarde. Si para el martes no has recibido la transferencia, contáctanos a garantias@martillo.cl con tu comprobante de abono.',
  },
  {
    q: '¿Cómo sé si gané el remate?',
    a: 'Al cierre del remate, el sistema identifica automáticamente al mejor postor. Si eres el ganador, recibirás un email de confirmación con las instrucciones de pago dentro de las 4 horas siguientes al cierre.',
  },
  {
    q: '¿Cuáles son los medios de pago aceptados?',
    a: 'Aceptamos transferencia bancaria y cheque certificado. Para montos mayores, también coordinamos con el comprador otras modalidades. El pago del saldo debe completarse dentro de los plazos indicados en las instrucciones que recibirás al adjudicar.',
  },
  {
    q: '¿Puedo ver el bien antes del remate?',
    a: 'Sí. Organizamos sesiones de exhibición antes de cada remate para que puedas inspeccionar los bienes en persona. Consulta el calendario de exhibiciones en cada lote publicado o en nuestra página de contacto.',
  },
  {
    q: '¿Qué documentos necesito para retirar un vehículo adjudicado?',
    a: 'Para retirar un vehículo necesitas: cédula de identidad vigente, comprobante de pago total, y poder notarial si retira una tercera persona. Nuestro equipo te informará los documentos específicos según el tipo de bien al momento de la adjudicación.',
  },
  {
    q: '¿Qué pasa si el ganador no paga?',
    a: 'Si el adjudicatario no completa el pago en los plazos establecidos, pierde el derecho de adjudicación y la garantía transferida. El bien puede ser ofrecido al segundo mejor postor o salir a remate nuevamente según criterio de Martillo.',
  },
  {
    q: '¿Puedo vender mis bienes a través de Martillo?',
    a: 'Sí, trabajamos con vendedores institucionales y particulares. Si tienes vehículos, propiedades u otros bienes que quieras comercializar a través de nuestros remates, contáctanos a ventas@martillo.cl.',
  },
  {
    q: '¿Los bienes tienen garantía post-venta?',
    a: 'Los bienes se venden en el estado en que se encuentran al momento del remate ("as is"), salvo lo indicado explícitamente en la ficha de cada lote. Te recomendamos inspeccionar cada bien durante el período de exhibición antes de participar.',
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#04060d] pt-20 pb-24">
      <div className="max-w-screen-md mx-auto px-6 md:px-12">
        <div className="pt-16 pb-14 border-b border-white/6">
          <p className="text-[10px] tracking-[0.4em] text-amber-500/60 uppercase mb-5 font-mono">Soporte</p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-5">Preguntas frecuentes</h1>
          <p className="text-gray-400 text-base leading-relaxed">
            Todo lo que necesitas saber para participar en los remates de Martillo.
          </p>
        </div>

        <div className="py-14">
          <FAQAccordion items={FAQS} />
        </div>

        <div className="py-12 border-t border-white/6">
          <p className="text-white font-bold mb-2">¿No encontraste lo que buscabas?</p>
          <p className="text-gray-500 text-sm mb-6">Escríbenos y te respondemos a la brevedad.</p>
          <div className="flex gap-3 flex-wrap">
            <Link href="/contacto"
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-sm rounded tracking-wider uppercase transition-all">
              Contactar
            </Link>
            <Link href="/como-funciona"
              className="px-6 py-3 border border-white/10 hover:border-white/20 text-white text-sm font-semibold rounded tracking-wider uppercase transition-all">
              Ver guía completa
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
