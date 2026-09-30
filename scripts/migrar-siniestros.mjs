// Aplica las migraciones del módulo (002 y 003) durante el build de Vercel
// cuando existe SUPABASE_DB_PASSWORD (configurada sólo para el preview de la rama).
// Idempotente: si las tablas ya existen no hace nada. Sin la variable, no hace nada.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const password = process.env.SUPABASE_DB_PASSWORD
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
if (!password || !ref) {
  console.log('[migrar-siniestros] Sin SUPABASE_DB_PASSWORD: se omite.')
  process.exit(0)
}

const regiones = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'sa-east-1', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2']
const candidatos = [
  { host: `db.${ref}.supabase.co`, user: 'postgres' },
  ...['aws-0', 'aws-1'].flatMap(p => regiones.map(r => ({ host: `${p}-${r}.pooler.supabase.com`, user: `postgres.${ref}` }))),
]

async function conectar() {
  for (const c of candidatos) {
    const client = new pg.Client({ ...c, port: 5432, database: 'postgres', password, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 })
    try {
      await client.connect()
      console.log(`[migrar-siniestros] Conectado vía ${c.host}`)
      return client
    } catch (e) {
      console.log(`[migrar-siniestros] ${c.host}: ${e.message}`)
      await client.end().catch(() => {})
      if (/password authentication failed/i.test(e.message)) throw new Error('Contraseña de la base incorrecta')
    }
  }
  throw new Error('No se pudo conectar a la base')
}

try {
  const db = await conectar()
  // Migraciones del módulo, en orden; cada una se salta si su tabla ya existe.
  const MIGRACIONES = [
    { archivo: '002_siniestros.sql', tabla: 'public.casos_siniestro' },
    { archivo: '003_polizas.sql', tabla: 'public.polizas' },
  ]
  for (const m of MIGRACIONES) {
    const { rows } = await db.query('SELECT to_regclass($1) IS NOT NULL AS existe', [m.tabla])
    if (rows[0].existe) {
      console.log(`[migrar-siniestros] ${m.archivo}: ya aplicada.`)
      continue
    }
    const sql = readFileSync(new URL(`../supabase/migrations/${m.archivo}`, import.meta.url), 'utf8')
    await db.query('BEGIN')
    try {
      await db.query(sql)
      await db.query('COMMIT')
    } catch (e) {
      await db.query('ROLLBACK')
      throw e
    }
    console.log(`[migrar-siniestros] ${m.archivo}: aplicada.`)
  }
  const email = process.env.SINIESTROS_SUPERVISOR_EMAIL
  if (email) {
    const r = await db.query(
      `INSERT INTO public.usuarios (id, nombre, email, rol)
       SELECT id, split_part(email, '@', 1), email, 'supervisor' FROM auth.users WHERE lower(email) = lower($1)
       ON CONFLICT (id) DO UPDATE SET rol = 'supervisor', activo = TRUE RETURNING email`,
      [email],
    )
    console.log(r.rowCount ? `[migrar-siniestros] Supervisor activado: ${email}` : `[migrar-siniestros] ${email} aún no está registrado en auth.users`)
  }
  const t = await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('usuarios','casos_siniestro','personas','documentos','informes','valores_uf','auditoria','polizas')")
  console.log(`[migrar-siniestros] Tablas del módulo presentes: ${t.rows[0].n}/8`)
  await db.end()
} catch (e) {
  // No bloquea el build de la app; el error queda en el log.
  console.error(`[migrar-siniestros] ERROR: ${e.message}`)
}
