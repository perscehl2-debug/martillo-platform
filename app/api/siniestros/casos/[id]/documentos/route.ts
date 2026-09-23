import { ErrorHttp, requerirSesion, respuestaError, sha256Hex } from '@/lib/siniestros/servidor'

export const runtime = 'nodejs'

const MIME_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 25 * 1024 * 1024

/**
 * Carga de un antecedente: se guarda en el bucket privado bajo <caso_id>/,
 * con hash SHA-256, y el requisito del checklist pasa a "recibido".
 * Storage y tablas se escriben con el cliente del usuario (RLS aplica).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase, usuario } = await requerirSesion()
    const form = await req.formData()
    const archivo = form.get('archivo')
    const documentoId = String(form.get('documento_id') ?? '')
    if (!(archivo instanceof File)) throw new ErrorHttp(400, 'Falta el archivo')
    if (!documentoId) throw new ErrorHttp(400, 'Falta el tipo de documento')
    if (!MIME_PERMITIDOS.includes(archivo.type)) throw new ErrorHttp(415, `Formato no permitido: ${archivo.type || 'desconocido'}`)
    if (archivo.size > MAX_BYTES) throw new ErrorHttp(413, 'El archivo supera 25 MB')

    const { data: requisito } = await supabase
      .from('requisitos_caso')
      .select('id, estado')
      .eq('caso_id', params.id)
      .eq('documento_id', documentoId)
      .maybeSingle()

    const bytes = new Uint8Array(await archivo.arrayBuffer())
    const hash = await sha256Hex(bytes)
    const nombreSeguro = archivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80)
    const ruta = `${params.id}/${documentoId}/${hash.slice(0, 16)}-${nombreSeguro}`

    const { data: duplicado } = await supabase
      .from('documentos')
      .select('id')
      .eq('caso_id', params.id)
      .eq('hash_sha256', hash)
      .maybeSingle()
    if (duplicado) throw new ErrorHttp(409, 'Este archivo ya fue cargado en el caso')

    const subida = await supabase.storage.from('siniestros-documentos').upload(ruta, bytes, {
      contentType: archivo.type,
      upsert: false,
    })
    if (subida.error) throw new ErrorHttp(403, `No se pudo guardar el archivo: ${subida.error.message}`)

    const { data: doc, error } = await supabase
      .from('documentos')
      .insert({
        caso_id: params.id,
        requisito_id: requisito?.id ?? null,
        tipo: documentoId,
        nombre_archivo: archivo.name,
        storage_path: ruta,
        hash_sha256: hash,
        mime: archivo.type,
        tamano_bytes: archivo.size,
        subido_por: usuario.id,
      })
      .select('id')
      .single()
    if (error) throw new ErrorHttp(403, error.message)

    if (requisito && (requisito.estado === 'pendiente' || requisito.estado === 'rechazado')) {
      await supabase.from('requisitos_caso').update({ estado: 'recibido', motivo_rechazo: null, updated_at: new Date().toISOString() }).eq('id', requisito.id)
    }
    return Response.json({ id: doc.id, hash_sha256: hash }, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
