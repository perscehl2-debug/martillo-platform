// Utilidades de fechas en formato ISO (YYYY-MM-DD), calculadas en UTC para
// evitar corrimientos por zona horaria.
import feriadosCl from './feriados-cl.json'

const FERIADOS = new Set<string>(feriadosCl.fechas)

export function aFecha(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

export function hoyIso(): string {
  // Fecha calendario en Chile continental.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
}

export function sumarDiasCorridos(iso: string, dias: number): string {
  const f = aFecha(iso)
  f.setUTCDate(f.getUTCDate() + dias)
  return aIso(f)
}

export function sumarMeses(iso: string, meses: number): string {
  const f = aFecha(iso)
  const dia = f.getUTCDate()
  f.setUTCDate(1)
  f.setUTCMonth(f.getUTCMonth() + meses)
  const ultimo = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate()
  f.setUTCDate(Math.min(dia, ultimo))
  return aIso(f)
}

export function esDiaHabil(iso: string, feriados: Set<string> = FERIADOS): boolean {
  const dow = aFecha(iso).getUTCDay()
  return dow !== 0 && dow !== 6 && !feriados.has(iso)
}

/** Suma días hábiles (lunes a viernes, excluye feriados). El día inicial no se cuenta. */
export function sumarDiasHabiles(iso: string, dias: number, feriados: Set<string> = FERIADOS): string {
  let actual = iso.slice(0, 10)
  let contados = 0
  while (contados < dias) {
    actual = sumarDiasCorridos(actual, 1)
    if (esDiaHabil(actual, feriados)) contados++
  }
  return actual
}

export function diasEntre(desdeIso: string, hastaIso: string): number {
  return Math.round((aFecha(hastaIso).getTime() - aFecha(desdeIso).getTime()) / 86_400_000)
}

export function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}
