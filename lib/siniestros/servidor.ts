// Utilidades de servidor del módulo (sólo route handlers / server components).
import 'server-only'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hoyIso } from './fechas'
import { calcularPlazos, estadoPlazo } from './plazos'
import { reglasBase, resolverRegimen, validarReglas } from './reglas'
import type { ReglasProducto, RolSiniestros } from './tipos'

export interface UsuarioSiniestros {
  id: string
  nombre: string
  email: string | null
  rol: RolSiniestros
}

/**
 * Cliente con service_role SIN cookies de usuario (si se le pasan cookies,
 * supabase-js enviaría el JWT del usuario y RLS aplicaría igual). Úsese sólo
 * después de autorizar al usuario con el cliente normal.
 */
export function clienteServicio(): SupabaseClient {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function sesionSiniestros(): Promise<{ supabase: SupabaseClient; usuario: UsuarioSiniestros } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, activo')
    .eq('id', user.id)
    .maybeSingle()
  if (!data || !data.activo) return null
  return { supabase, usuario: { id: data.id, nombre: data.nombre, email: data.email, rol: data.rol } }
}

export class ErrorHttp extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function requerirSesion(roles?: RolSiniestros[]) {
  const sesion = await sesionSiniestros()
  if (!sesion) throw new ErrorHttp(401, 'No autenticado o sin acceso al módulo de siniestros')
  if (roles && !roles.includes(sesion.usuario.rol)) throw new ErrorHttp(403, 'Rol sin permiso para esta acción')
  return sesion
}

export function respuestaError(e: unknown): Response {
  if (e instanceof ErrorHttp) return Response.json({ error: e.message }, { status: e.status })
  const mensaje = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Error inesperado'
  console.error('[siniestros]', e)
  return Response.json({ error: mensaje }, { status: 500 })
}

/** Última versión publicada y vigente de las reglas (o las incluidas en el código). */
export async function reglasVigentes(db: SupabaseClient, producto: string): Promise<ReglasProducto> {
  const { data } = await db
    .from('reglas_producto')
    .select('json_reglas')
    .eq('producto_id', producto)
    .lte('vigente_desde', hoyIso())
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoyIso()}`)
    .order('vigente_desde', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data && validarReglas(data.json_reglas).valido) return data.json_reglas as ReglasProducto
  return reglasBase(producto)
}

/** Reglas con que se abrió el caso (versión congelada en casos_siniestro.reglas_version). */
export async function reglasDelCaso(db: SupabaseClient, caso: { producto_id: string; reglas_version: string }): Promise<ReglasProducto> {
  const { data } = await db
    .from('reglas_producto')
    .select('json_reglas')
    .eq('producto_id', caso.producto_id)
    .eq('version', caso.reglas_version)
    .maybeSingle()
  if (data) return data.json_reglas as ReglasProducto
  const base = reglasBase(caso.producto_id)
  if (base.version_reglas !== caso.reglas_version) {
    throw new ErrorHttp(500, `No se encontró la versión ${caso.reglas_version} de reglas ${caso.producto_id}`)
  }
  return base
}

export interface CasoDb {
  id: string
  numero: string
  producto_id: string
  variante: string | null
  reglas_version: string
  regimen_cobertura: string
  coberturas: string[]
  estado: string
  fecha_accidente: string
  fecha_fallecimiento: string | null
  fecha_denuncio: string
  fecha_aviso: string | null
  lugar_accidente: string | null
  relato: string | null
  patente: string | null
  poliza_numero: string | null
  poliza_fecha_contratacion: string
  poliza_vigencia_desde: string | null
  poliza_vigencia_hasta: string | null
  tipo_liquidacion: 'directa' | 'registrada'
  fecha_comunicacion_tipo_liquidacion: string | null
  prorroga_liquidacion: boolean
  prorroga_fundamento: string | null
  fecha_antecedentes_completos: string | null
  fecha_certificado_incapacidad: string | null
  fecha_informe_liquidacion: string | null
  fecha_impugnacion: string | null
  fecha_pago: string | null
  exclusion_confirmada: string | null
  liquidador_id: string | null
  supervisor_id: string | null
  created_at: string
}

/** Recalcula y persiste los plazos legales del caso. */
export async function sincronizarPlazos(db: SupabaseClient, caso: CasoDb, reglas: ReglasProducto) {
  const regimen = resolverRegimen(reglas, caso.poliza_fecha_contratacion)
  const plazos = calcularPlazos(reglas, regimen, caso)
  const hoy = hoyIso()
  const filas = plazos.map(p => {
    const { estado } = estadoPlazo(p, hoy)
    return {
      caso_id: caso.id,
      tipo_plazo: p.tipo,
      nombre: p.nombre,
      fundamento: p.fundamento,
      fecha_inicio: p.fecha_inicio,
      fecha_limite: p.fecha_limite,
      computo: p.computo,
      cumplido_el: p.cumplido_el,
      estado: estado === 'cumplido' || estado === 'cumplido_fuera_plazo' ? estado : 'abierto',
      prorroga: p.prorroga,
    }
  })
  const { error } = await db.from('plazos_caso').upsert(filas, { onConflict: 'caso_id,tipo_plazo' })
  if (error) throw error
  const vigentes = plazos.map(p => p.tipo)
  if (vigentes.length > 0) {
    await db.from('plazos_caso').delete().eq('caso_id', caso.id).not('tipo_plazo', 'in', `(${vigentes.join(',')})`)
  }
  return plazos
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data as BufferSource)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
