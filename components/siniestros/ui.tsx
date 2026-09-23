import type { ReactNode } from 'react'
import type { EstadoPlazo } from '@/lib/siniestros/plazos'

export const clp = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `$${Math.round(Number(n)).toLocaleString('es-CL')}`)
export const uf = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${Number(n).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`

const COLORES = {
  verde: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  amarillo: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  rojo: 'bg-red-500/10 text-red-300 border-red-500/30',
  azul: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  gris: 'bg-white/5 text-gray-400 border-white/10',
} as const

export function Chip({ color = 'gris', children }: { color?: keyof typeof COLORES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${COLORES[color]}`}>{children}</span>
}

const PLAZO: Record<EstadoPlazo, { color: keyof typeof COLORES; texto: string }> = {
  cumplido: { color: 'verde', texto: 'Cumplido' },
  cumplido_fuera_plazo: { color: 'rojo', texto: 'Cumplido fuera de plazo' },
  vencido: { color: 'rojo', texto: 'Vencido' },
  critico: { color: 'rojo', texto: 'Crítico' },
  proximo: { color: 'amarillo', texto: 'Próximo' },
  en_plazo: { color: 'verde', texto: 'En plazo' },
}

export function ChipPlazo({ estado, dias }: { estado: EstadoPlazo; dias: number }) {
  const p = PLAZO[estado]
  const sufijo = estado === 'cumplido' || estado === 'cumplido_fuera_plazo' ? '' : dias < 0 ? ` (${-dias} d atrás)` : ` (${dias} d)`
  return <Chip color={p.color}>{p.texto}{sufijo}</Chip>
}

const REQUISITO = {
  pendiente: { color: 'gris', texto: 'Pendiente' },
  recibido: { color: 'azul', texto: 'Recibido' },
  validado: { color: 'verde', texto: 'Validado' },
  rechazado: { color: 'rojo', texto: 'Rechazado' },
} as const

export function ChipRequisito({ estado }: { estado: keyof typeof REQUISITO }) {
  return <Chip color={REQUISITO[estado].color}>{REQUISITO[estado].texto}</Chip>
}

export const ESTADOS_CASO: Record<string, string> = {
  recepcion: 'Recepción',
  en_analisis: 'En análisis',
  preinforme: 'Preinforme',
  informe_emitido: 'Informe emitido',
  impugnado: 'Impugnado',
  finiquito: 'Finiquito',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
  cerrado: 'Cerrado',
}

export function Tarjeta({ titulo, acciones, children, className = '' }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-[#070b18] ${className}`}>
      {(titulo || acciones) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3">
          <h2 className="font-bold text-white">{titulo}</h2>
          {acciones}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export const inputCls =
  'w-full rounded-lg border border-white/10 bg-[#04060d] px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-[#c8902a] focus:outline-none'
export const botonCls =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#c8902a] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#e8a830] disabled:cursor-not-allowed disabled:opacity-50'
export const botonSecCls =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-gray-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50'
