import { z } from 'zod'
import { TIPOS_VICTIMA } from '@/lib/siniestros/arbol'
import { generarChecklist } from '@/lib/siniestros/checklist'
import { hoyIso } from '@/lib/siniestros/fechas'
import { coberturaEnFecha, obtenerPoliza } from '@/lib/siniestros/polizas'
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
  // Todo parte de la póliza: el servidor toma de ella producto, variante,
  // patente, vigencia y fecha de contratación (régimen de topes).
  poliza_numero: z.string().min(3),
  coberturas: z.array(z.string()).min(1),
  tipo_victima: z.enum(TIPOS_VICTIMA.map(t => t.id) as [string, ...string[]]).nullish(),
  grado_incapacidad_pct: z.number().min(0).max(100).nullish(),
  fecha_accidente: fecha,
  fecha_fallecimiento: fecha.nullish(),
  fecha_denuncio: fecha,
  fecha_aviso: fecha.nullish(),
  lugar_accidente: z.string().nullish(),
  relato: z.string().nullish(),
  tipo_liquidacion: z.enum(['directa', 'registrada']).default('registrada'),
  liquidador_id: z.string().uuid().nullish(),
  personas: z.array(persona).min(1),
})

export async function POST(req: Request) {
  try {
    const { supabase, usuario } = await requerirSesion()
    const body = esquema.parse(await req.json())
    const poliza = await obtenerPoliza(supabase, body.poliza_numero)
    if (!poliza) throw new ErrorHttp(404, `No existe la póliza ${body.poliza_numero}`)
    if (coberturaEnFecha(poliza, body.fecha_accidente) !== 'cubierto') {
      throw new ErrorHttp(400, `El accidente está fuera de la vigencia de la póliza (${poliza.vigencia_desde} a ${poliza.vigencia_hasta}) o la póliza está anulada`)
    }
    const reglas = await reglasVigentes(supabase, poliza.producto)
    for (const c of body.coberturas) {
      if (!reglas.coberturas.some(x => x.id === c)) throw new ErrorHttp(400, `Cobertura desconocida: ${c}`)
    }
    if (!body.personas.some(p => p.rol === 'victima')) throw new ErrorHttp(400, 'Debe registrar a la víctima')
    if (body.coberturas.includes('muerte') && !body.fecha_fallecimiento) {
      throw new ErrorHttp(400, 'La cobertura de muerte requiere la fecha de fallecimiento')
    }
    if (body.fecha_accidente > hoyIso()) throw new ErrorHttp(400, 'La fecha del accidente no puede ser futura')
    if (body.fecha_denuncio < body.fecha_accidente) throw new ErrorHttp(400, 'El denuncio no puede ser anterior al accidente')

    // La fecha de CONTRATACIÓN de la póliza determina el régimen (Ley 21.797).
    const regimen = resolverRegimen(reglas, poliza.fecha_contratacion)
    const liquidador_id = usuario.rol === 'liquidador' ? usuario.id : body.liquidador_id ?? null
    const tipoVictima = TIPOS_VICTIMA.find(t => t.id === body.tipo_victima)

    const { personas, grado_incapacidad_pct, ...resto } = body
    const datos = { ...resto, tipo_victima: undefined }
    const { data: caso, error } = await supabase
      .from('casos_siniestro')
      .insert({
        ...datos,
        relato: [tipoVictima ? `Víctima: ${tipoVictima.nombre.toLowerCase()}.` : null, datos.relato].filter(Boolean).join(' ') || null,
        producto_id: poliza.producto,
        variante: poliza.variante,
        patente: normalizarPatente(poliza.vehiculo.patente),
        poliza_numero: poliza.numero,
        poliza_fecha_contratacion: poliza.fecha_contratacion,
        poliza_vigencia_desde: poliza.vigencia_desde,
        poliza_vigencia_hasta: poliza.vigencia_hasta,
        reglas_version: reglas.version_reglas,
        regimen_cobertura: regimen.id,
        liquidador_id,
        creado_por: usuario.id,
      })
      .select('*')
      .single<CasoDb>()
    if (error) throw error

    // Tomador y propietario vienen de la póliza.
    const dePoliza = [
      { rol: 'tomador' as const, ...poliza.tomador },
      ...(poliza.propietario && poliza.propietario.rut !== poliza.tomador.rut ? [{ rol: 'propietario' as const, ...poliza.propietario }] : []),
    ].map(p => ({ rol: p.rol, nombre: p.nombre, rut: p.rut ?? null, email: p.email ?? null, telefono: p.telefono ?? null }))
    const grado = grado_incapacidad_pct === null || grado_incapacidad_pct === undefined ? null : grado_incapacidad_pct / 100

    const checklist = generarChecklist(reglas, body.coberturas)
    const [p, r, c] = await Promise.all([
      supabase.from('personas').insert([...personas, ...dePoliza].map(x => ({ ...x, caso_id: caso.id }))),
      supabase.from('requisitos_caso').insert(checklist.map(x => ({ ...x, caso_id: caso.id }))),
      supabase.from('coberturas_caso').insert(body.coberturas.map(cobertura => ({ caso_id: caso.id, cobertura, grado_incapacidad: cobertura === 'ipt' || cobertura === 'ipp' ? grado : null }))),
    ])
    for (const res of [p, r, c]) if (res.error) throw res.error
    await sincronizarPlazos(supabase, caso, reglas)

    return Response.json({ id: caso.id, numero: caso.numero, regimen: regimen.id }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: 'Datos inválidos', detalle: e.issues }, { status: 400 })
    return respuestaError(e)
  }
}
