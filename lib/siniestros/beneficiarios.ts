// Orden de prelación de beneficiarios en caso de muerte (Ley 18.490 art. 31).
import { diasEntre, sumarMeses } from './fechas'
import type { Persona } from './tipos'

export type ClaseBeneficiario =
  | 'conyuge'
  | 'hijos_menores'
  | 'hijos_mayores'
  | 'padres'
  | 'madre_hijos_no_matrimoniales'
  | 'herederos'

export const ORDEN_PRELACION: { clase: ClaseBeneficiario; nombre: string }[] = [
  { clase: 'conyuge', nombre: 'Cónyuge sobreviviente' },
  { clase: 'hijos_menores', nombre: 'Hijos menores de edad' },
  { clase: 'hijos_mayores', nombre: 'Hijos mayores de edad' },
  { clase: 'padres', nombre: 'Padres' },
  { clase: 'madre_hijos_no_matrimoniales', nombre: 'Madre de los hijos de filiación no matrimonial' },
  { clase: 'herederos', nombre: 'Herederos (posesión efectiva)' },
]

export function esMenorDeEdad(fechaNacimiento: string, aFecha: string): boolean {
  return diasEntre(sumarMeses(fechaNacimiento, 18 * 12), aFecha) < 0
}

export function claseDe(p: Persona, fechaFallecimiento: string): ClaseBeneficiario | null {
  switch (p.parentesco) {
    case 'conyuge':
      return 'conyuge'
    case 'hijo':
      if (!p.fecha_nacimiento) return 'hijos_mayores'
      return esMenorDeEdad(p.fecha_nacimiento, fechaFallecimiento) ? 'hijos_menores' : 'hijos_mayores'
    case 'padre':
    case 'madre':
      return 'padres'
    case 'madre_hijos_no_matrimoniales':
      return 'madre_hijos_no_matrimoniales'
    case 'heredero':
    case 'conviviente_civil':
      // El conviviente civil sólo cobra como heredero (spec §Key Findings, art. 31).
      return p.acredita_posesion_efectiva ? 'herederos' : null
    default:
      return null
  }
}

export interface ResultadoPrelacion {
  clase: ClaseBeneficiario | null
  nombre_clase: string | null
  beneficiarios: (Persona & { cuota: number })[]
  excluidos: { persona: Persona; motivo: string }[]
  advertencias: string[]
}

/**
 * Determina quiénes cobran: la primera clase con personas presentes excluye
 * a las siguientes. Dentro de la clase se reparte por partes iguales
 * (supuesto a confirmar con la compañía).
 */
export function resolverBeneficiarios(personas: Persona[], fechaFallecimiento: string): ResultadoPrelacion {
  const candidatos = personas.filter(p => p.rol === 'beneficiario')
  const advertencias: string[] = []
  const conClase = candidatos.map(p => ({ p, clase: claseDe(p, fechaFallecimiento) }))
  const excluidos: ResultadoPrelacion['excluidos'] = []

  for (const { p, clase } of conClase) {
    if (!clase) {
      excluidos.push({
        persona: p,
        motivo: p.parentesco === 'conviviente_civil'
          ? 'Conviviente civil sin posesión efectiva: sólo cobra como heredero.'
          : 'Parentesco no contemplado en el art. 31.',
      })
    }
  }

  for (const { clase, nombre } of ORDEN_PRELACION) {
    const enClase = conClase.filter(x => x.clase === clase).map(x => x.p)
    if (enClase.length === 0) continue
    if (clase === 'herederos') {
      const conviv = enClase.filter(p => p.parentesco === 'conviviente_civil')
      if (conviv.length > 0) {
        advertencias.push('El conviviente civil cobra como heredero sólo si no existen cónyuge, hijos ni padres.')
      }
    }
    for (const x of conClase) {
      if (x.clase && x.clase !== clase && !enClase.includes(x.p)) {
        excluidos.push({ persona: x.p, motivo: `Desplazado por clase preferente: ${nombre}.` })
      }
    }
    const cuota = 1 / enClase.length
    return {
      clase,
      nombre_clase: nombre,
      beneficiarios: enClase.map(p => ({ ...p, cuota })),
      excluidos,
      advertencias,
    }
  }

  advertencias.push('No hay beneficiarios acreditados para el caso de muerte.')
  return { clase: null, nombre_clase: null, beneficiarios: [], excluidos, advertencias }
}
