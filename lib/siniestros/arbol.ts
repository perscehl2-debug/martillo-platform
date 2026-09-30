// Árbol de decisión del denuncio: cada respuesta abre (o cierra) las
// siguientes preguntas y va determinando las coberturas automáticamente.
// Lógica pura, compartida por el asistente (cliente) y la API (servidor).
import { diasEntre, sumarMeses } from './fechas'
import { coberturaEnFecha, type Poliza } from './polizas'
import type { ReglasProducto } from './tipos'

export type TipoVictima = 'conductor' | 'pasajero' | 'peaton' | 'ciclista' | 'otro_vehiculo'

export const TIPOS_VICTIMA: { id: TipoVictima; nombre: string; ayuda: string }[] = [
  { id: 'conductor', nombre: 'Conductor del vehículo asegurado', ayuda: 'Quien manejaba el vehículo de la póliza' },
  { id: 'pasajero', nombre: 'Pasajero del vehículo asegurado', ayuda: 'Iba dentro del vehículo de la póliza' },
  { id: 'peaton', nombre: 'Peatón', ayuda: 'Atropellado por el vehículo asegurado' },
  { id: 'ciclista', nombre: 'Ciclista o motociclista', ayuda: 'Iba en bicicleta, scooter o moto' },
  { id: 'otro_vehiculo', nombre: 'Ocupante de otro vehículo', ayuda: 'Iba en el otro vehículo involucrado' },
]

export interface Consecuencias {
  gastos_medicos: boolean
  incapacidad: boolean
  fallecimiento: boolean
}

export interface ClasificacionIncapacidad {
  cobertura: 'ipt' | 'ipp' | null
  mensaje: string
}

/** Art. 27: ≥ 2/3 total; entre 30 % y 2/3 parcial; bajo 30 % no hay indemnización por incapacidad. */
export function clasificarIncapacidad(gradoPct: number | null, reglas: ReglasProducto): ClasificacionIncapacidad {
  if (gradoPct === null || Number.isNaN(gradoPct)) {
    return { cobertura: null, mensaje: 'Sin certificado aún: la incapacidad se podrá agregar cuando llegue el certificado del médico tratante (plazo 2 años desde el accidente).' }
  }
  const g = gradoPct / 100
  const ipt = reglas.incapacidad?.umbral_ipt ?? 2 / 3
  const ipp = reglas.incapacidad?.umbral_ipp ?? 0.3
  if (g >= ipt) return { cobertura: 'ipt', mensaje: `${gradoPct}% ≥ 66,7 %: incapacidad permanente TOTAL.` }
  if (g >= ipp) return { cobertura: 'ipp', mensaje: `${gradoPct}% entre 30 % y 66,7 %: incapacidad permanente PARCIAL (monto proporcional al grado).` }
  return { cobertura: null, mensaje: `${gradoPct}% < 30 %: no procede indemnización por incapacidad (art. 27); sí gastos médicos.` }
}

/** Coberturas que se desprenden de las respuestas del árbol. */
export function coberturasDesdeRespuestas(c: Consecuencias, gradoPct: number | null, reglas: ReglasProducto): string[] {
  const out: string[] = []
  if (c.gastos_medicos) out.push('gastos_medicos')
  if (c.fallecimiento) {
    out.push('muerte')
  } else if (c.incapacidad) {
    const cls = clasificarIncapacidad(gradoPct, reglas)
    if (cls.cobertura) out.push(cls.cobertura)
  }
  return out.filter(id => reglas.coberturas.some(x => x.id === id))
}

// ─── Beneficiarios (art. 31) como árbol ──────────────────────
export interface RespuestasBeneficiarios {
  conyuge?: boolean | null
  hijos?: boolean | null
  padres?: boolean | null
  madre_hijos?: boolean | null
}

export type PasoBeneficiarios = 'conyuge' | 'hijos' | 'padres' | 'madre_hijos' | 'herederos'

export const PREGUNTAS_BENEFICIARIOS: Record<PasoBeneficiarios, string> = {
  conyuge: '¿La víctima estaba casada (tiene cónyuge sobreviviente)?',
  hijos: '¿Tenía hijos?',
  padres: '¿Viven su padre o su madre?',
  madre_hijos: '¿Existe la madre de hijos de filiación no matrimonial?',
  herederos: 'Cobran los herederos con posesión efectiva (incluye al conviviente civil).',
}

/**
 * Devuelve la clase que cobra (la primera respondida con "sí") o la siguiente
 * pregunta a hacer. La prelación es excluyente: una vez encontrada una clase,
 * no se preguntan las siguientes.
 */
export function pasoBeneficiarios(r: RespuestasBeneficiarios): { pregunta: PasoBeneficiarios | null; cobra: PasoBeneficiarios | null } {
  const orden: Exclude<PasoBeneficiarios, 'herederos'>[] = ['conyuge', 'hijos', 'padres', 'madre_hijos']
  for (const paso of orden) {
    const v = r[paso]
    if (v === true) return { pregunta: null, cobra: paso }
    if (v === undefined || v === null) return { pregunta: paso, cobra: null }
  }
  return { pregunta: null, cobra: 'herederos' }
}

// ─── Validaciones automáticas de fechas contra la póliza ─────
export interface AvisoArbol {
  nivel: 'bloqueo' | 'advertencia' | 'ok'
  mensaje: string
}

export function validarFechas(
  poliza: Poliza,
  reglas: ReglasProducto,
  f: { fecha_accidente?: string; fecha_denuncio?: string; fecha_fallecimiento?: string | null },
  hoy: string,
): AvisoArbol[] {
  const avisos: AvisoArbol[] = []
  const acc = f.fecha_accidente
  if (!acc) return avisos
  if (acc > hoy) avisos.push({ nivel: 'bloqueo', mensaje: 'La fecha del accidente no puede ser futura.' })
  const cob = coberturaEnFecha(poliza, acc)
  if (cob === 'anulada') avisos.push({ nivel: 'bloqueo', mensaje: 'La póliza está anulada.' })
  else if (cob !== 'cubierto') {
    avisos.push({ nivel: 'bloqueo', mensaje: `El accidente (${acc}) está fuera de la vigencia de la póliza (${poliza.vigencia_desde} a ${poliza.vigencia_hasta}).` })
  } else {
    avisos.push({ nivel: 'ok', mensaje: 'Accidente dentro de la vigencia de la póliza.' })
  }
  const diasPoliza = diasEntre(poliza.fecha_contratacion, acc)
  const umbral = reglas.banderas?.poliza_cercana_accidente_dias ?? 30
  if (diasPoliza >= 0 && diasPoliza <= umbral) {
    avisos.push({ nivel: 'advertencia', mensaje: `Póliza contratada ${diasPoliza} día(s) antes del accidente (bandera roja: revisar).` })
  }
  const den = f.fecha_denuncio
  if (den) {
    if (den < acc) avisos.push({ nivel: 'bloqueo', mensaje: 'El denuncio no puede ser anterior al accidente.' })
    const inicio = f.fecha_fallecimiento ?? acc
    const prescribe = sumarMeses(inicio, reglas.plazos.prescripcion_meses ?? 12)
    if (den > prescribe) avisos.push({ nivel: 'advertencia', mensaje: `La acción estaría prescrita desde el ${prescribe} (art. 13).` })
    const dias = diasEntre(acc, den)
    const aviso = reglas.plazos.aviso_dias
    if (aviso !== undefined && dias > aviso) {
      avisos.push({ nivel: 'advertencia', mensaje: `Denuncio ${dias} días después del accidente (plazo de aviso ${aviso} días, art. 8): verificar impedimento justificado.` })
    }
  }
  if (f.fecha_fallecimiento && f.fecha_fallecimiento < acc) {
    avisos.push({ nivel: 'bloqueo', mensaje: 'La fecha de fallecimiento no puede ser anterior al accidente.' })
  }
  return avisos
}
