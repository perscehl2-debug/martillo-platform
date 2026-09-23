// Validaciones cruzadas entre los datos del caso y lo extraído de los
// documentos, más banderas rojas de fraude (no bloqueantes: indican que el
// caso requiere revisión humana adicional, no que exista fraude).
import { resolverBeneficiarios } from './beneficiarios'
import { diasEntre, sumarMeses } from './fechas'
import { mismaPatente, normalizarPatente } from './patente'
import { mismoRut, validarRut } from './rut'
import type { ExtraccionDocumento, Hallazgo, Persona, RegimenCobertura, ReglasProducto } from './tipos'

export interface DocumentoExtraido {
  documento_id: string
  nombre_archivo?: string
  extraccion: ExtraccionDocumento
}

export interface DatosValidacion {
  fecha_accidente: string
  fecha_denuncio: string
  fecha_aviso?: string | null
  fecha_fallecimiento?: string | null
  patente?: string | null
  poliza_fecha_contratacion: string
  poliza_vigencia_desde?: string | null
  poliza_vigencia_hasta?: string | null
  coberturas: string[]
  personas: Persona[]
  documentos: DocumentoExtraido[]
  /** Otros casos con la misma patente o RUT de víctima (detectados en BD). */
  casos_vinculados?: number
  /** Suma de gastos médicos solicitados en UF (si ya se calculó). */
  gastos_medicos_solicitados_uf?: number
}

export interface ResultadoValidacion {
  codigo: string
  ok: boolean | null
  mensaje: string
}

export interface InformeValidacion {
  validaciones: ResultadoValidacion[]
  inconsistencias: Hallazgo[]
  banderas_rojas: Hallazgo[]
  indicios_exclusion: Hallazgo[]
}

export function normalizarNombre(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !['DE', 'DEL', 'LA', 'LOS', 'LAS', 'Y'].includes(t))
}

/** Dos nombres son consistentes si comparten la mayoría de sus tokens (tolera un segundo nombre o apellido omitido). */
export function nombresConsistentes(a: string, b: string): boolean {
  const ta = new Set(normalizarNombre(a))
  const tb = new Set(normalizarNombre(b))
  if (ta.size === 0 || tb.size === 0) return false
  const comunes = Array.from(ta).filter(t => tb.has(t)).length
  const menor = Math.min(ta.size, tb.size)
  return comunes >= Math.min(2, menor) && comunes / menor >= 0.66
}

function valor(doc: DocumentoExtraido, campo: string): string | null {
  const v = doc.extraccion.campos?.[campo]?.valor
  return v === undefined || v === null || v === '' ? null : String(v)
}

function valoresCampo(docs: DocumentoExtraido[], campos: string[]): { doc: DocumentoExtraido; campo: string; valor: string }[] {
  const out: { doc: DocumentoExtraido; campo: string; valor: string }[] = []
  for (const doc of docs) {
    for (const campo of campos) {
      const v = valor(doc, campo)
      if (v) out.push({ doc, campo, valor: v })
    }
  }
  return out
}

const nombreDoc = (reglas: ReglasProducto, d: DocumentoExtraido) =>
  reglas.catalogo_documentos[d.documento_id]?.nombre ?? d.documento_id

export function validarCaso(reglas: ReglasProducto, regimen: RegimenCobertura, datos: DatosValidacion): InformeValidacion {
  const activas = new Set(reglas.validaciones_cruzadas ?? [])
  const validaciones: ResultadoValidacion[] = []
  const inconsistencias: Hallazgo[] = []
  const banderas: Hallazgo[] = []
  const indicios: Hallazgo[] = []
  const docs = datos.documentos
  const victima = datos.personas.find(p => p.rol === 'victima')

  // ── RUT ─────────────────────────────────────────────────────────
  if (activas.has('rut_valido')) {
    const ruts = [
      ...datos.personas.filter(p => p.rut).map(p => ({ origen: `${p.rol} ${p.nombre}`, rut: p.rut as string })),
      ...docs.flatMap(d =>
        Object.entries(d.extraccion.campos ?? {})
          .filter(([id, c]) => id.startsWith('rut') && c.valor)
          .map(([id, c]) => ({ origen: `${nombreDoc(reglas, d)} (${id})`, rut: c.valor as string })),
      ),
    ]
    const invalidos = ruts.filter(r => !validarRut(r.rut))
    for (const r of invalidos) {
      inconsistencias.push({ codigo: 'rut_invalido', severidad: 'error', mensaje: `RUT con dígito verificador inválido: ${r.rut} (${r.origen})` })
    }
    validaciones.push({
      codigo: 'rut_valido',
      ok: ruts.length === 0 ? null : invalidos.length === 0,
      mensaje: ruts.length === 0 ? 'Sin RUT para validar' : `${ruts.length - invalidos.length}/${ruts.length} RUT válidos`,
    })

    if (victima?.rut) {
      const rutsVictima = valoresCampo(docs, ['rut_victima', 'rut_fallecido', 'rut_paciente'])
      for (const r of rutsVictima) {
        if (!mismoRut(r.valor, victima.rut)) {
          inconsistencias.push({
            codigo: 'rut_victima_distinto',
            severidad: 'error',
            mensaje: `El RUT de la víctima en ${nombreDoc(reglas, r.doc)} (${r.valor}) no coincide con el del caso (${victima.rut})`,
          })
        }
      }
    }
  }

  // ── Patente ─────────────────────────────────────────────────────
  if (activas.has('patente_coincide')) {
    const patentes = valoresCampo(docs, ['patente'])
    const referencia = datos.patente ?? patentes[0]?.valor ?? null
    const distintas = patentes.filter(p => !mismaPatente(p.valor, referencia))
    for (const p of distintas) {
      inconsistencias.push({
        codigo: 'patente_distinta',
        severidad: 'error',
        mensaje: `Patente ${normalizarPatente(p.valor)} en ${nombreDoc(reglas, p.doc)} no coincide con ${normalizarPatente(referencia)}`,
      })
    }
    if (distintas.length > 0) {
      banderas.push({ codigo: 'patente_no_coincide', severidad: 'advertencia', mensaje: 'La patente no coincide entre certificado SOAP, parte policial y/o denuncia.' })
    }
    validaciones.push({
      codigo: 'patente_coincide',
      ok: patentes.length === 0 ? null : distintas.length === 0,
      mensaje: patentes.length === 0 ? 'Sin patentes extraídas' : distintas.length === 0 ? 'Patente consistente en todos los documentos' : `${distintas.length} documento(s) con patente distinta`,
    })
  }

  // ── Fecha del accidente ────────────────────────────────────────
  const fechasAccidente = valoresCampo(docs, ['fecha_accidente'])
  const fechasDistintas = fechasAccidente.filter(f => f.valor.slice(0, 10) !== datos.fecha_accidente)
  for (const f of fechasDistintas) {
    inconsistencias.push({
      codigo: 'fecha_accidente_distinta',
      severidad: 'advertencia',
      mensaje: `Fecha de accidente ${f.valor} en ${nombreDoc(reglas, f.doc)} difiere de la registrada (${datos.fecha_accidente})`,
    })
  }
  if (fechasDistintas.length > 0) {
    banderas.push({ codigo: 'inconsistencia_fechas', severidad: 'advertencia', mensaje: 'Inconsistencias de fechas entre documentos.' })
  }

  if (activas.has('fecha_accidente_dentro_vigencia')) {
    const soap = docs.find(d => d.documento_id === 'certificado_soap')
    const desde = datos.poliza_vigencia_desde ?? (soap && valor(soap, 'vigencia_desde'))
    const hasta = datos.poliza_vigencia_hasta ?? (soap && valor(soap, 'vigencia_hasta'))
    if (!desde || !hasta) {
      validaciones.push({ codigo: 'fecha_accidente_dentro_vigencia', ok: null, mensaje: 'Vigencia de la póliza no informada' })
    } else {
      const ok = datos.fecha_accidente >= desde.slice(0, 10) && datos.fecha_accidente <= hasta.slice(0, 10)
      validaciones.push({ codigo: 'fecha_accidente_dentro_vigencia', ok, mensaje: ok ? `Accidente dentro de la vigencia ${desde} a ${hasta}` : `Accidente fuera de la vigencia ${desde} a ${hasta}` })
      if (!ok) inconsistencias.push({ codigo: 'fuera_vigencia', severidad: 'error', mensaje: 'La fecha del accidente está fuera de la vigencia de la póliza.' })
    }
    const fechaContratacionDoc = soap && valor(soap, 'fecha_contratacion')
    if (fechaContratacionDoc && fechaContratacionDoc.slice(0, 10) !== datos.poliza_fecha_contratacion) {
      inconsistencias.push({
        codigo: 'fecha_contratacion_distinta',
        severidad: 'error',
        mensaje: `La fecha de contratación del certificado SOAP (${fechaContratacionDoc}) difiere de la registrada (${datos.poliza_fecha_contratacion}); afecta el régimen de topes.`,
      })
    }
  }

  if (activas.has('fecha_dentro_prescripcion')) {
    const inicio = datos.fecha_fallecimiento ?? datos.fecha_accidente
    const limite = sumarMeses(inicio, reglas.plazos.prescripcion_meses ?? 12)
    const ok = datos.fecha_denuncio <= limite
    validaciones.push({ codigo: 'fecha_dentro_prescripcion', ok, mensaje: ok ? `Denuncio dentro del plazo de prescripción (hasta ${limite})` : `Denuncio posterior a la prescripción (${limite})` })
    if (!ok) inconsistencias.push({ codigo: 'prescrito', severidad: 'error', mensaje: 'La acción estaría prescrita (art. 13).' })
  }

  // ── Denuncio tardío y póliza cercana al accidente ─────────────
  const aviso = datos.fecha_aviso ?? datos.fecha_denuncio
  const diasAviso = diasEntre(datos.fecha_accidente, aviso)
  if (reglas.plazos.aviso_dias !== undefined && diasAviso > reglas.plazos.aviso_dias) {
    banderas.push({ codigo: 'denuncio_tardio', severidad: 'advertencia', mensaje: `Aviso ${diasAviso} días después del accidente (plazo ${reglas.plazos.aviso_dias}). Verificar impedimento justificado.` })
  }
  const umbralPoliza = reglas.banderas?.poliza_cercana_accidente_dias ?? 30
  const diasPoliza = diasEntre(datos.poliza_fecha_contratacion, datos.fecha_accidente)
  if (diasPoliza >= 0 && diasPoliza <= umbralPoliza) {
    banderas.push({ codigo: 'poliza_reciente', severidad: 'advertencia', mensaje: `Póliza contratada ${diasPoliza} día(s) antes del accidente.` })
  }
  if (diasPoliza < 0) {
    inconsistencias.push({ codigo: 'poliza_posterior', severidad: 'error', mensaje: 'La póliza fue contratada después del accidente.' })
  }

  // ── Nombre de la víctima ──────────────────────────────────────
  if (activas.has('nombre_victima_consistente') && victima) {
    const nombres = valoresCampo(docs, ['nombre_victima', 'nombre_fallecido', 'nombre_paciente', 'nombre_deudor'])
    const cedula = docs.filter(d => d.documento_id === 'cedula_victima')
    nombres.push(...valoresCampo(cedula, ['nombre']))
    const distintos = nombres.filter(n => !nombresConsistentes(n.valor, victima.nombre))
    for (const n of distintos) {
      inconsistencias.push({ codigo: 'nombre_victima_distinto', severidad: 'advertencia', mensaje: `Nombre "${n.valor}" en ${nombreDoc(reglas, n.doc)} no coincide con "${victima.nombre}"` })
    }
    validaciones.push({
      codigo: 'nombre_victima_consistente',
      ok: nombres.length === 0 ? null : distintos.length === 0,
      mensaje: nombres.length === 0 ? 'Sin nombres extraídos' : distintos.length === 0 ? 'Nombre consistente entre documentos' : `${distintos.length} documento(s) con nombre distinto`,
    })
  }

  // ── Beneficiarios ─────────────────────────────────────────────
  if (activas.has('beneficiario_orden_prelacion') && datos.coberturas.includes('muerte')) {
    const fecha = datos.fecha_fallecimiento ?? datos.fecha_accidente
    const prelacion = resolverBeneficiarios(datos.personas, fecha)
    const ok = prelacion.beneficiarios.length > 0
    validaciones.push({
      codigo: 'beneficiario_orden_prelacion',
      ok,
      mensaje: ok
        ? `Cobra: ${prelacion.nombre_clase} (${prelacion.beneficiarios.map(b => b.nombre).join(', ')})`
        : 'Sin beneficiario acreditado según art. 31',
    })
    for (const e of prelacion.excluidos) {
      inconsistencias.push({ codigo: 'beneficiario_excluido', severidad: 'info', mensaje: `${e.persona.nombre}: ${e.motivo}` })
    }
    const acreditados = valoresCampo(docs.filter(d => d.documento_id === 'acredita_beneficiario'), ['rut_beneficiario'])
    for (const a of acreditados) {
      if (!prelacion.beneficiarios.some(b => mismoRut(b.rut, a.valor))) {
        inconsistencias.push({ codigo: 'beneficiario_no_prelacion', severidad: 'advertencia', mensaje: `El beneficiario acreditado (${a.valor}) no corresponde a la clase que cobra según el orden de prelación.` })
      }
    }
  }

  // ── Comprobantes de gastos médicos ────────────────────────────
  if (activas.has('boletas_a_nombre_victima') && victima) {
    const comprobantes = docs.flatMap(d => d.extraccion.comprobantes ?? [])
    const ajenos = comprobantes.filter(c => c.a_nombre_de && !nombresConsistentes(c.a_nombre_de, victima.nombre))
    for (const c of ajenos) {
      inconsistencias.push({ codigo: 'boleta_ajena', severidad: 'advertencia', mensaje: `Comprobante ${c.numero ?? ''} de ${c.emisor ?? 'emisor desconocido'} a nombre de "${c.a_nombre_de}"` })
    }
    if (ajenos.length > 0) {
      banderas.push({ codigo: 'boletas_no_victima', severidad: 'advertencia', mensaje: `${ajenos.length} comprobante(s) no emitidos a nombre de la víctima.` })
    }
    const anteriores = comprobantes.filter(c => c.fecha && c.fecha.slice(0, 10) < datos.fecha_accidente)
    for (const c of anteriores) {
      inconsistencias.push({ codigo: 'boleta_anterior_accidente', severidad: 'advertencia', mensaje: `Comprobante ${c.numero ?? ''} fechado ${c.fecha}, antes del accidente.` })
    }
    validaciones.push({
      codigo: 'boletas_a_nombre_victima',
      ok: comprobantes.length === 0 ? null : ajenos.length === 0,
      mensaje: comprobantes.length === 0 ? 'Sin comprobantes extraídos' : `${comprobantes.length - ajenos.length}/${comprobantes.length} comprobantes a nombre de la víctima`,
    })
  }

  if (activas.has('suma_comprobantes_vs_tope') && datos.gastos_medicos_solicitados_uf !== undefined) {
    const tope = regimen.topes_uf.gastos_medicos
    const ok = datos.gastos_medicos_solicitados_uf <= tope
    validaciones.push({ codigo: 'suma_comprobantes_vs_tope', ok, mensaje: `Gastos solicitados ${datos.gastos_medicos_solicitados_uf.toFixed(2)} UF vs tope ${tope} UF` })
  }

  // ── Calidad documental y exclusiones ──────────────────────────
  for (const d of docs) {
    if (d.extraccion.posible_alteracion) {
      banderas.push({ codigo: 'posible_alteracion', severidad: 'advertencia', mensaje: `Posible alteración en ${nombreDoc(reglas, d)}: ${d.extraccion.observaciones ?? 'revisar original'}` })
    }
    if (!d.extraccion.legible) {
      inconsistencias.push({ codigo: 'documento_ilegible', severidad: 'advertencia', mensaje: `${nombreDoc(reglas, d)} no es legible; solicitar nueva copia u OCR dedicado.` })
    }
    const indicio = valor(d, 'indicio_exclusion')
    if (indicio) {
      indicios.push({ codigo: 'indicio_exclusion', severidad: 'advertencia', mensaje: `Posible exclusión (art. 34) según ${nombreDoc(reglas, d)}: ${indicio}` })
    }
  }

  if ((datos.casos_vinculados ?? 0) > 0) {
    banderas.push({ codigo: 'siniestros_vinculados', severidad: 'advertencia', mensaje: `${datos.casos_vinculados} otro(s) caso(s) con la misma patente o víctima.` })
  }

  return { validaciones, inconsistencias, banderas_rojas: banderas, indicios_exclusion: indicios }
}
