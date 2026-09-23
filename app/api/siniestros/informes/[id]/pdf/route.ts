import { generarPdfInforme, type ContenidoInforme } from '@/lib/siniestros/pdf/informe'
import { clienteServicio, ErrorHttp, requerirSesion, respuestaError } from '@/lib/siniestros/servidor'

export const runtime = 'nodejs'

/** PDF emitido (URL firmada) o previsualización del borrador generada al vuelo. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requerirSesion(['liquidador', 'supervisor'])
    // La lectura con el cliente del usuario aplica RLS: sólo quien ve el caso.
    const { data: informe } = await supabase.from('informes').select('id, tipo, pdf_path, json_contenido').eq('id', params.id).maybeSingle()
    if (!informe) throw new ErrorHttp(404, 'Informe no encontrado')

    if (informe.pdf_path) {
      const { data, error } = await clienteServicio().storage.from('siniestros-documentos').createSignedUrl(informe.pdf_path, 60)
      if (error || !data) throw new ErrorHttp(500, 'No se pudo firmar la URL del PDF')
      return Response.redirect(data.signedUrl, 302)
    }
    const pdf = await generarPdfInforme(informe.json_contenido as ContenidoInforme)
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="borrador-${informe.tipo}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return respuestaError(e)
  }
}
