// Cálculo de indemnizaciones en UF con las reglas de acumulación y deducción
// del art. 26 de la Ley 18.490. Todo resultado es una PROPUESTA sujeta a
// revisión del liquidador; el valor UF usado queda registrado para trazabilidad.
import { obtenerCobertura, topeCobertura } from './reglas/consultas'
import type { RegimenCobertura, ReglasProducto } from './tipos'

export interface ValorUf {
  fecha: string
  valor: number
}

export interface PagosPrevios {
  /** UF ya pagadas por el mismo accidente, por cobertura. */
  [cobertura: string]: number | undefined
}

export interface ComprobanteCalculo {
  monto_clp: number
  excluir?: boolean
  motivo_exclusion?: string
}

export interface EntradaCalculo {
  cobertura: string
  valor_uf: ValorUf
  /** Grado de incapacidad como fracción (0-1). */
  grado_incapacidad?: number | null
  pagos_previos_uf?: PagosPrevios
  comprobantes?: ComprobanteCalculo[]
  monto_declarado?: { valor: number; moneda: 'CLP' | 'UF' } | null
  exclusion_confirmada?: string | null
}

export interface ResultadoCalculo {
  cobertura: string
  regimen: string
  procede: boolean
  tope_uf: number
  monto_uf: number
  monto_clp: number
  valor_uf: ValorUf
  pasos: string[]
  advertencias: string[]
}

/** Coberturas no acumulables entre sí (art. 26). */
const NO_ACUMULABLES = ['muerte', 'ipt', 'ipp']

const redondearUf = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => redondearUf(n).toLocaleString('es-CL', { maximumFractionDigits: 2 })

export function ufAClp(uf: number, valor: ValorUf): number {
  return Math.round(uf * valor.valor)
}

export function clpAUf(clp: number, valor: ValorUf): number {
  return clp / valor.valor
}

export function calcularIndemnizacion(
  reglas: ReglasProducto,
  regimen: RegimenCobertura,
  entrada: EntradaCalculo,
): ResultadoCalculo {
  const cobertura = obtenerCobertura(reglas, entrada.cobertura)
  const calc = cobertura.reglas_calculo
  const tope = topeCobertura(regimen, cobertura)
  const previos = entrada.pagos_previos_uf ?? {}
  const pasos: string[] = [`Régimen ${regimen.id}: tope ${cobertura.nombre} = ${fmt(tope)} UF`]
  const advertencias: string[] = []
  let procede = true
  let monto = 0

  const resultado = (): ResultadoCalculo => {
    const monto_uf = procede ? Math.max(0, redondearUf(monto)) : 0
    return {
      cobertura: cobertura.id,
      regimen: regimen.id,
      procede,
      tope_uf: tope,
      monto_uf,
      monto_clp: ufAClp(monto_uf, entrada.valor_uf),
      valor_uf: entrada.valor_uf,
      pasos: [...pasos, `Conversión: ${fmt(monto_uf)} UF × $${entrada.valor_uf.valor.toLocaleString('es-CL')} (UF ${entrada.valor_uf.fecha}) = $${ufAClp(monto_uf, entrada.valor_uf).toLocaleString('es-CL')}`],
      advertencias,
    }
  }

  if (entrada.exclusion_confirmada) {
    procede = false
    pasos.push(`Exclusión confirmada por el liquidador: ${entrada.exclusion_confirmada}. No procede indemnización.`)
    return resultado()
  }

  const umbralIpp = reglas.incapacidad?.umbral_ipp ?? 0.3
  const umbralIpt = reglas.incapacidad?.umbral_ipt ?? 2 / 3
  const grado = entrada.grado_incapacidad ?? null
  const previoNoAcumulable = NO_ACUMULABLES.includes(cobertura.id)
    ? NO_ACUMULABLES.reduce((s, c) => s + (previos[c] ?? 0), 0)
    : 0
  const gmPagados = previos.gastos_medicos ?? 0

  switch (calc.tipo) {
    case 'monto_fijo': {
      if (cobertura.id === 'ipt') {
        if (grado === null) {
          advertencias.push('Falta el grado de incapacidad certificado por el médico tratante.')
        } else if (grado < umbralIpt) {
          procede = false
          pasos.push(`Grado ${(grado * 100).toFixed(1)}% < ${(umbralIpt * 100).toFixed(1)}%: no califica como incapacidad permanente total (art. 27).`)
          return resultado()
        }
      }
      monto = tope
      if (previoNoAcumulable > 0) {
        monto -= previoNoAcumulable
        pasos.push(`Art. 26: indemnizaciones de muerte/IPT/IPP no acumulables. Se descuentan ${fmt(previoNoAcumulable)} UF ya pagadas → remanente ${fmt(monto)} UF`)
      }
      if (calc.deducir_gastos_medicos && gmPagados > 0) {
        monto -= gmPagados
        pasos.push(`Art. 26: en muerte se deducen los gastos médicos pagados (${fmt(gmPagados)} UF) → ${fmt(Math.max(0, monto))} UF`)
      } else if (!calc.deducir_gastos_medicos && gmPagados > 0) {
        pasos.push(`Art. 26: en ${cobertura.nombre.toLowerCase()} NO se deducen los gastos médicos pagados (${fmt(gmPagados)} UF).`)
      }
      break
    }

    case 'proporcional_grado': {
      if (grado === null) {
        procede = false
        advertencias.push('Falta el grado de incapacidad; no es posible proponer un monto.')
        return resultado()
      }
      if (grado < umbralIpp) {
        procede = false
        pasos.push(`Grado ${(grado * 100).toFixed(1)}% < ${(umbralIpp * 100).toFixed(0)}%: no califica como incapacidad permanente parcial (art. 27).`)
        return resultado()
      }
      if (grado >= umbralIpt) {
        advertencias.push(`Grado ${(grado * 100).toFixed(1)}% ≥ 2/3: corresponde evaluar como incapacidad permanente total.`)
      }
      const baseRef = calc.base_proporcion_ref ?? cobertura.tope_uf_ref
      const base = regimen.topes_uf[baseRef]
      const proporcional = base * grado
      monto = Math.min(proporcional, tope)
      pasos.push(`Proporcional al grado: ${(grado * 100).toFixed(1)}% × ${fmt(base)} UF (${baseRef}) = ${fmt(proporcional)} UF, con tope ${fmt(tope)} UF → ${fmt(monto)} UF`)
      if (previoNoAcumulable > 0) {
        monto -= previoNoAcumulable
        pasos.push(`Art. 26: se descuentan ${fmt(previoNoAcumulable)} UF de incapacidad ya pagadas → ${fmt(monto)} UF`)
      }
      if (calc.cap_con_gastos_medicos) {
        const capRef = calc.cap_con_gastos_medicos_ref ?? cobertura.tope_uf_ref
        const cap = regimen.topes_uf[capRef]
        if (monto + gmPagados > cap) {
          const ajustado = Math.max(0, cap - gmPagados)
          pasos.push(`Art. 26: IPP (${fmt(monto)} UF) + gastos médicos (${fmt(gmPagados)} UF) no puede exceder ${fmt(cap)} UF → ${fmt(ajustado)} UF`)
          monto = ajustado
        } else if (gmPagados > 0) {
          pasos.push(`Art. 26: IPP + gastos médicos (${fmt(monto + gmPagados)} UF) dentro del tope de ${fmt(cap)} UF; no se deducen gastos médicos.`)
        }
      }
      break
    }

    case 'suma_comprobantes': {
      const comprobantes = entrada.comprobantes ?? []
      const aceptados = comprobantes.filter(c => !c.excluir)
      const excluidos = comprobantes.filter(c => c.excluir)
      const totalClp = aceptados.reduce((s, c) => s + c.monto_clp, 0)
      const totalUf = clpAUf(totalClp, entrada.valor_uf)
      pasos.push(`Suma de ${aceptados.length} comprobante(s) aceptado(s): $${totalClp.toLocaleString('es-CL')} = ${fmt(totalUf)} UF`)
      for (const e of excluidos) {
        pasos.push(`Comprobante excluido ($${e.monto_clp.toLocaleString('es-CL')}): ${e.motivo_exclusion ?? 'sin motivo'}`)
      }
      const disponible = Math.max(0, tope - (previos[cobertura.id] ?? 0))
      if ((previos[cobertura.id] ?? 0) > 0) {
        pasos.push(`Gastos médicos ya pagados: ${fmt(previos[cobertura.id] ?? 0)} UF → saldo disponible ${fmt(disponible)} UF`)
      }
      monto = Math.min(totalUf, disponible)
      if (totalUf > disponible) {
        pasos.push(`La suma excede el saldo del tope; se limita a ${fmt(disponible)} UF`)
        advertencias.push('Los comprobantes superan el tope de la cobertura.')
      }
      if (comprobantes.length === 0) advertencias.push('No hay comprobantes cargados.')
      break
    }

    case 'monto_declarado': {
      const decl = entrada.monto_declarado
      if (!decl) {
        procede = false
        advertencias.push('Falta el monto declarado en los antecedentes.')
        return resultado()
      }
      const uf = decl.moneda === 'UF' ? decl.valor : clpAUf(decl.valor, entrada.valor_uf)
      monto = Math.min(uf, tope)
      pasos.push(`Monto acreditado: ${decl.moneda === 'CLP' ? `$${decl.valor.toLocaleString('es-CL')} = ` : ''}${fmt(uf)} UF, con tope ${fmt(tope)} UF → ${fmt(monto)} UF`)
      break
    }
  }

  if (monto <= 0) {
    advertencias.push('El monto resultante es 0 UF (tope ya consumido por pagos previos o deducciones).')
  }
  return resultado()
}

/**
 * Calcula todas las coberturas del caso. Gastos médicos se calcula primero
 * porque su monto alimenta la deducción de muerte y el tope conjunto de IPP.
 */
export function calcularCaso(
  reglas: ReglasProducto,
  regimen: RegimenCobertura,
  entradas: EntradaCalculo[],
  pagosPreviosUf: PagosPrevios = {},
): ResultadoCalculo[] {
  const orden = (c: string) => (c === 'gastos_medicos' ? 0 : c === 'ipp' ? 1 : c === 'ipt' ? 2 : 3)
  const ordenadas = [...entradas].sort((a, b) => orden(a.cobertura) - orden(b.cobertura))
  const acumulado: PagosPrevios = { ...pagosPreviosUf }
  const resultados: ResultadoCalculo[] = []
  for (const e of ordenadas) {
    const r = calcularIndemnizacion(reglas, regimen, { ...e, pagos_previos_uf: { ...acumulado, ...e.pagos_previos_uf } })
    resultados.push(r)
    acumulado[r.cobertura] = (acumulado[r.cobertura] ?? 0) + r.monto_uf
  }
  return resultados
}
