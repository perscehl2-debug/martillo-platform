import { z } from 'zod'
import { generarChecklist } from '@/lib/siniestros/checklist'
import { normalizarPatente } from '@/lib/siniestros/patente'
import { resolverRegimen } from '@/lib/siniestros/reglas'
import { validarRut } from '@/lib/siniestros/rut'
import { ErrorHttp, reglasVigentes, requerirSesion, respuestaError, sincronizarPlazos, type CasoDb } from '@/lib/siniestros/servidor'

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const rut = z.string().refine(validarRut, 'RUT inválido')

const persona = z.object({
  rol: z.enum(['victima', 'beneficiario', 'conductor', 'propietario', 'tomador']),
  nombre: z.string().min(3),
  rut: rut.nullish(),
  parentesco: z.enum(['conyuge', 'hijo', 'padre', 'madre', 'madre_hijos_no_matrimoniales', 'conviviente_civil', 'heredero', 'otro']).nullish(),
  fecha_nacimiento: fecha.nullish(),
  acredita_posesion_efectiva: z.boolean().optional(),
  email: z.string().email().nullish(),
  telefono: z.string().nullish(),
})

const esquema = z.object({
  producto_id: z.string().default('SOAP'),
  variante: z.string().nullish(),
  coberturas: z.array(z.string()).min(1),
  fecha_accidente: fecha,
  fecha_fallecimiento: fecha.nullish(),
  fecha_denuncio: fecha,
  fecha_aviso: fecha.nullish(),
  lugar_accidente: z.string().nullish(),
  relato: z.string().nullish(),
  patente: z.string().nullish(),
  poliza_numero: z.string().nullish(),
  poliza_fecha_contratacion: fecha,
  poliza_vigencia_desde: fecha.nullish(),
  poliza_vigencia_hasta: fecha.nullish(),
  tipo_liquidacion: z.enum(['directa', 'registrada']).default('registrada'),
  liquidador_id: z.string().uuid().nullish(),
  personas: z.array(persona).min(1),
})

export async function POST(req: Request) {
  try {
    const { supabase, usuario } = await requerirSesion()
    const body = esquema.parse(await req.json())
    const reglas = await reglasVigentes(supabase, body.producto_id)
    for (const c of body.coberturas) {
      if (!reglas.coberturas.some(x => x.id === c)) throw new ErrorHttp(400, `Cobertura desconocida: ${c}`)
    }
    if (!body.personas.some(p => p.rol === 'victima')) throw new ErrorHttp(400, 'Debe registrar a la víctima')
    if (body.coberturas.includes('muerte') && !body.fecha_fallecimiento) {
      throw new ErrorHttp(400, 'La cobertura de muerte requiere la fecha de fallecimiento')
    }
    if (body.fecha_denuncio < body.fecha_accidente) throw new ErrorHttp(400, 'El denuncio no puede ser anterior al accidente')

    // La fecha de CONTRATACIÓN de la póliza determina el régimen (Ley 21.797).
    const regimen = resolverRegimen(reglas, body.poliza_fecha_contratacion)
    const liquidador_id = usuario.rol === 'liquidador' ? usuario.id : body.liquidador_id ?? null

    const { personas, ...datos } = body
    const { data: caso, error } = await supabase
      .from('casos_siniestro')
      .insert({
        ...datos,
        patente: normalizarPatente(datos.patente),
        reglas_version: reglas.version_reglas,
        regimen_cobertura: regimen.id,
        liquidador_id,
        creado_por: usuario.id,
      })
      .select('*')
      .single<CasoDb>()
    if (error) throw error

    const checklist = generarChecklist(reglas, body.coberturas)
    const [p, r, c] = await Promise.all([
      supabase.from('personas').insert(personas.map(x => ({ ...x, caso_id: caso.id }))),
      supabase.from('requisitos_caso').insert(checklist.map(x => ({ ...x, caso_id: caso.id }))),
      supabase.from('coberturas_caso').insert(body.coberturas.map(cobertura => ({ caso_id: caso.id, cobertura }))),
    ])
    for (const res of [p, r, c]) if (res.error) throw res.error
    await sincronizarPlazos(supabase, caso, reglas)

    return Response.json({ id: caso.id, numero: caso.numero, regimen: regimen.id }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Datos inválidos', detalle: e.issues }, { status: 400 })
    return respuestaError(e)
  }
}
