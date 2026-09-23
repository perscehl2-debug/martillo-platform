// JSON Schemas para salida estructurada de Claude, generados desde el
// catálogo de documentos de las reglas (un documento nuevo en el JSON obtiene
// su esquema de extracción sin cambios de código).
import type { DocumentoCatalogo, TipoCampo } from '../tipos'

const FORMATO: Record<TipoCampo, string> = {
  texto: 'Texto tal como aparece.',
  fecha: 'Fecha en formato ISO YYYY-MM-DD.',
  numero: 'Número sin separadores de miles, punto decimal (ej. 125000 o 45.5).',
  rut: 'RUT con dígito verificador, formato 12345678-9.',
  patente: 'Placa patente sin puntos ni guiones (ej. BBCL12 o AB1234).',
}

type Esquema = Record<string, unknown>

const campoEsquema = (descripcion: string): Esquema => ({
  type: 'object',
  additionalProperties: false,
  required: ['valor', 'confianza', 'pagina', 'evidencia'],
  properties: {
    valor: { type: ['string', 'null'], description: descripcion },
    confianza: { type: 'number', description: 'Confianza entre 0 y 1.' },
    pagina: { type: ['integer', 'null'], description: 'Página (1-indexada) donde aparece el dato.' },
    evidencia: { type: ['string', 'null'], description: 'Texto literal breve del documento que respalda el valor.' },
  },
})

const comprobanteEsquema: Esquema = {
  type: 'object',
  additionalProperties: false,
  required: ['emisor', 'rut_emisor', 'numero', 'fecha', 'monto_clp', 'a_nombre_de', 'confianza'],
  properties: {
    emisor: { type: ['string', 'null'] },
    rut_emisor: { type: ['string', 'null'] },
    numero: { type: ['string', 'null'], description: 'Número de boleta, factura o bono' },
    fecha: { type: ['string', 'null'], description: 'Fecha de emisión YYYY-MM-DD' },
    monto_clp: { type: ['number', 'null'], description: 'Monto total en pesos pagado por el paciente o a cobrar' },
    a_nombre_de: { type: ['string', 'null'], description: 'Nombre del paciente/beneficiario del comprobante' },
    confianza: { type: 'number' },
  },
}

export function esquemaExtraccion(doc: DocumentoCatalogo): Esquema {
  const campos: Record<string, Esquema> = {}
  for (const c of doc.campos) {
    campos[c.id] = campoEsquema(`${c.descripcion ?? c.id}. ${FORMATO[c.tipo]}`)
  }
  const properties: Record<string, Esquema> = {
    tipo_documento_detectado: { type: ['string', 'null'], description: 'Qué tipo de documento es realmente.' },
    legible: { type: 'boolean' },
    posible_alteracion: { type: 'boolean', description: 'true si hay signos visibles de adulteración (enmiendas, tipografías distintas, montos sobrescritos).' },
    observaciones: { type: ['string', 'null'] },
    campos: {
      type: 'object',
      additionalProperties: false,
      required: doc.campos.map(c => c.id),
      properties: campos,
    },
  }
  if (doc.extrae_comprobantes) {
    properties.comprobantes = { type: 'array', items: comprobanteEsquema }
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  }
}

export const esquemaAnalisis: Esquema = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen_ejecutivo', 'observaciones', 'recomendaciones', 'antecedentes_sugeridos'],
  properties: {
    resumen_ejecutivo: { type: 'string', description: 'Resumen del caso en 5-10 líneas, en español de Chile.' },
    observaciones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'mensaje'],
        properties: {
          tipo: { type: 'string', enum: ['inconsistencia', 'bandera_roja', 'cobertura', 'exclusion', 'otro'] },
          mensaje: { type: 'string' },
        },
      },
    },
    recomendaciones: { type: 'array', items: { type: 'string' } },
    antecedentes_sugeridos: { type: 'array', items: { type: 'string' }, description: 'Documentos adicionales que convendría solicitar.' },
  },
}
