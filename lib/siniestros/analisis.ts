// Orquestación determinística del análisis de un caso: validaciones cruzadas,
// beneficiarios y cálculo. La IA sólo resume y comenta sobre este resultado;
// los montos siempre los calcula este código.
import { resolverBeneficiarios, type ResultadoPrelacion } from './beneficiarios'
import { calcularCaso, ufAClp, type EntradaCalculo, type ResultadoCalculo, type ValorUf } from './calculo'
import { resolverRegimen } from './reglas/consultas'
import { nombresConsistentes, validarCaso, type DocumentoExtraido, type InformeValidacion } from './validaciones'
import type { Persona, RegimenCobertura, ReglasProducto } from './tipos'

export interface CasoAnalisis {
  coberturas: string[]
  fecha_accidente: string
  fecha_fallecimiento?: string | null
  fecha_denuncio: string
  fecha_aviso?: string | null
  patente?: string | null
  poliza_fecha_contratacion: string
  poliza_vigencia_desde?: string | null
  poliza_vigencia_hasta?: string | null
  exclusion_confirmada?: string | null
}

export interface EntradaAnalisis {
  reglas: ReglasProducto
  caso: CasoAnalisis
  personas: Persona[]
  documentos: DocumentoExtraido[]
  /** Grado ingresado/corregido por el liquidador (fracción 0-1), por cobertura. */
  grados?: Record<string, number | null | undefined>
  valor_uf: ValorUf
  casos_vinculados?: number
  pagos_previos_uf?: Record<string, number>
}

export interface ResultadoAnalisis {
  regimen: RegimenCobertura
  validacion: InformeValidacion
  calculo: ResultadoCalculo[]
  beneficiarios: ResultadoPrelacion | null
  total_uf: number
  total_clp: number
}

function numero(v: string | null | undefined): number | null {
  if (!v) return null
  const n = Number(String(v).replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function campo(docs: DocumentoExtraido[], documento: string, id: string): string | null {
  for (const d of docs) {
    if (d.documento_id !== documento) continue
    const v = d.extraccion.campos?.[id]?.valor
    if (v) return v
  }
  return null
}

/** Grado de incapacidad: prima lo ingresado por el liquidador, luego COMPIN, luego el médico tratante (art. 28). */
export function gradoIncapacidad(docs: DocumentoExtraido[], manual?: number | null): number | null {
  if (manual !== undefined && manual !== null) return manual
  const compin = numero(campo(docs, 'cert_compin', 'grado_incapacidad_pct'))
  if (compin !== null) return compin / 100
  const medico = numero(campo(docs, 'cert_medico_incapacidad', 'grado_incapacidad_pct'))
  return medico !== null ? medico / 100 : null
}

export function analizarCaso(e: EntradaAnalisis): ResultadoAnalisis {
  const regimen = resolverRegimen(e.reglas, e.caso.poliza_fecha_contratacion)
  const victima = e.personas.find(p => p.rol === 'victima')

  const entradas: EntradaCalculo[] = e.caso.coberturas.map(cob => {
    const def = e.reglas.coberturas.find(c => c.id === cob)
    const entrada: EntradaCalculo = {
      cobertura: cob,
      valor_uf: e.valor_uf,
      exclusion_confirmada: e.caso.exclusion_confirmada ?? null,
    }
    if (def?.reglas_calculo.tipo === 'proporcional_grado' || cob === 'ipt' || cob === 'itp') {
      entrada.grado_incapacidad = gradoIncapacidad(e.documentos, e.grados?.[cob])
    }
    if (def?.reglas_calculo.tipo === 'suma_comprobantes') {
      entrada.comprobantes = e.documentos
        .flatMap(d => d.extraccion.comprobantes ?? [])
        .filter(c => c.monto_clp !== null && c.monto_clp > 0)
        .map(c => {
          const ajeno = !!(victima && c.a_nombre_de && !nombresConsistentes(c.a_nombre_de, victima.nombre))
          const anterior = !!(c.fecha && c.fecha < e.caso.fecha_accidente)
          return {
            monto_clp: c.monto_clp as number,
            excluir: ajeno || anterior,
            motivo_exclusion: ajeno
              ? `Comprobante ${c.numero ?? ''} a nombre de ${c.a_nombre_de} (propuesta: excluir)`
              : anterior ? `Comprobante ${c.numero ?? ''} anterior al accidente (propuesta: excluir)` : undefined,
          }
        })
    }
    if (def?.reglas_calculo.tipo === 'monto_declarado' && def.reglas_calculo.campo_monto) {
      const cm = def.reglas_calculo.campo_monto
      const v = numero(campo(e.documentos, cm.documento, cm.campo))
      entrada.monto_declarado = v === null ? null : { valor: v, moneda: cm.moneda ?? 'CLP' }
    }
    return entrada
  })

  const calculo = calcularCaso(e.reglas, regimen, entradas, e.pagos_previos_uf)
  const gm = calculo.find(c => c.cobertura === 'gastos_medicos')
  const validacion = validarCaso(e.reglas, regimen, {
    ...e.caso,
    personas: e.personas,
    documentos: e.documentos,
    casos_vinculados: e.casos_vinculados,
    gastos_medicos_solicitados_uf: gm
      ? entradas.find(x => x.cobertura === 'gastos_medicos')!.comprobantes!.reduce((s, c) => s + c.monto_clp, 0) / e.valor_uf.valor
      : undefined,
  })

  const beneficiarios = e.caso.coberturas.includes('muerte')
    ? resolverBeneficiarios(e.personas, e.caso.fecha_fallecimiento ?? e.caso.fecha_accidente)
    : null

  const total_uf = Math.round(calculo.reduce((s, c) => s + c.monto_uf, 0) * 100) / 100
  return { regimen, validacion, calculo, beneficiarios, total_uf, total_clp: ufAClp(total_uf, e.valor_uf) }
}

/**
 * Reparte el pago: la muerte va a los beneficiarios según su cuota; las demás
 * coberturas a la víctima (o al prestador en pago directo, art. 32).
 */
export function repartirPago(
  calculo: { cobertura: string; monto_clp: number }[],
  beneficiarios: ResultadoPrelacion | null,
  victima: Persona | undefined,
): { nombre: string; rut: string | null; cuota: number; monto_clp: number }[] {
  const muerte = calculo.find(c => c.cobertura === 'muerte')?.monto_clp ?? 0
  const otras = calculo.filter(c => c.cobertura !== 'muerte').reduce((s, c) => s + c.monto_clp, 0)
  const out: { nombre: string; rut: string | null; cuota: number; monto_clp: number }[] = []
  if (muerte > 0 && beneficiarios) {
    let asignado = 0
    beneficiarios.beneficiarios.forEach((b, i) => {
      const ultimo = i === beneficiarios.beneficiarios.length - 1
      const monto = ultimo ? muerte - asignado : Math.floor(muerte * b.cuota)
      asignado += monto
      out.push({ nombre: b.nombre, rut: b.rut ?? null, cuota: b.cuota, monto_clp: monto })
    })
  }
  if (otras > 0 && victima) {
    // Si la víctima falleció, los gastos médicos se reembolsan a quien los pagó; se deja a la víctima como referencia.
    out.push({ nombre: victima.nombre, rut: victima.rut ?? null, cuota: 1, monto_clp: otras })
  }
  return out
}
