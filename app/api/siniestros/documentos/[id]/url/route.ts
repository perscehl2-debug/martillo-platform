import { ErrorHttp, requerirSesion, respuestaError } from '@/lib/siniestros/servidor'

/** URL firmada de corta duración (RLS de storage decide si el usuario puede verlo). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requerirSesion()
    const { data: doc } = await supabase.from('documentos').select('storage_path').eq('id', params.id).maybeSingle()
    if (!doc) throw new ErrorHttp(404, 'Documento no encontrado')
    const { data, error } = await supabase.storage.from('siniestros-documentos').createSignedUrl(doc.storage_path, 60)
    if (error || !data) throw new ErrorHttp(403, 'Sin acceso al archivo')
    return Response.json({ url: data.signedUrl, expira_en: 60 })
  } catch (e) {
    return respuestaError(e)
  }
}
