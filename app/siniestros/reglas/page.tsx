import { redirect } from 'next/navigation'
import { EditorReglas } from '@/components/siniestros/EditorReglas'
import { Chip, Tarjeta } from '@/components/siniestros/ui'
import { formatearFecha } from '@/lib/siniestros/fechas'
import { reglasVigentes, sesionSiniestros } from '@/lib/siniestros/servidor'

export const dynamic = 'force-dynamic'

export default async function PanelReglas() {
  const sesion = await sesionSiniestros()
  if (!sesion) redirect('/auth/login?redirect=/siniestros/reglas')
  const { supabase, usuario } = sesion
  const [{ data: productos }, { data: versiones }] = await Promise.all([
    supabase.from('productos_seguro').select('id, nombre, ley, activo').order('id'),
    supabase.from('reglas_producto').select('id, producto_id, version, vigente_desde, vigente_hasta, created_at, usuarios(nombre)').order('created_at', { ascending: false }),
  ])
  const vigentes = await Promise.all((productos ?? []).map(async p => ({ producto: p, reglas: await reglasVigentes(supabase, p.id) })))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white md:text-3xl">Reglas de productos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cada producto se define con un JSON versionado (coberturas, documentos, campos a extraer, cálculos, plazos) validado contra JSON Schema. Un producto nuevo se agrega por configuración, sin cambiar el núcleo.
        </p>
      </div>

      {vigentes.map(({ producto, reglas }) => (
        <Tarjeta key={producto.id} titulo={<>{reglas.nombre} <span className="ml-2 text-xs font-normal text-gray-500">v{reglas.version_reglas}</span></>} acciones={producto.activo ? <Chip color="verde">Activo</Chip> : <Chip>Inactivo</Chip>}>
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="mb-1 text-xs uppercase text-gray-500">Regímenes</p>
              {reglas.regimenes_cobertura.map(r => (
                <p key={r.id} className="text-gray-300">
                  <span className="text-white">{r.id}</span> {r.vigente_desde ? `desde ${formatearFecha(r.vigente_desde)}` : ''}{r.vigente_hasta ? ` hasta ${formatearFecha(r.vigente_hasta)}` : ''}
                  <br /><span className="text-xs text-gray-500">{Object.entries(r.topes_uf).map(([k, v]) => `${k}: ${v} UF`).join(' · ')}</span>
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-gray-500">Coberturas</p>
              {reglas.coberturas.map(c => <p key={c.id} className="text-gray-300">{c.nombre} <span className="text-xs text-gray-500">({c.documentos.length} docs · {c.reglas_calculo.tipo})</span></p>)}
            </div>
            <div>
              <p className="mb-1 text-xs uppercase text-gray-500">Plazos</p>
              {Object.entries(reglas.plazos).map(([k, v]) => <p key={k} className="text-gray-300">{k.replace(/_/g, ' ')}: {v}</p>)}
            </div>
          </div>
        </Tarjeta>
      ))}

      <Tarjeta titulo="Versiones publicadas">
        {(versiones ?? []).length === 0 ? <p className="text-sm text-gray-500">Se usan las reglas incluidas en el código (lib/siniestros/reglas).</p> : (
          <ul className="text-sm text-gray-300">
            {(versiones ?? []).map(v => (
              <li key={v.id}>{v.producto_id} v{v.version} · vigente desde {formatearFecha(v.vigente_desde)} · publicada por {(v.usuarios as unknown as { nombre: string } | null)?.nombre ?? '—'}</li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta titulo="Validar / publicar reglas">
        <EditorReglas puedePublicar={usuario.rol === 'supervisor'} ejemplo={JSON.stringify(vigentes[0]?.reglas ?? {}, null, 2)} />
      </Tarjeta>
    </div>
  )
}
