// Extracción documental y análisis de caso con la API de Claude, usando salida
// estructurada (output_config.format = json_schema) para evitar parsing frágil.
//
// Cumplimiento (Ley 19.628 / 21.719): usar sólo una API key de organización
// con acuerdo de no entrenamiento y, cuando sea posible, retención cero. Nunca
// enviar estos documentos por interfaces de consumo.
import Anthropic from '@anthropic-ai/sdk'
import { limpiarRut } from '../rut'
import { normalizarPatente } from '../patente'
import type { DocumentoCatalogo, ExtraccionDocumento } from '../tipos'
import { esquemaAnalisis, esquemaExtraccion } from './esquemas'

export const MODELO_IA = process.env.ANTHROPIC_MODEL || 'claude-opus-5'

const PROMPT_EXTRACCION =
  'Eres un asistente de un liquidador de seguros en Chile. Extrae del documento los campos solicitados en el esquema. ' +
  'No inventes datos: si un campo no aparece, devuélvelo como null y baja el nivel de confianza. ' +
  'Devuelve para cada campo el valor, el nivel de confianza (0-1) y la ubicación/evidencia (página). ' +
  'No emitas juicios de cobertura; sólo extrae datos.'

const PROMPT_ANALISIS =
  'Eres un asistente de un liquidador de seguros en Chile. Recibirás los datos del caso, las reglas del producto, ' +
  'las validaciones cruzadas y el cálculo de indemnización ya realizados por el sistema. Genera: un resumen ejecutivo; ' +
  'observaciones adicionales (inconsistencias, posibles banderas rojas de fraude, dudas de cobertura o exclusiones del ' +
  'art. 34 de la Ley 18.490); recomendaciones de gestión; y antecedentes adicionales sugeridos. No recalcules montos ni ' +
  'cambies el cálculo del sistema: si crees que tiene un error, indícalo como observación. Una bandera roja no implica ' +
  'fraude. Todo es una propuesta sujeta a revisión humana del liquidador.'

let cliente: Anthropic | null = null
function claude(): Anthropic {
  if (!cliente) cliente = new Anthropic()
  return cliente
}

export class ErrorIA extends Error {}

async function solicitarJson(
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  schema: Record<string, unknown>,
): Promise<{ json: unknown; modelo: string }> {
  const respuesta = await claude()
    .beta.messages.stream({
      model: MODELO_IA,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content }],
    })
    .finalMessage()

  if (respuesta.stop_reason === 'refusal') {
    throw new ErrorIA('El modelo declinó procesar el documento; requiere revisión manual.')
  }
  if (respuesta.stop_reason === 'max_tokens') {
    throw new ErrorIA('La respuesta del modelo quedó truncada; reintentar o dividir el documento.')
  }
  const texto = respuesta.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  if (!texto) throw new ErrorIA('El modelo no devolvió contenido.')
  try {
    return { json: JSON.parse(texto), modelo: respuesta.model }
  } catch {
    throw new ErrorIA('La respuesta del modelo no es JSON válido.')
  }
}

function normalizarFecha(v: string): string {
  const m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v
}

/** Normaliza formatos y acota confianzas a [0, 1]. */
export function normalizarExtraccion(doc: DocumentoCatalogo, bruto: ExtraccionDocumento): ExtraccionDocumento {
  const campos: ExtraccionDocumento['campos'] = {}
  for (const def of doc.campos) {
    const c = bruto.campos?.[def.id]
    if (!c) {
      campos[def.id] = { valor: null, confianza: 0, pagina: null, evidencia: null }
      continue
    }
    let valor = c.valor === null || c.valor === undefined ? null : String(c.valor).trim() || null
    if (valor) {
      if (def.tipo === 'fecha') valor = normalizarFecha(valor)
      if (def.tipo === 'rut') {
        const l = limpiarRut(valor)
        valor = l.length >= 2 ? `${l.slice(0, -1)}-${l.slice(-1)}` : valor
      }
      if (def.tipo === 'numero') valor = valor.replace(/\$|\s/g, '')
      if (def.tipo === 'patente') valor = normalizarPatente(valor)
    }
    campos[def.id] = {
      valor,
      confianza: Math.max(0, Math.min(1, Number(c.confianza) || 0)),
      pagina: c.pagina ?? null,
      evidencia: c.evidencia ?? null,
    }
  }
  return {
    tipo_documento_detectado: bruto.tipo_documento_detectado ?? null,
    legible: bruto.legible !== false,
    posible_alteracion: !!bruto.posible_alteracion,
    observaciones: bruto.observaciones ?? null,
    campos,
    comprobantes: doc.extrae_comprobantes
      ? (bruto.comprobantes ?? []).map(c => ({
          ...c,
          fecha: c.fecha ? normalizarFecha(c.fecha) : null,
          confianza: Math.max(0, Math.min(1, Number(c.confianza) || 0)),
        }))
      : undefined,
  }
}

export function confianzaPromedio(ext: ExtraccionDocumento): number {
  const valores = Object.values(ext.campos).filter(c => c.valor !== null).map(c => c.confianza)
  if (valores.length === 0) return 0
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100
}

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type TipoImagen = (typeof TIPOS_IMAGEN)[number]

export async function extraerDocumento(
  doc: DocumentoCatalogo,
  archivo: { base64: string; mime: string },
): Promise<{ extraccion: ExtraccionDocumento; modelo: string }> {
  let bloque: Anthropic.Beta.BetaContentBlockParam
  if (archivo.mime === 'application/pdf') {
    bloque = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: archivo.base64 } }
  } else if ((TIPOS_IMAGEN as readonly string[]).includes(archivo.mime)) {
    bloque = { type: 'image', source: { type: 'base64', media_type: archivo.mime as TipoImagen, data: archivo.base64 } }
  } else {
    throw new ErrorIA(`Formato no soportado para extracción: ${archivo.mime}`)
  }
  const { json, modelo } = await solicitarJson(
    PROMPT_EXTRACCION,
    [bloque, { type: 'text', text: `Documento esperado: ${doc.nombre}. Extrae los campos del esquema.` }],
    esquemaExtraccion(doc),
  )
  return { extraccion: normalizarExtraccion(doc, json as ExtraccionDocumento), modelo }
}

export interface AnalisisIA {
  resumen_ejecutivo: string
  observaciones: { tipo: string; mensaje: string }[]
  recomendaciones: string[]
  antecedentes_sugeridos: string[]
}

export async function analizarCasoIA(contexto: Record<string, unknown>): Promise<{ analisis: AnalisisIA; modelo: string }> {
  const { json, modelo } = await solicitarJson(
    PROMPT_ANALISIS,
    [{ type: 'text', text: `Datos del caso (JSON):\n${JSON.stringify(contexto, null, 2)}` }],
    esquemaAnalisis,
  )
  return { analisis: json as AnalisisIA, modelo }
}
