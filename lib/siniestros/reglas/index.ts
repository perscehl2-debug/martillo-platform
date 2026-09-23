import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import schema from './schema.json'
import soap from './soap.json'
import desgravamen from './desgravamen.json'
import type { ReglasProducto } from '../tipos'

const ajv = new Ajv({ allErrors: true, strict: true })
addFormats(ajv)
const validarEsquema = ajv.compile(schema)

export interface ResultadoValidacionReglas {
  valido: boolean
  errores: string[]
}

/**
 * Valida un archivo de reglas contra el JSON Schema y además revisa la
 * coherencia interna (referencias a documentos, topes y regímenes).
 */
export function validarReglas(json: unknown): ResultadoValidacionReglas {
  if (!validarEsquema(json)) {
    return {
      valido: false,
      errores: (validarEsquema.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()),
    }
  }
  const reglas = json as unknown as ReglasProducto
  const errores: string[] = []

  for (const cob of reglas.coberturas) {
    for (const doc of cob.documentos) {
      if (!reglas.catalogo_documentos[doc.id]) {
        errores.push(`Cobertura "${cob.id}": documento "${doc.id}" no existe en catalogo_documentos`)
      }
    }
    const refs = [cob.tope_uf_ref, cob.reglas_calculo.tope_uf_ref, cob.reglas_calculo.base_proporcion_ref, cob.reglas_calculo.cap_con_gastos_medicos_ref]
      .filter((r): r is string => !!r)
    for (const regimen of reglas.regimenes_cobertura) {
      for (const ref of refs) {
        if (regimen.topes_uf[ref] === undefined) {
          errores.push(`Régimen "${regimen.id}": falta tope "${ref}" usado por la cobertura "${cob.id}"`)
        }
      }
    }
    const campo = cob.reglas_calculo.campo_monto
    if (campo) {
      const doc = reglas.catalogo_documentos[campo.documento]
      if (!doc || !doc.campos.some(c => c.id === campo.campo)) {
        errores.push(`Cobertura "${cob.id}": campo_monto ${campo.documento}.${campo.campo} no existe en el catálogo`)
      }
    }
  }

  const ids = new Set<string>()
  for (const cob of reglas.coberturas) {
    if (ids.has(cob.id)) errores.push(`Cobertura duplicada: "${cob.id}"`)
    ids.add(cob.id)
  }

  // Los regímenes no deben solaparse: para cualquier fecha debe aplicar a lo más uno.
  const rangos = reglas.regimenes_cobertura.map(r => ({
    id: r.id,
    desde: r.vigente_desde ?? '0000-01-01',
    hasta: r.vigente_hasta ?? '9999-12-31',
  }))
  for (let i = 0; i < rangos.length; i++) {
    for (let j = i + 1; j < rangos.length; j++) {
      const a = rangos[i], b = rangos[j]
      if (a.desde <= b.hasta && b.desde <= a.hasta) {
        errores.push(`Regímenes "${a.id}" y "${b.id}" tienen vigencias superpuestas`)
      }
    }
  }

  return { valido: errores.length === 0, errores }
}

/** Reglas incluidas en el código; la tabla reglas_producto puede publicar versiones nuevas. */
export const REGLAS_BASE: Record<string, ReglasProducto> = {
  SOAP: soap as ReglasProducto,
  DESGRAVAMEN: desgravamen as ReglasProducto,
}

export function reglasBase(producto: string): ReglasProducto {
  const reglas = REGLAS_BASE[producto]
  if (!reglas) throw new Error(`Producto sin reglas: ${producto}`)
  return reglas
}

export { obtenerCobertura, resolverRegimen, topeCobertura } from './consultas'
