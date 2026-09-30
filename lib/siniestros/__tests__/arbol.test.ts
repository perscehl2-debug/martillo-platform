import { describe, expect, it } from 'vitest'
import { clasificarIncapacidad, coberturasDesdeRespuestas, pasoBeneficiarios, validarFechas } from '../arbol'
import { buscarEnDemo, coberturaEnFecha, POLIZAS_DEMO } from '../polizas'
import { reglasBase, resolverRegimen } from '../reglas'
import { validarRut } from '../rut'

const soap = reglasBase('SOAP')
const poliza = (numero: string) => POLIZAS_DEMO.find(p => p.numero === numero)!

describe('pólizas de demostración', () => {
  it('se encuentran por número o por patente, sin importar formato', () => {
    expect(buscarEnDemo('soap-2026-100245')[0].vehiculo.patente).toBe('KJTR45')
    expect(buscarEnDemo('kj-tr-45')[0].numero).toBe('SOAP-2026-100245')
    expect(buscarEnDemo('NOEXISTE')).toEqual([])
  })

  it('tienen RUT válidos y su régimen sale de la fecha de contratación', () => {
    for (const p of POLIZAS_DEMO) if (p.tomador.rut) expect(validarRut(p.tomador.rut)).toBe(true)
    expect(resolverRegimen(soap, poliza('SOAP-2026-100245').fecha_contratacion).id).toBe('post_ley_jacinta')
    expect(resolverRegimen(soap, poliza('SOAP-2025-087311').fecha_contratacion).id).toBe('pre_ley_jacinta')
  })

  it('verifica la vigencia en la fecha del accidente', () => {
    const p = poliza('SOAP-2025-087311')
    expect(coberturaEnFecha(p, '2026-01-10')).toBe('cubierto')
    expect(coberturaEnFecha(p, '2026-05-01')).toBe('despues_vigencia')
  })
})

describe('árbol del denuncio', () => {
  it('clasifica la incapacidad según el grado (art. 27)', () => {
    expect(clasificarIncapacidad(70, soap).cobertura).toBe('ipt')
    expect(clasificarIncapacidad(45, soap).cobertura).toBe('ipp')
    expect(clasificarIncapacidad(20, soap).cobertura).toBeNull()
    expect(clasificarIncapacidad(null, soap).cobertura).toBeNull()
  })

  it('deriva las coberturas de las respuestas; muerte excluye incapacidad', () => {
    expect(coberturasDesdeRespuestas({ gastos_medicos: true, incapacidad: true, fallecimiento: false }, 50, soap)).toEqual(['gastos_medicos', 'ipp'])
    expect(coberturasDesdeRespuestas({ gastos_medicos: true, incapacidad: true, fallecimiento: true }, 80, soap)).toEqual(['gastos_medicos', 'muerte'])
    expect(coberturasDesdeRespuestas({ gastos_medicos: false, incapacidad: true, fallecimiento: false }, null, soap)).toEqual([])
  })

  it('recorre el orden de prelación y se detiene en la primera clase presente', () => {
    expect(pasoBeneficiarios({})).toEqual({ pregunta: 'conyuge', cobra: null })
    expect(pasoBeneficiarios({ conyuge: true })).toEqual({ pregunta: null, cobra: 'conyuge' })
    expect(pasoBeneficiarios({ conyuge: false })).toEqual({ pregunta: 'hijos', cobra: null })
    expect(pasoBeneficiarios({ conyuge: false, hijos: false, padres: true })).toEqual({ pregunta: null, cobra: 'padres' })
    expect(pasoBeneficiarios({ conyuge: false, hijos: false, padres: false, madre_hijos: false })).toEqual({ pregunta: null, cobra: 'herederos' })
  })

  it('valida fechas contra la póliza y marca banderas', () => {
    const vencida = validarFechas(poliza('SOAP-2025-087311'), soap, { fecha_accidente: '2026-05-01', fecha_denuncio: '2026-05-02' }, '2026-09-30')
    expect(vencida.some(a => a.nivel === 'bloqueo' && /fuera de la vigencia/.test(a.mensaje))).toBe(true)

    const reciente = validarFechas(poliza('SOAP-2026-100390'), soap, { fecha_accidente: '2026-09-25', fecha_denuncio: '2026-09-26' }, '2026-09-30')
    expect(reciente.some(a => a.nivel === 'advertencia' && /contratada 5 día/.test(a.mensaje))).toBe(true)
    expect(reciente.some(a => a.nivel === 'bloqueo')).toBe(false)

    const futura = validarFechas(poliza('SOAP-2026-100245'), soap, { fecha_accidente: '2026-12-01' }, '2026-09-30')
    expect(futura.some(a => a.nivel === 'bloqueo' && /futura/.test(a.mensaje))).toBe(true)

    const tardio = validarFechas(poliza('SOAP-2026-100245'), soap, { fecha_accidente: '2026-05-01', fecha_denuncio: '2026-07-15' }, '2026-09-30')
    expect(tardio.some(a => a.nivel === 'advertencia' && /art\. 8/.test(a.mensaje))).toBe(true)
  })
})
