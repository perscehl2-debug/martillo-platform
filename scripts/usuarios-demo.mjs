// Crea (o actualiza) usuarios de prueba del módulo de siniestros durante el
// build de Vercel cuando existe SINIESTROS_DEMO_PASSWORD. Usa la service_role
// key del entorno; no imprime contraseñas. Sin la variable, no hace nada.
import { createClient } from '@supabase/supabase-js'

// SINIESTROS_DEMO_USUARIOS (JSON [{email,nombre,rol,password}]) reemplaza la lista por defecto.
const lista = process.env.SINIESTROS_DEMO_USUARIOS ? JSON.parse(process.env.SINIESTROS_DEMO_USUARIOS) : null
const password = process.env.SINIESTROS_DEMO_PASSWORD ?? (lista ? 'por-usuario' : undefined)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!password || !url || !serviceKey) {
  console.log('[usuarios-demo] Sin SINIESTROS_DEMO_PASSWORD: se omite.')
  process.exit(0)
}

const USUARIOS = lista ?? [
  { email: 'supervisor@martillo-demo.cl', nombre: 'Supervisor Demo', rol: 'supervisor' },
  { email: 'supervisor2@martillo-demo.cl', nombre: 'Supervisora Demo 2', rol: 'supervisor' },
  { email: 'liquidador@martillo-demo.cl', nombre: 'Liquidador Demo', rol: 'liquidador' },
  { email: 'administrativo@martillo-demo.cl', nombre: 'Administrativo Demo', rol: 'administrativo' },
]

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function buscar(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find(x => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 200) return null
  }
  return null
}

try {
  for (const u of USUARIOS) {
    let user = await buscar(u.email)
    if (user) {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: u.password ?? password, email_confirm: true })
      if (error) throw error
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password ?? password, email_confirm: true })
      if (error) throw error
      user = data.user
    }
    const { error } = await admin.from('usuarios').upsert({ id: user.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: true }, { onConflict: 'id' })
    if (error) throw error
    console.log(`[usuarios-demo] Listo: ${u.email} (${u.rol})`)
  }
} catch (e) {
  console.error(`[usuarios-demo] ERROR: ${e.message}`)
}
