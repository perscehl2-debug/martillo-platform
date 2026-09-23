import { z } from 'zod'
import { validarRut } from '@/lib/siniestros/rut'
import { ErrorHttp, requerirSesion, respuestaError } from '@/lib/siniestros/servidor'

const esquema = z.object({
  rol: z.enum(['victima', 'beneficiario', 'conductor', 'propietario', 'tomador']),
  nombre: z.string().min(3),
  rut: z.string().refine(validarRut, 'RUT inválido').nullish(),
  parentesco: z.enum(['conyuge', 'hijo', 'padre', 'madre', 'madre_hijos_no_matrimoniales', 'conviviente_civil', 'heredero', 'otro']).nullish(),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  acredita_posesion_efectiva: z.boolean().optional(),
})

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { supabase } = await requerirSesion()
    const persona = esquema.parse(await req.json())
    const { error } = await supabase.from('personas').insert({ ...persona, caso_id: params.id })
    if (error) throw new ErrorHttp(403, error.message)
    return Response.json({ ok: true }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Datos inválidos', detalle: e.issues }, { status: 400 })
    return respuestaError(e)
  }
}
