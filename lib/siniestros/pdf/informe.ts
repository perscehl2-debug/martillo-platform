// Generación de preinforme, informe de liquidación y finiquito en PDF.
// El contenido es una instantánea (json_contenido) con toda la trazabilidad:
// quién redactó y aprobó, cuándo, con qué reglas y con qué valor UF.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ResultadoCalculo } from '../calculo'
import { formatearFecha } from '../fechas'
import { formatearRut } from '../rut'

export type TipoInforme = 'preinforme' | 'informe_liquidacion' | 'finiquito'

export interface ContenidoInforme {
  tipo: TipoInforme
  caso: {
    numero: string
    producto: string
    producto_nombre: string
    variante: string | null
    regimen: string
    regimen_nombre: string | null
    version_reglas: string
    poliza_numero: string | null
    poliza_fecha_contratacion: string
    patente: string | null
    fecha_accidente: string
    fecha_denuncio: string
    lugar_accidente: string | null
    relato: string | null
    tipo_liquidacion: string
  }
  personas: { rol: string; nombre: string; rut: string | null; parentesco: string | null }[]
  beneficiarios: { nombre: string; rut: string | null; cuota: number; monto_clp: number }[]
  coberturas: (ResultadoCalculo & { nombre: string; monto_uf_aprobado: number })[]
  total_uf: number
  total_clp: number
  valor_uf: { fecha: string; valor: number }
  validaciones: { codigo: string; ok: boolean | null; mensaje: string }[]
  observaciones: string[]
  resumen: string | null
  conclusion: string | null
  redactado_por: { id: string; nombre: string }
  aprobado_por?: { id: string; nombre: string; fecha: string } | null
  generado_at: string
}

const TITULOS: Record<TipoInforme, string> = {
  preinforme: 'PREINFORME DE LIQUIDACIÓN',
  informe_liquidacion: 'INFORME DE LIQUIDACIÓN',
  finiquito: 'FINIQUITO Y ORDEN DE PAGO',
}

const REEMPLAZOS: Record<string, string> = { '→': '->', '≥': '>=', '≤': '<=', '≠': '!=', '·': '-', '“': '"', '”': '"', '‘': "'", '’': "'" }

const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`
const uf = (n: number) => `${n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`

class Escritor {
  private page!: PDFPage
  private y = 0
  private readonly margen = 50
  private readonly ancho = 595.28 - 100
  private charset: Set<number>

  constructor(private doc: PDFDocument, private fuente: PDFFont, private negrita: PDFFont, private pie: string) {
    this.charset = new Set(fuente.getCharacterSet())
    this.nuevaPagina()
  }

  private limpiar(texto: string): string {
    return Array.from(texto.replace(/[→≥≤≠·“”‘’]/g, c => REEMPLAZOS[c] ?? c))
      .map(c => (c === '\n' || this.charset.has(c.codePointAt(0)!) ? c : '?'))
      .join('')
  }

  private nuevaPagina() {
    this.page = this.doc.addPage([595.28, 841.89])
    this.y = 841.89 - this.margen
    this.page.drawText(this.limpiar(this.pie), { x: this.margen, y: 25, size: 7, font: this.fuente, color: rgb(0.45, 0.45, 0.45) })
  }

  private espacio(alto: number) {
    if (this.y - alto < 50) this.nuevaPagina()
  }

  private lineas(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
    const out: string[] = []
    for (const parrafo of this.limpiar(texto).split('\n')) {
      let linea = ''
      for (const palabra of parrafo.split(/\s+/)) {
        const prueba = linea ? `${linea} ${palabra}` : palabra
        if (fuente.widthOfTextAtSize(prueba, tam) > ancho && linea) {
          out.push(linea)
          linea = palabra
        } else {
          linea = prueba
        }
      }
      out.push(linea)
    }
    return out
  }

  texto(texto: string, opts: { tam?: number; negrita?: boolean; sangria?: number; color?: [number, number, number] } = {}) {
    const tam = opts.tam ?? 9.5
    const fuente = opts.negrita ? this.negrita : this.fuente
    const x = this.margen + (opts.sangria ?? 0)
    for (const l of this.lineas(texto, fuente, tam, this.ancho - (opts.sangria ?? 0))) {
      this.espacio(tam + 4)
      this.page.drawText(l, { x, y: this.y - tam, size: tam, font: fuente, color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])) })
      this.y -= tam + 4
    }
  }

  titulo(texto: string) {
    this.saltar(6)
    this.espacio(30)
    this.texto(texto, { tam: 11, negrita: true, color: [0.05, 0.2, 0.4] })
    this.page.drawLine({ start: { x: this.margen, y: this.y }, end: { x: this.margen + this.ancho, y: this.y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })
    this.saltar(4)
  }

  par(clave: string, valor: string) {
    const tam = 9.5
    const lineas = this.lineas(valor || '—', this.fuente, tam, this.ancho - 170)
    this.espacio((tam + 4) * lineas.length)
    this.page.drawText(this.limpiar(clave), { x: this.margen, y: this.y - tam, size: tam, font: this.negrita })
    for (const l of lineas) {
      this.page.drawText(l, { x: this.margen + 170, y: this.y - tam, size: tam, font: this.fuente })
      this.y -= tam + 4
    }
  }

  saltar(n: number) {
    this.y -= n
  }

  firma(etiqueta: string, nombre: string) {
    this.espacio(70)
    this.saltar(40)
    this.page.drawLine({ start: { x: this.margen, y: this.y }, end: { x: this.margen + 200, y: this.y }, thickness: 0.5 })
    this.saltar(4)
    this.texto(`${etiqueta}: ${nombre}`, { tam: 9 })
  }
}

export async function generarPdfInforme(c: ContenidoInforme): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`${TITULOS[c.tipo]} ${c.caso.numero}`)
  doc.setAuthor(c.redactado_por.nombre)
  doc.setSubject(`Siniestro ${c.caso.numero} — ${c.caso.producto_nombre}`)
  doc.setCreationDate(new Date(c.generado_at))
  const fuente = await doc.embedFont(StandardFonts.Helvetica)
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold)
  const pie = `Caso ${c.caso.numero} · Reglas ${c.caso.producto} v${c.caso.version_reglas} · Régimen ${c.caso.regimen} · UF ${formatearFecha(c.valor_uf.fecha)} = ${clp(c.valor_uf.valor)} · Generado ${c.generado_at}`
  const w = new Escritor(doc, fuente, negrita, pie)

  w.texto(TITULOS[c.tipo], { tam: 16, negrita: true, color: [0.05, 0.2, 0.4] })
  w.texto(`${c.caso.producto_nombre}${c.caso.variante ? ` (${c.caso.variante})` : ''} — Ley 18.490`, { tam: 10 })
  w.texto(`Caso N° ${c.caso.numero}`, { tam: 10, negrita: true })
  if (c.tipo !== 'finiquito' && !c.aprobado_por) {
    w.texto('BORRADOR — PROPUESTA SUJETA A REVISIÓN Y APROBACIÓN', { tam: 9, negrita: true, color: [0.7, 0.1, 0.1] })
  }

  w.titulo('1. Antecedentes del siniestro')
  w.par('Fecha del accidente', formatearFecha(c.caso.fecha_accidente))
  w.par('Fecha del denuncio', formatearFecha(c.caso.fecha_denuncio))
  w.par('Lugar', c.caso.lugar_accidente ?? '—')
  w.par('Patente', c.caso.patente ?? '—')
  w.par('Póliza', `${c.caso.poliza_numero ?? '—'} (contratada el ${formatearFecha(c.caso.poliza_fecha_contratacion)})`)
  w.par('Régimen de cobertura', c.caso.regimen_nombre ?? c.caso.regimen)
  w.par('Tipo de liquidación', c.caso.tipo_liquidacion === 'directa' ? 'Directa por la aseguradora' : 'Liquidador registrado')
  if (c.caso.relato) w.par('Relato', c.caso.relato)

  w.titulo('2. Personas')
  for (const p of c.personas) {
    w.par(p.rol.charAt(0).toUpperCase() + p.rol.slice(1), `${p.nombre}${p.rut ? ` — RUT ${formatearRut(p.rut)}` : ''}${p.parentesco ? ` (${p.parentesco.replace(/_/g, ' ')})` : ''}`)
  }

  if (c.tipo !== 'finiquito') {
    w.titulo('3. Validaciones y observaciones')
    for (const v of c.validaciones) {
      w.texto(`${v.ok === true ? '[OK]' : v.ok === false ? '[X]' : '[--]'} ${v.mensaje}`, { sangria: 6 })
    }
    for (const o of c.observaciones) w.texto(`• ${o}`, { sangria: 6 })
    if (c.resumen) {
      w.saltar(4)
      w.texto('Resumen:', { negrita: true })
      w.texto(c.resumen)
    }
  }

  w.titulo(c.tipo === 'finiquito' ? '3. Indemnización' : '4. Análisis de cobertura e indemnización (art. 26)')
  for (const cob of c.coberturas) {
    w.texto(`${cob.nombre}: ${cob.procede ? uf(cob.monto_uf_aprobado) : 'No procede'}`, { negrita: true })
    if (c.tipo !== 'finiquito') {
      for (const paso of cob.pasos) w.texto(`- ${paso}`, { sangria: 10, tam: 8.5 })
      for (const a of cob.advertencias) w.texto(`! ${a}`, { sangria: 10, tam: 8.5, color: [0.6, 0.3, 0] })
    }
  }
  w.saltar(4)
  w.par('Total indemnización', `${uf(c.total_uf)} = ${clp(c.total_clp)}`)
  w.par('Valor UF utilizado', `${clp(c.valor_uf.valor)} al ${formatearFecha(c.valor_uf.fecha)} (Banco Central / mindicador.cl)`)

  if (c.beneficiarios.length > 0) {
    w.titulo(c.tipo === 'finiquito' ? '4. Beneficiarios y pago' : '5. Beneficiarios (art. 31)')
    for (const b of c.beneficiarios) {
      w.par(b.nombre, `${b.rut ? `RUT ${formatearRut(b.rut)} · ` : ''}${(b.cuota * 100).toFixed(2)}% · ${clp(b.monto_clp)}`)
    }
  }

  if (c.conclusion) {
    w.titulo('Conclusión del liquidador')
    w.texto(c.conclusion)
  }

  if (c.tipo === 'finiquito') {
    w.titulo('Declaración')
    w.texto(
      `Por el presente instrumento, el/los beneficiario(s) individualizado(s) declara(n) recibir la suma total de ${clp(c.total_clp)} ` +
      `(${uf(c.total_uf)}, calculada con UF de ${clp(c.valor_uf.valor)} al ${formatearFecha(c.valor_uf.fecha)}), por concepto de ` +
      `indemnización del Seguro Obligatorio de Accidentes Personales por el siniestro N° ${c.caso.numero} ocurrido el ` +
      `${formatearFecha(c.caso.fecha_accidente)}, y otorga(n) finiquito respecto de las coberturas pagadas. ` +
      '[Texto referencial: validar redacción con el área legal de la compañía antes de su uso.]',
    )
    for (const b of c.beneficiarios) w.firma('Beneficiario', `${b.nombre}${b.rut ? ` — ${formatearRut(b.rut)}` : ''}`)
  }

  w.titulo('Trazabilidad')
  w.par('Redactado por', c.redactado_por.nombre)
  w.par('Aprobado por', c.aprobado_por ? `${c.aprobado_por.nombre} el ${c.aprobado_por.fecha}` : 'Pendiente de aprobación')
  w.par('Reglas aplicadas', `${c.caso.producto} versión ${c.caso.version_reglas}`)
  w.texto('El análisis asistido por IA es una propuesta; la determinación de cobertura, liquidación y pago corresponde al liquidador y supervisor firmantes.', { tam: 8, color: [0.4, 0.4, 0.4] })

  return doc.save()
}
