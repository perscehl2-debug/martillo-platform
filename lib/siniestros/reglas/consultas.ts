// Consultas puras sobre las reglas (sin Ajv: seguras para el bundle del cliente).
import type { Cobertura, RegimenCobertura, ReglasProducto } from '../tipos'

/**
 * Determina el régimen de cobertura aplicable. La regla clave del SOAP es que
 * manda la fecha de CONTRATACIÓN de la póliza, no la fecha del siniestro.
 */
export function resolverRegimen(reglas: ReglasProducto, fechaContratacionPoliza: string): RegimenCobertura {
  const fecha = fechaContratacionPoliza.slice(0, 10)
  const regimen = reglas.regimenes_cobertura.find(r =>
    (!r.vigente_desde || fecha >= r.vigente_desde) && (!r.vigente_hasta || fecha <= r.vigente_hasta)
  )
  if (!regimen) {
    throw new Error(`Ningún régimen de ${reglas.producto} cubre pólizas contratadas el ${fecha}`)
  }
  return regimen
}

export function obtenerCobertura(reglas: ReglasProducto, id: string): Cobertura {
  const cob = reglas.coberturas.find(c => c.id === id)
  if (!cob) throw new Error(`Cobertura desconocida en ${reglas.producto}: ${id}`)
  return cob
}

export function topeCobertura(regimen: RegimenCobertura, cobertura: Cobertura): number {
  const tope = regimen.topes_uf[cobertura.tope_uf_ref]
  if (tope === undefined) throw new Error(`Régimen ${regimen.id} sin tope ${cobertura.tope_uf_ref}`)
  return tope
}
