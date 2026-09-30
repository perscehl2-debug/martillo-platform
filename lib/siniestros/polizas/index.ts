// Pólizas: el denuncio parte siempre de una póliza existente. Se busca por
// número o por patente; de la póliza salen el vehículo, el tomador, la
// vigencia y la fecha de contratación (que determina el régimen de topes).
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarPatente } from '../patente'
import demo from './demo.json'

export interface PersonaPoliza {
  nombre: string
  rut: string | null
  email?: string | null
  telefono?: string | null
  direccion?: string | null
}

export interface Poliza {
  numero: string
  producto: string
  variante: string | null
  aseguradora: string | null
  estado: 'vigente' | 'anulada'
  fecha_contratacion: string
  vigencia_desde: string
  vigencia_hasta: string
  vehiculo: { patente: string; marca?: string; modelo?: string; anio?: number; tipo?: string; uso?: string }
  tomador: PersonaPoliza
  propietario: PersonaPoliza | null
}

export const POLIZAS_DEMO = demo.polizas as Poliza[]

const normalizarNumero = (s: string) => s.toUpperCase().replace(/\s+/g, '')

function coincide(p: Poliza, q: string): boolean {
  const n = normalizarNumero(q)
  return normalizarNumero(p.numero) === n || normalizarPatente(p.vehiculo.patente) === normalizarPatente(q)
}

export function buscarEnDemo(q: string): Poliza[] {
  if (!q.trim()) return []
  return POLIZAS_DEMO.filter(p => coincide(p, q))
}

/**
 * Busca en la tabla `polizas`; si la tabla todavía no existe (migración 003
 * sin aplicar) usa las pólizas de demostración incluidas en el código.
 */
export async function buscarPolizas(db: SupabaseClient, q: string): Promise<{ polizas: Poliza[]; fuente: 'base' | 'demo' }> {
  const termino = q.trim()
  if (!termino) return { polizas: [], fuente: 'base' }
  const numero = normalizarNumero(termino)
  const patente = normalizarPatente(termino) ?? ''
  const { data, error } = await db
    .from('polizas')
    .select('numero, producto, variante, aseguradora, estado, fecha_contratacion, vigencia_desde, vigencia_hasta, vehiculo, tomador, propietario')
    .or(`numero.eq.${numero.replace(/[,()]/g, '')},patente.eq.${patente.replace(/[,()]/g, '')}`)
    .limit(10)
  if (error) {
    // PGRST205 / 42P01: la tabla no existe todavía.
    if (error.code === 'PGRST205' || error.code === '42P01') return { polizas: buscarEnDemo(termino), fuente: 'demo' }
    throw error
  }
  return { polizas: (data ?? []) as Poliza[], fuente: 'base' }
}

export async function obtenerPoliza(db: SupabaseClient, numero: string): Promise<Poliza | null> {
  const { polizas } = await buscarPolizas(db, numero)
  return polizas.find(p => normalizarNumero(p.numero) === normalizarNumero(numero)) ?? null
}

export type EstadoCobertura = 'cubierto' | 'antes_vigencia' | 'despues_vigencia' | 'anulada'

/** ¿La fecha del accidente cae dentro de la vigencia de la póliza? */
export function coberturaEnFecha(p: Poliza, fechaAccidente: string): EstadoCobertura {
  if (p.estado === 'anulada') return 'anulada'
  if (fechaAccidente < p.vigencia_desde) return 'antes_vigencia'
  if (fechaAccidente > p.vigencia_hasta) return 'despues_vigencia'
  return 'cubierto'
}
