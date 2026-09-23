// Tipos del módulo de finiquitización de siniestros (piloto SOAP).
// Las reglas de negocio de cada producto viven en lib/siniestros/reglas/*.json.

export type RolSiniestros = 'liquidador' | 'supervisor' | 'administrativo'

export type Computo = 'corridos' | 'habiles'

export interface RegimenCobertura {
  id: string
  nombre?: string
  vigente_desde?: string
  vigente_hasta?: string
  topes_uf: Record<string, number>
  pago_dias_muerte?: number
  pago_muerte_computo?: Computo
}

export type TipoCampo = 'texto' | 'fecha' | 'numero' | 'rut' | 'patente'

export interface CampoDocumento {
  id: string
  tipo: TipoCampo
  descripcion?: string
}

export interface DocumentoCatalogo {
  nombre: string
  extrae_comprobantes?: boolean
  campos: CampoDocumento[]
}

export interface DocumentoCobertura {
  id: string
  nombre?: string
  obligatorio: boolean
}

export type TipoCalculo = 'monto_fijo' | 'proporcional_grado' | 'suma_comprobantes' | 'monto_declarado'

export interface ReglasCalculo {
  tipo: TipoCalculo
  deducir_gastos_medicos?: boolean
  cap_con_gastos_medicos?: boolean
  cap_con_gastos_medicos_ref?: string
  base_proporcion_ref?: string
  tope_uf_ref?: string
  campo_monto?: { documento: string; campo: string; moneda?: 'CLP' | 'UF' }
}

export interface Cobertura {
  id: string
  nombre: string
  tope_uf_ref: string
  documentos: DocumentoCobertura[]
  reglas_calculo: ReglasCalculo
}

export interface ReglasProducto {
  producto: string
  nombre: string
  ley?: string
  version_reglas: string
  variantes?: { id: string; nombre: string; poliza_cmf?: string }[]
  regimenes_cobertura: RegimenCobertura[]
  plazos: Record<string, number>
  computo_plazos?: Record<string, Computo>
  catalogo_documentos: Record<string, DocumentoCatalogo>
  coberturas: Cobertura[]
  incapacidad?: { umbral_ipp?: number; umbral_ipt?: number }
  banderas?: Record<string, number>
  exclusiones?: string[]
  validaciones_cruzadas?: string[]
}

export type EstadoRequisito = 'pendiente' | 'recibido' | 'validado' | 'rechazado'

export interface RequisitoChecklist {
  documento_id: string
  nombre: string
  coberturas: string[]
  obligatorio: boolean
  estado: EstadoRequisito
}

export type RolPersona = 'victima' | 'beneficiario' | 'conductor' | 'propietario' | 'tomador'

export type Parentesco =
  | 'conyuge'
  | 'hijo'
  | 'padre'
  | 'madre'
  | 'madre_hijos_no_matrimoniales'
  | 'conviviente_civil'
  | 'heredero'
  | 'otro'

export interface Persona {
  id?: string
  rol: RolPersona
  nombre: string
  rut?: string | null
  parentesco?: Parentesco | null
  fecha_nacimiento?: string | null
  acredita_posesion_efectiva?: boolean
}

/** Valor extraído por IA desde un documento. */
export interface CampoExtraido {
  valor: string | null
  confianza: number
  pagina: number | null
  evidencia: string | null
}

export interface Comprobante {
  emisor: string | null
  rut_emisor: string | null
  numero: string | null
  fecha: string | null
  monto_clp: number | null
  a_nombre_de: string | null
  confianza: number
}

export interface ExtraccionDocumento {
  tipo_documento_detectado: string | null
  legible: boolean
  posible_alteracion: boolean
  observaciones: string | null
  campos: Record<string, CampoExtraido>
  comprobantes?: Comprobante[]
}

export type Severidad = 'error' | 'advertencia' | 'info'

export interface Hallazgo {
  codigo: string
  severidad: Severidad
  mensaje: string
  detalle?: Record<string, unknown>
}
