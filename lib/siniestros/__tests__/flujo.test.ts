import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { analizarCaso, gradoIncapacidad, repartirPago } from '../analisis'
import { calcularPlazos, estadoPlazo } from '../plazos'
import { generarPdfInforme, type ContenidoInforme } from '../pdf/informe'
import { reglasBase, resolverRegimen } from '../reglas'
import type { ExtraccionDocumento } from '../tipos'

const soap = reglasBase('SOAP')
const UF = { fecha: '2026-09-22', valor: 40991 }

const ext = (campos: Record<string, string | null>, extra: Partial<ExtraccionDocumento> = {}): ExtraccionDocumento => ({
  tipo_documento_detectado: null,
  legible: true,
  posible_alteracion: false,
  observaciones: null,
  campos: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, { valor: v, confianza: 0.95, pagina: 1, evidencia: null }])),
  ...extra,
})

describe('flujo completo: muerte con gastos médicos (criterio Fase 3)', () => {
  const caso = {
    coberturas: ['muerte', 'gastos_medicos'],
    fecha_accidente: '2026-08-20',
    fecha_fallecimiento: '2026-08-25',
    fecha_denuncio: '2026-09-01',
    patente: 'BBCL12',
    poliza_fecha_contratacion: '2026-03-10',
    poliza_vigencia_desde: '2026-04-01',
    poliza_vigencia_hasta: '2027-03-31',
  }
  const personas = [
    { rol: 'victima' as const, nombre: 'Juan Pérez Soto', rut: '12345678-5' },
    { rol: 'beneficiario' as const, nombre: 'Ana Rojas', rut: '11111111-1', parentesco: 'conyuge' as const },
    { rol: 'beneficiario' as const, nombre: 'Luis Pérez', parentesco: 'padre' as const },
  ]
  const documentos = [
    { documento_id: 'parte_policial', extraccion: ext({ patente: 'BBCL12', fecha_accidente: '2026-08-20', nombre_victima: 'JUAN PEREZ SOTO' }) },
    { documento_id: 'cert_defuncion', extraccion: ext({ nombre_fallecido: 'Juan Andrés Pérez Soto', rut_fallecido: '12345678-5', fecha_defuncion: '2026-08-25' }) },
    {
      documento_id: 'boletas_facturas',
      extraccion: ext({ prestador: 'Clínica' }, {
        comprobantes: [
          { emisor: 'Clínica', rut_emisor: null, numero: '10', fecha: '2026-08-21', monto_clp: 40991 * 40, a_nombre_de: 'Juan Pérez', confianza: 0.9 },
          { emisor: 'Farmacia', rut_emisor: null, numero: '11', fecha: '2026-08-22', monto_clp: 40991 * 10, a_nombre_de: 'Juan Pérez Soto', confianza: 0.9 },
          { emisor: 'Óptica', rut_emisor: null, numero: '12', fecha: '2026-08-22', monto_clp: 99000, a_nombre_de: 'María González', confianza: 0.9 },
        ],
      }),
    },
  ]

  const r = analizarCaso({ reglas: soap, caso, personas, documentos, valor_uf: UF })

  it('usa el régimen post Ley Jacinta y deduce los gastos médicos de la muerte', () => {
    expect(r.regimen.id).toBe('post_ley_jacinta')
    const gm = r.calculo.find(c => c.cobertura === 'gastos_medicos')!
    const muerte = r.calculo.find(c => c.cobertura === 'muerte')!
    expect(gm.monto_uf).toBe(50)
    expect(gm.pasos.join(' ')).toMatch(/excluido.*María González/)
    expect(muerte.monto_uf).toBe(550)
    expect(r.total_uf).toBe(600)
    expect(r.total_clp).toBe(600 * 40991)
  })

  it('valida y marca bandera por boleta ajena', () => {
    expect(r.validacion.validaciones.find(v => v.codigo === 'patente_coincide')?.ok).toBe(true)
    expect(r.validacion.validaciones.find(v => v.codigo === 'fecha_accidente_dentro_vigencia')?.ok).toBe(true)
    expect(r.validacion.banderas_rojas.map(b => b.codigo)).toContain('boletas_no_victima')
  })

  it('el cónyuge cobra la muerte; los gastos van a la víctima/quien pagó', () => {
    expect(r.beneficiarios?.clase).toBe('conyuge')
    const pago = repartirPago(r.calculo, r.beneficiarios, personas[0])
    expect(pago).toEqual([
      { nombre: 'Ana Rojas', rut: '11111111-1', cuota: 1, monto_clp: 550 * 40991 },
      { nombre: 'Juan Pérez Soto', rut: '12345678-5', cuota: 1, monto_clp: 50 * 40991 },
    ])
  })

  it('alerta a 45 días (liquidación) y 7 días hábiles (pago en muerte)', () => {
    const plazos = calcularPlazos(soap, r.regimen, { ...caso, fecha_antecedentes_completos: '2026-10-01' })
    const liq = plazos.find(p => p.tipo === 'liquidacion')!
    const pago = plazos.find(p => p.tipo === 'pago_muerte')!
    expect(liq.fecha_limite).toBe('2026-10-16')
    expect(pago.fecha_limite).toBe('2026-10-13')
    expect(estadoPlazo(liq, '2026-10-14').estado).toBe('critico')
    expect(estadoPlazo(pago, '2026-10-14').estado).toBe('vencido')
  })
})

describe('grado de incapacidad', () => {
  it('prioriza liquidador > COMPIN > médico tratante', () => {
    const docs = [
      { documento_id: 'cert_medico_incapacidad', extraccion: ext({ grado_incapacidad_pct: '45' }) },
      { documento_id: 'cert_compin', extraccion: ext({ grado_incapacidad_pct: '52,5' }) },
    ]
    expect(gradoIncapacidad(docs)).toBeCloseTo(0.525)
    expect(gradoIncapacidad(docs.slice(0, 1))).toBeCloseTo(0.45)
    expect(gradoIncapacidad(docs, 0.7)).toBe(0.7)
  })
})

describe('PDF de informe (criterio Fase 4)', () => {
  it('genera un PDF con trazabilidad', async () => {
    const regimen = resolverRegimen(soap, '2026-03-10')
    const contenido: ContenidoInforme = {
      tipo: 'finiquito',
      caso: {
        numero: 'SOAP-2026-000001', producto: 'SOAP', producto_nombre: soap.nombre, variante: 'SOAP', regimen: regimen.id, regimen_nombre: regimen.nombre ?? null,
        version_reglas: soap.version_reglas, poliza_numero: '123', poliza_fecha_contratacion: '2026-03-10', patente: 'BBCL12', fecha_accidente: '2026-08-20',
        fecha_denuncio: '2026-09-01', lugar_accidente: 'Ñuñoa', relato: 'Atropello → lesiones ≥ graves', tipo_liquidacion: 'registrada',
      },
      personas: [{ rol: 'victima', nombre: 'Juan Pérez Soto', rut: '12345678-5', parentesco: null }],
      beneficiarios: [{ nombre: 'Ana Rojas', rut: '11111111-1', cuota: 1, monto_clp: 22545050 }],
      coberturas: [],
      total_uf: 550,
      total_clp: 22545050,
      valor_uf: UF,
      validaciones: [],
      observaciones: [],
      resumen: null,
      conclusion: 'Procede el pago.',
      redactado_por: { id: 'a', nombre: 'Liquidador Uno' },
      aprobado_por: { id: 'b', nombre: 'Supervisora', fecha: '2026-10-05T12:00:00Z' },
      generado_at: '2026-10-05T12:00:00.000Z',
    }
    const bytes = await generarPdfInforme(contenido)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(doc.getTitle()).toBe('FINIQUITO Y ORDEN DE PAGO SOAP-2026-000001')
    expect(doc.getAuthor()).toBe('Liquidador Uno')
  })
})
