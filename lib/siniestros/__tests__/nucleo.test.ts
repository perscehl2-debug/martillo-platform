import { describe, expect, it } from 'vitest'
import { reglasBase, resolverRegimen, validarReglas } from '../reglas'
import { calcularCaso, calcularIndemnizacion } from '../calculo'
import { calcularPlazos, estadoPlazo } from '../plazos'
import { calcularDv, formatearRut, validarRut } from '../rut'
import { mismaPatente, normalizarPatente } from '../patente'
import { sumarDiasHabiles, sumarMeses } from '../fechas'
import { resolverBeneficiarios } from '../beneficiarios'
import { generarChecklist, resumirChecklist } from '../checklist'
import { nombresConsistentes, validarCaso } from '../validaciones'
import { esquemaExtraccion } from '../ia/esquemas'
import { normalizarExtraccion } from '../ia/claude'
import type { ExtraccionDocumento, ReglasProducto } from '../tipos'

const soap = reglasBase('SOAP')
const post = resolverRegimen(soap, '2026-03-01')
const pre = resolverRegimen(soap, '2025-11-15')
const UF = { fecha: '2026-09-22', valor: 40991 }

describe('reglas', () => {
  it('las reglas incluidas son válidas contra el JSON Schema', () => {
    expect(validarReglas(soap)).toEqual({ valido: true, errores: [] })
    expect(validarReglas(reglasBase('DESGRAVAMEN'))).toEqual({ valido: true, errores: [] })
  })

  it('rechaza reglas con estructura o referencias inválidas', () => {
    expect(validarReglas({ producto: 'x' }).valido).toBe(false)
    const rota = structuredClone(soap) as ReglasProducto
    rota.coberturas[0].documentos.push({ id: 'no_existe', obligatorio: true })
    rota.regimenes_cobertura[1].vigente_hasta = '2026-03-01'
    const r = validarReglas(rota)
    expect(r.valido).toBe(false)
    expect(r.errores.join('\n')).toMatch(/no_existe/)
    expect(r.errores.join('\n')).toMatch(/superpuestas/)
  })

  it('el régimen lo determina la fecha de contratación de la póliza (Ley Jacinta)', () => {
    expect(resolverRegimen(soap, '2026-02-08').id).toBe('pre_ley_jacinta')
    expect(resolverRegimen(soap, '2026-02-09').id).toBe('post_ley_jacinta')
    expect(post.topes_uf).toEqual({ muerte: 600, ipt: 600, ipp_max: 400, gastos_medicos: 600 })
    expect(pre.topes_uf).toEqual({ muerte: 300, ipt: 300, ipp_max: 200, gastos_medicos: 300 })
  })
})

describe('RUT y patente', () => {
  it('valida el dígito verificador', () => {
    expect(calcularDv('12345678')).toBe('5')
    expect(validarRut('12.345.678-5')).toBe(true)
    expect(validarRut('12345678-9')).toBe(false)
    expect(validarRut('11.111.111-1')).toBe(true)
    expect(validarRut(null)).toBe(false)
    expect(formatearRut('123456785')).toBe('12.345.678-5')
  })

  it('normaliza y compara patentes', () => {
    expect(normalizarPatente('bb·cl-12')).toBe('BBCL12')
    expect(normalizarPatente('BBCL12-5')).toBe('BBCL12')
    expect(mismaPatente('AB 1234', 'ab-1234')).toBe(true)
    expect(mismaPatente('AB1234', 'AB1235')).toBe(false)
  })
})

describe('cálculo art. 26', () => {
  it('muerte: deduce los gastos médicos pagados y convierte con la UF del día', () => {
    const r = calcularIndemnizacion(soap, post, { cobertura: 'muerte', valor_uf: UF, pagos_previos_uf: { gastos_medicos: 50 } })
    expect(r.monto_uf).toBe(550)
    expect(r.monto_clp).toBe(550 * 40991)
    expect(r.valor_uf).toEqual(UF)
  })

  it('caso con muerte y gastos médicos: los gastos se calculan primero y se deducen', () => {
    const [gm, muerte] = calcularCaso(soap, post, [
      { cobertura: 'muerte', valor_uf: UF },
      { cobertura: 'gastos_medicos', valor_uf: UF, comprobantes: [{ monto_clp: 40991 * 30 }, { monto_clp: 40991 * 20 }, { monto_clp: 999999, excluir: true, motivo_exclusion: 'no a nombre de la víctima' }] },
    ])
    expect(gm.cobertura).toBe('gastos_medicos')
    expect(gm.monto_uf).toBe(50)
    expect(muerte.monto_uf).toBe(550)
  })

  it('régimen antiguo usa topes de 300 UF', () => {
    expect(calcularIndemnizacion(soap, pre, { cobertura: 'muerte', valor_uf: UF }).monto_uf).toBe(300)
  })

  it('IPT: no deduce gastos médicos, pero sí descuenta IPP ya pagada', () => {
    expect(calcularIndemnizacion(soap, post, { cobertura: 'ipt', valor_uf: UF, grado_incapacidad: 0.7, pagos_previos_uf: { gastos_medicos: 100 } }).monto_uf).toBe(600)
    expect(calcularIndemnizacion(soap, post, { cobertura: 'ipt', valor_uf: UF, grado_incapacidad: 0.7, pagos_previos_uf: { ipp: 200 } }).monto_uf).toBe(400)
    const noCalifica = calcularIndemnizacion(soap, post, { cobertura: 'ipt', valor_uf: UF, grado_incapacidad: 0.5 })
    expect(noCalifica.procede).toBe(false)
    expect(noCalifica.monto_uf).toBe(0)
  })

  it('muerte posterior a IPP paga sólo el remanente', () => {
    expect(calcularIndemnizacion(soap, post, { cobertura: 'muerte', valor_uf: UF, pagos_previos_uf: { ipp: 240 } }).monto_uf).toBe(360)
  })

  it('IPP proporcional al grado, con tope y tope conjunto con gastos médicos', () => {
    expect(calcularIndemnizacion(soap, post, { cobertura: 'ipp', valor_uf: UF, grado_incapacidad: 0.5 }).monto_uf).toBe(300)
    expect(calcularIndemnizacion(soap, post, { cobertura: 'ipp', valor_uf: UF, grado_incapacidad: 0.66 }).monto_uf).toBe(396)
    expect(calcularIndemnizacion(soap, pre, { cobertura: 'ipp', valor_uf: UF, grado_incapacidad: 0.5 }).monto_uf).toBe(150)
    expect(calcularIndemnizacion(soap, post, { cobertura: 'ipp', valor_uf: UF, grado_incapacidad: 0.5, pagos_previos_uf: { gastos_medicos: 350 } }).monto_uf).toBe(250)
    expect(calcularIndemnizacion(soap, post, { cobertura: 'ipp', valor_uf: UF, grado_incapacidad: 0.2 }).procede).toBe(false)
  })

  it('gastos médicos limitados al tope y al saldo disponible', () => {
    const r = calcularIndemnizacion(soap, post, { cobertura: 'gastos_medicos', valor_uf: UF, comprobantes: [{ monto_clp: 40991 * 700 }] })
    expect(r.monto_uf).toBe(600)
    const conPrevio = calcularIndemnizacion(soap, post, { cobertura: 'gastos_medicos', valor_uf: UF, comprobantes: [{ monto_clp: 40991 * 100 }], pagos_previos_uf: { gastos_medicos: 550 } })
    expect(conPrevio.monto_uf).toBe(50)
  })

  it('una exclusión confirmada anula la propuesta', () => {
    const r = calcularIndemnizacion(soap, post, { cobertura: 'muerte', valor_uf: UF, exclusion_confirmada: 'carreras' })
    expect(r.procede).toBe(false)
    expect(r.monto_uf).toBe(0)
  })

  it('producto nuevo por configuración: desgravamen usa monto declarado', () => {
    const d = reglasBase('DESGRAVAMEN')
    const reg = resolverRegimen(d, '2020-01-01')
    const r = calcularIndemnizacion(d, reg, { cobertura: 'muerte', valor_uf: UF, monto_declarado: { valor: 40991 * 1234.5, moneda: 'CLP' } })
    expect(r.monto_uf).toBe(1234.5)
  })
})

describe('plazos', () => {
  it('suma días hábiles saltando fines de semana y feriados', () => {
    expect(sumarDiasHabiles('2026-09-16', 3)).toBe('2026-09-22')
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('calcula liquidación (45 días, prorrogable), pago en muerte (7 hábiles) y prescripción', () => {
    const base = {
      coberturas: ['muerte', 'gastos_medicos'],
      fecha_accidente: '2026-08-20',
      fecha_denuncio: '2026-09-01',
      fecha_antecedentes_completos: '2026-10-01',
    }
    const plazos = calcularPlazos(soap, post, base)
    const por = (t: string) => plazos.find(p => p.tipo === t)!
    expect(por('liquidacion').fecha_limite).toBe('2026-10-16')
    expect(por('pago_muerte').fecha_limite).toBe('2026-10-13')
    expect(por('pago').fecha_limite).toBe('2026-10-11')
    expect(por('prescripcion').fecha_limite).toBe('2027-08-20')
    expect(por('aviso').fecha_limite).toBe('2026-09-19')

    const prorrogado = calcularPlazos(soap, post, { ...base, prorroga_liquidacion: true })
    expect(prorrogado.find(p => p.tipo === 'liquidacion')!.fecha_limite).toBe('2026-11-30')

    const antiguo = calcularPlazos(soap, pre, base)
    expect(antiguo.find(p => p.tipo === 'pago_muerte')!.fecha_limite).toBe('2026-10-11')
  })

  it('clasifica el estado de alerta', () => {
    expect(estadoPlazo({ fecha_limite: '2026-10-16', cumplido_el: null }, '2026-10-14').estado).toBe('critico')
    expect(estadoPlazo({ fecha_limite: '2026-10-16', cumplido_el: null }, '2026-10-10').estado).toBe('proximo')
    expect(estadoPlazo({ fecha_limite: '2026-10-16', cumplido_el: null }, '2026-10-17').estado).toBe('vencido')
    expect(estadoPlazo({ fecha_limite: '2026-10-16', cumplido_el: '2026-10-20' }, '2026-10-21').estado).toBe('cumplido_fuera_plazo')
  })
})

describe('beneficiarios art. 31', () => {
  it('el cónyuge excluye a los padres', () => {
    const r = resolverBeneficiarios([
      { rol: 'beneficiario', nombre: 'Ana', parentesco: 'conyuge' },
      { rol: 'beneficiario', nombre: 'Luis', parentesco: 'padre' },
    ], '2026-09-01')
    expect(r.clase).toBe('conyuge')
    expect(r.excluidos.map(e => e.persona.nombre)).toEqual(['Luis'])
  })

  it('hijos menores se reparten por partes iguales antes que los mayores', () => {
    const r = resolverBeneficiarios([
      { rol: 'beneficiario', nombre: 'A', parentesco: 'hijo', fecha_nacimiento: '2012-01-01' },
      { rol: 'beneficiario', nombre: 'B', parentesco: 'hijo', fecha_nacimiento: '2015-01-01' },
      { rol: 'beneficiario', nombre: 'C', parentesco: 'hijo', fecha_nacimiento: '1990-01-01' },
    ], '2026-09-01')
    expect(r.clase).toBe('hijos_menores')
    expect(r.beneficiarios.map(b => b.cuota)).toEqual([0.5, 0.5])
  })

  it('el conviviente civil sólo cobra como heredero', () => {
    expect(resolverBeneficiarios([{ rol: 'beneficiario', nombre: 'X', parentesco: 'conviviente_civil' }], '2026-09-01').clase).toBeNull()
    expect(resolverBeneficiarios([{ rol: 'beneficiario', nombre: 'X', parentesco: 'conviviente_civil', acredita_posesion_efectiva: true }], '2026-09-01').clase).toBe('herederos')
  })
})

describe('checklist dinámico', () => {
  it('une documentos compartidos entre coberturas', () => {
    const c = generarChecklist(soap, ['muerte', 'gastos_medicos'])
    const acc = c.find(r => r.documento_id === 'cert_accidente')!
    expect(acc.coberturas).toEqual(['muerte', 'gastos_medicos'])
    expect(c.find(r => r.documento_id === 'boletas_facturas')!.obligatorio).toBe(true)
    expect(c.filter(r => r.documento_id === 'cert_accidente')).toHaveLength(1)
    expect(resumirChecklist(c).completo).toBe(false)
  })

  it('un producto nuevo genera su propio checklist sólo con configuración', () => {
    const c = generarChecklist(reglasBase('DESGRAVAMEN'), ['muerte'])
    expect(c.map(r => r.documento_id)).toEqual(['cert_defuncion', 'cert_saldo_insoluto', 'declaracion_salud'])
  })
})

describe('validaciones cruzadas y banderas rojas', () => {
  const ext = (campos: Record<string, string | null>, extra: Partial<ExtraccionDocumento> = {}): ExtraccionDocumento => ({
    tipo_documento_detectado: null,
    legible: true,
    posible_alteracion: false,
    observaciones: null,
    campos: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { valor: v, confianza: 0.9, pagina: 1, evidencia: null }])),
    ...extra,
  })

  it('compara nombres tolerando nombres omitidos y tildes', () => {
    expect(nombresConsistentes('Juan Pérez Soto', 'JUAN ANDRES PEREZ SOTO')).toBe(true)
    expect(nombresConsistentes('Juan Pérez Soto', 'María González')).toBe(false)
  })

  it('detecta patente distinta, boletas ajenas, denuncio tardío y póliza reciente', () => {
    const r = validarCaso(soap, post, {
      fecha_accidente: '2026-06-01',
      fecha_denuncio: '2026-08-01',
      patente: 'BBCL12',
      poliza_fecha_contratacion: '2026-05-20',
      coberturas: ['gastos_medicos'],
      personas: [{ rol: 'victima', nombre: 'Juan Pérez Soto', rut: '12345678-5' }],
      documentos: [
        { documento_id: 'parte_policial', extraccion: ext({ patente: 'BBCL13', fecha_accidente: '2026-06-01', nombre_victima: 'JUAN PEREZ SOTO', rut_victima: '12345678-5' }) },
        { documento_id: 'boletas_facturas', extraccion: ext({ prestador: 'Clínica' }, { comprobantes: [{ emisor: 'Clínica', rut_emisor: null, numero: '1', fecha: '2026-06-02', monto_clp: 100000, a_nombre_de: 'Pedro Rojas', confianza: 0.9 }] }) },
      ],
    })
    const codigos = r.banderas_rojas.map(b => b.codigo)
    expect(codigos).toEqual(expect.arrayContaining(['patente_no_coincide', 'boletas_no_victima', 'denuncio_tardio', 'poliza_reciente']))
    expect(r.validaciones.find(v => v.codigo === 'rut_valido')!.ok).toBe(true)
    expect(r.validaciones.find(v => v.codigo === 'nombre_victima_consistente')!.ok).toBe(true)
  })

  it('detecta prescripción y RUT inválido', () => {
    const r = validarCaso(soap, post, {
      fecha_accidente: '2025-01-10',
      fecha_denuncio: '2026-03-01',
      poliza_fecha_contratacion: '2024-12-01',
      coberturas: ['ipt'],
      personas: [{ rol: 'victima', nombre: 'Ana', rut: '12345678-9' }],
      documentos: [],
    })
    expect(r.validaciones.find(v => v.codigo === 'fecha_dentro_prescripcion')!.ok).toBe(false)
    expect(r.inconsistencias.map(i => i.codigo)).toContain('rut_invalido')
  })
})

describe('esquemas de extracción IA', () => {
  it('genera un JSON Schema estricto desde el catálogo', () => {
    const s = esquemaExtraccion(soap.catalogo_documentos.boletas_facturas) as { required: string[]; properties: Record<string, { required?: string[] }> }
    expect(s.required).toContain('comprobantes')
    expect(s.properties.campos.required).toEqual(['prestador'])
  })

  it('normaliza fechas, RUT, patentes y confianzas', () => {
    const doc = soap.catalogo_documentos.cert_accidente
    const n = normalizarExtraccion(doc, {
      tipo_documento_detectado: 'certificado',
      legible: true,
      posible_alteracion: false,
      observaciones: null,
      campos: {
        fecha_accidente: { valor: '05/03/2026', confianza: 1.4, pagina: 1, evidencia: null },
        patente: { valor: 'bb-cl-12', confianza: 0.8, pagina: 1, evidencia: null },
        rut_victima: { valor: '12.345.678-5', confianza: 0.9, pagina: 1, evidencia: null },
      },
    })
    expect(n.campos.fecha_accidente).toMatchObject({ valor: '2026-03-05', confianza: 1 })
    expect(n.campos.patente.valor).toBe('BBCL12')
    expect(n.campos.rut_victima.valor).toBe('12345678-5')
    expect(n.campos.lugar_accidente.valor).toBeNull()
  })
})
