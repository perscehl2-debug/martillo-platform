import { ErrorIA, confianzaPromedio, extraerDocumento, MODELO_IA } from '@/lib/siniestros/ia/claude'
import { clienteServicio, ErrorHttp, reglasDelCaso, requerirSesion, respuestaError } from '@/lib/siniestros/servidor'

export const runtime = 'nodejs'
export const maxDuration = 300

/** Confianza mínima para marcar el requisito como validado sin revisión adicional. */
const UMBRAL_VALIDACION = 0.8

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    // Sólo quien puede ver datos sensibles del caso (RLS) dispara la extracción.
    const { supabase } = await requerirSesion(['liquidador', 'supervisor'])
    const { data: doc } = await supabase
      .from('documentos')
      .select('id, caso_id, requisito_id, tipo, storage_path, mime, casos_siniestro(producto_id, reglas_version)')
      .eq('id', params.id)
      .maybeSingle()
    if (!doc) throw new ErrorHttp(404, 'Documento no encontrado')
    const caso = doc.casos_siniestro as unknown as { producto_id: string; reglas_version: string }
    const reglas = await reglasDelCaso(supabase, caso)
    const catalogo = reglas.catalogo_documentos[doc.tipo]
    if (!catalogo) throw new ErrorHttp(400, `El tipo ${doc.tipo} no tiene esquema de extracción`)
    if (!process.env.ANTHROPIC_API_KEY) throw new ErrorHttp(503, 'ANTHROPIC_API_KEY no configurada')

    const { data: archivo, error: errDescarga } = await supabase.storage.from('siniestros-documentos').download(doc.storage_path)
    if (errDescarga || !archivo) throw new ErrorHttp(403, 'No se pudo leer el archivo')
    const base64 = Buffer.from(await archivo.arrayBuffer()).toString('base64')

    // Las extracciones sólo las escribe el backend (sin política INSERT para usuarios).
    const admin = clienteServicio()
    try {
      const { extraccion, modelo } = await extraerDocumento(catalogo, { base64, mime: doc.mime })
      const confianza = confianzaPromedio(extraccion)
      await admin.from('extracciones').insert({ documento_id: doc.id, json_datos: extraccion, confianza, modelo })
      if (doc.requisito_id) {
        const valido = extraccion.legible && !extraccion.posible_alteracion && confianza >= UMBRAL_VALIDACION
        await supabase
          .from('requisitos_caso')
          .update({ estado: valido ? 'validado' : 'recibido', updated_at: new Date().toISOString() })
          .eq('id', doc.requisito_id)
      }
      return Response.json({ extraccion, confianza, modelo })
    } catch (e) {
      if (e instanceof ErrorIA) {
        await admin.from('extracciones').insert({ documento_id: doc.id, estado: 'error', error: e.message, modelo: MODELO_IA })
        throw new ErrorHttp(422, e.message)
      }
      throw e
    }
  } catch (e) {
    return respuestaError(e)
  }
}
