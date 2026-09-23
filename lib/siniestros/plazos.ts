// Cálculo de plazos legales del caso (Ley 18.490 y DS 1.055/2012).
// Todos los días se parametrizan desde las reglas del producto.
import { diasEntre, sumarDiasCorridos, sumarDiasHabiles, sumarMeses } from './fechas'
import type { Computo, RegimenCobertura, ReglasProducto } from './tipos'

export type TipoPlazo =
  | 'aviso'
  | 'prescripcion'
  | 'certificado_incapacidad'
  | 'comunicacion_tipo_liquidacion'
  | 'oposicion_liquidacion_directa'
  | 'liquidacion'
  | 'pago'
  | 'pago_muerte'
  | 'impugnacion'

export interface PlazoCalculado {
  tipo: TipoPlazo
  nombre: string
  fundamento: string
  fecha_inicio: string
  fecha_limite: string
  computo: Computo | 'meses'
  /** Fecha en que se cumplió el hito, si ya ocurrió. */
  cumplido_el: string | null
  prorroga: boolean
}

export interface DatosPlazosCaso {
  coberturas: string[]
  fecha_accidente: string
  fecha_fallecimiento?: string | null
  fecha_denuncio: string
  fecha_aviso?: string | null
  tipo_liquidacion?: 'directa' | 'registrada'
  fecha_comunicacion_tipo_liquidacion?: string | null
  prorroga_liquidacion?: boolean
  fecha_antecedentes_completos?: string | null
  fecha_certificado_incapacidad?: string | null
  fecha_informe_liquidacion?: string | null
  fecha_impugnacion?: string | null
  fecha_pago?: string | null
}

function sumar(inicio: string, dias: number, computo: Computo): string {
  return computo === 'habiles' ? sumarDiasHabiles(inicio, dias) : sumarDiasCorridos(inicio, dias)
}

export function calcularPlazos(
  reglas: ReglasProducto,
  regimen: RegimenCobertura,
  caso: DatosPlazosCaso,
): PlazoCalculado[] {
  const p = reglas.plazos
  const computo = (clave: string): Computo => reglas.computo_plazos?.[clave] ?? (clave.includes('habiles') ? 'habiles' : 'corridos')
  const plazos: PlazoCalculado[] = []
  const add = (x: Omit<PlazoCalculado, 'prorroga'> & { prorroga?: boolean }) => plazos.push({ prorroga: false, ...x })

  if (p.aviso_dias !== undefined) {
    add({
      tipo: 'aviso',
      nombre: 'Aviso del accidente a la aseguradora',
      fundamento: 'Ley 18.490 art. 8',
      fecha_inicio: caso.fecha_accidente,
      fecha_limite: sumar(caso.fecha_accidente, p.aviso_dias, computo('aviso_dias')),
      computo: computo('aviso_dias'),
      cumplido_el: caso.fecha_aviso ?? caso.fecha_denuncio,
    })
  }

  if (p.prescripcion_meses !== undefined) {
    const inicio = caso.fecha_fallecimiento ?? caso.fecha_accidente
    add({
      tipo: 'prescripcion',
      nombre: 'Prescripción de la acción',
      fundamento: 'Ley 18.490 art. 13',
      fecha_inicio: inicio,
      fecha_limite: sumarMeses(inicio, p.prescripcion_meses),
      computo: 'meses',
      cumplido_el: caso.fecha_denuncio,
    })
  }

  const conIncapacidad = caso.coberturas.some(c => c === 'ipt' || c === 'ipp' || c === 'itp')
  if (conIncapacidad && p.certificado_incapacidad_meses !== undefined) {
    add({
      tipo: 'certificado_incapacidad',
      nombre: 'Presentación del certificado de incapacidad',
      fundamento: 'Condiciones de póliza CMF',
      fecha_inicio: caso.fecha_accidente,
      fecha_limite: sumarMeses(caso.fecha_accidente, p.certificado_incapacidad_meses),
      computo: 'meses',
      cumplido_el: caso.fecha_certificado_incapacidad ?? null,
    })
  }

  if (p.comunicacion_tipo_liquidacion_dias_habiles !== undefined) {
    add({
      tipo: 'comunicacion_tipo_liquidacion',
      nombre: 'Comunicación de liquidación directa o designación de liquidador',
      fundamento: 'DS 1.055 art. 20',
      fecha_inicio: caso.fecha_denuncio,
      fecha_limite: sumarDiasHabiles(caso.fecha_denuncio, p.comunicacion_tipo_liquidacion_dias_habiles),
      computo: 'habiles',
      cumplido_el: caso.fecha_comunicacion_tipo_liquidacion ?? null,
    })
  }

  if (
    caso.tipo_liquidacion === 'directa' &&
    caso.fecha_comunicacion_tipo_liquidacion &&
    p.oposicion_liquidacion_directa_dias_habiles !== undefined
  ) {
    add({
      tipo: 'oposicion_liquidacion_directa',
      nombre: 'Plazo del asegurado para oponerse a la liquidación directa',
      fundamento: 'DS 1.055 art. 21',
      fecha_inicio: caso.fecha_comunicacion_tipo_liquidacion,
      fecha_limite: sumarDiasHabiles(caso.fecha_comunicacion_tipo_liquidacion, p.oposicion_liquidacion_directa_dias_habiles),
      computo: 'habiles',
      cumplido_el: null,
    })
  }

  if (p.liquidacion_dias_corridos !== undefined) {
    const dias = p.liquidacion_dias_corridos * (caso.prorroga_liquidacion ? 2 : 1)
    add({
      tipo: 'liquidacion',
      nombre: caso.prorroga_liquidacion ? 'Emisión del informe de liquidación (prorrogado)' : 'Emisión del informe de liquidación',
      fundamento: 'DS 1.055 art. 23',
      fecha_inicio: caso.fecha_denuncio,
      fecha_limite: sumarDiasCorridos(caso.fecha_denuncio, dias),
      computo: 'corridos',
      cumplido_el: caso.fecha_informe_liquidacion ?? null,
      prorroga: !!caso.prorroga_liquidacion,
    })
  }

  if (caso.fecha_antecedentes_completos && p.pago_dias !== undefined) {
    const otras = caso.coberturas.filter(c => c !== 'muerte')
    if (caso.coberturas.includes('muerte')) {
      const dias = regimen.pago_dias_muerte ?? p.pago_dias
      const comp = regimen.pago_muerte_computo ?? computo('pago_dias')
      add({
        tipo: 'pago_muerte',
        nombre: `Pago de indemnización por muerte (${dias} días ${comp})`,
        fundamento: 'Ley 18.490 art. 30 (mod. Ley 21.797)',
        fecha_inicio: caso.fecha_antecedentes_completos,
        fecha_limite: sumar(caso.fecha_antecedentes_completos, dias, comp),
        computo: comp,
        cumplido_el: caso.fecha_pago ?? null,
      })
    }
    if (otras.length > 0) {
      add({
        tipo: 'pago',
        nombre: `Pago de indemnización (${p.pago_dias} días)`,
        fundamento: 'Ley 18.490 art. 30',
        fecha_inicio: caso.fecha_antecedentes_completos,
        fecha_limite: sumar(caso.fecha_antecedentes_completos, p.pago_dias, computo('pago_dias')),
        computo: computo('pago_dias'),
        cumplido_el: caso.fecha_pago ?? null,
      })
    }
  }

  if (caso.fecha_informe_liquidacion && p.impugnacion_dias !== undefined) {
    add({
      tipo: 'impugnacion',
      nombre: 'Plazo para impugnar el informe de liquidación',
      fundamento: 'DS 1.055 art. 26',
      fecha_inicio: caso.fecha_informe_liquidacion,
      fecha_limite: sumar(caso.fecha_informe_liquidacion, p.impugnacion_dias, computo('impugnacion_dias')),
      computo: computo('impugnacion_dias'),
      cumplido_el: caso.fecha_impugnacion ?? null,
    })
  }

  return plazos
}

export type EstadoPlazo = 'cumplido' | 'cumplido_fuera_plazo' | 'vencido' | 'critico' | 'proximo' | 'en_plazo'

/** Estado de alerta del plazo a la fecha `hoy` (ISO). */
export function estadoPlazo(
  plazo: Pick<PlazoCalculado, 'fecha_limite' | 'cumplido_el'>,
  hoy: string,
  umbrales = { critico: 3, proximo: 7 },
): { estado: EstadoPlazo; dias_restantes: number } {
  const dias = diasEntre(hoy, plazo.fecha_limite)
  if (plazo.cumplido_el) {
    return {
      estado: plazo.cumplido_el.slice(0, 10) <= plazo.fecha_limite ? 'cumplido' : 'cumplido_fuera_plazo',
      dias_restantes: dias,
    }
  }
  if (dias < 0) return { estado: 'vencido', dias_restantes: dias }
  if (dias <= umbrales.critico) return { estado: 'critico', dias_restantes: dias }
  if (dias <= umbrales.proximo) return { estado: 'proximo', dias_restantes: dias }
  return { estado: 'en_plazo', dias_restantes: dias }
}
