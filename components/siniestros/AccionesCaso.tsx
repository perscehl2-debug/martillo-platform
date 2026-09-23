'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Parentesco } from '@/lib/siniestros/tipos'
import { botonCls, botonSecCls, inputCls } from './ui'

async function llamar(url: string, init: RequestInit): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(url, init)
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, json }
}

function useAccion() {
  const router = useRouter()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ejecutar = async (url: string, init: RequestInit, alTerminar?: (json: Record<string, unknown>) => void) => {
    setCargando(true)
    setError(null)
    const { ok, json } = await llamar(url, init)
    setCargando(false)
    if (!ok) {
      setError(String(json.error ?? 'Error'))
      return false
    }
    alTerminar?.(json)
    router.refresh()
    return true
  }
  return { cargando, error, ejecutar }
}

const Err = ({ e }: { e: string | null }) => (e ? <p className="mt-1 text-xs text-red-400">{e}</p> : null)
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function CargaDocumento({ casoId, documentoId, extraerAlSubir }: { casoId: string; documentoId: string; extraerAlSubir: boolean }) {
  const { cargando, error, ejecutar } = useAccion()
  const [fase, setFase] = useState<string | null>(null)
  return (
    <div>
      <label className={`${botonSecCls} cursor-pointer ${cargando ? 'opacity-50' : ''}`}>
        {fase ?? 'Subir'}
        <input
          type="file"
          className="hidden"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={cargando}
          onChange={async e => {
            const archivo = e.target.files?.[0]
            e.target.value = ''
            if (!archivo) return
            const form = new FormData()
            form.append('archivo', archivo)
            form.append('documento_id', documentoId)
            setFase('Subiendo…')
            let docId: string | null = null
            const ok = await ejecutar(`/api/siniestros/casos/${casoId}/documentos`, { method: 'POST', body: form }, j => { docId = String(j.id) })
            if (ok && docId && extraerAlSubir) {
              setFase('Analizando con IA…')
              await ejecutar(`/api/siniestros/documentos/${docId}/extraer`, { method: 'POST' })
            }
            setFase(null)
          }}
        />
      </label>
      <Err e={error} />
    </div>
  )
}

export function BotonExtraer({ documentoId }: { documentoId: string }) {
  const { cargando, error, ejecutar } = useAccion()
  return (
    <span>
      <button className={botonSecCls} disabled={cargando} onClick={() => ejecutar(`/api/siniestros/documentos/${documentoId}/extraer`, { method: 'POST' })}>
        {cargando ? 'Extrayendo…' : 'Extraer con IA'}
      </button>
      <Err e={error} />
    </span>
  )
}

export function VerArchivo({ documentoId, nombre }: { documentoId: string; nombre: string }) {
  const [error, setError] = useState<string | null>(null)
  return (
    <span>
      <button
        className="text-left text-sm text-sky-300 hover:underline"
        onClick={async () => {
          const { ok, json } = await llamar(`/api/siniestros/documentos/${documentoId}/url`, { method: 'GET' })
          if (!ok) return setError(String(json.error))
          window.open(String(json.url), '_blank', 'noopener')
        }}
      >
        {nombre}
      </button>
      <Err e={error} />
    </span>
  )
}

export function BotonAnalizar({ casoId }: { casoId: string }) {
  const { cargando, error, ejecutar } = useAccion()
  return (
    <div className="text-right">
      <button className={botonCls} disabled={cargando} onClick={() => ejecutar(`/api/siniestros/casos/${casoId}/analisis`, json({ con_ia: true }))}>
        {cargando ? 'Analizando…' : 'Ejecutar auto-análisis'}
      </button>
      <Err e={error} />
    </div>
  )
}

export function BotonRevisado({ casoId, analisisId }: { casoId: string; analisisId: string }) {
  const { cargando, error, ejecutar } = useAccion()
  return (
    <span>
      <button
        className={botonSecCls}
        disabled={cargando}
        onClick={() => ejecutar(`/api/siniestros/casos/${casoId}/analisis`, { ...json({ analisis_id: analisisId }), method: 'PATCH' })}
      >
        Marcar análisis como revisado
      </button>
      <Err e={error} />
    </span>
  )
}

export function GradoIncapacidad({ casoId, cobertura, valor }: { casoId: string; cobertura: string; valor: number | null }) {
  const { cargando, error, ejecutar } = useAccion()
  const [pct, setPct] = useState(valor === null ? '' : String(Math.round(valor * 10000) / 100))
  return (
    <div className="flex items-center gap-2">
      <input className={`${inputCls} w-24`} type="number" min={0} max={100} step="0.01" value={pct} onChange={e => setPct(e.target.value)} placeholder="%" />
      <button
        className={botonSecCls}
        disabled={cargando}
        onClick={() => ejecutar(`/api/siniestros/casos/${casoId}/coberturas`, { ...json({ cobertura, grado_incapacidad: pct === '' ? null : Number(pct) / 100 }), method: 'PATCH' })}
      >
        Guardar grado
      </button>
      <Err e={error} />
    </div>
  )
}

interface DatosEditables {
  estado: string
  fecha_comunicacion_tipo_liquidacion: string | null
  fecha_antecedentes_completos: string | null
  fecha_certificado_incapacidad: string | null
  fecha_impugnacion: string | null
  fecha_pago: string | null
  exclusion_confirmada: string | null
  prorroga_liquidacion: boolean
  prorroga_fundamento: string | null
  liquidador_id: string | null
}

export function EditorCaso({
  casoId, datos, exclusiones, estados, esSupervisor, liquidadores,
}: {
  casoId: string
  datos: DatosEditables
  exclusiones: string[]
  estados: Record<string, string>
  esSupervisor: boolean
  liquidadores: { id: string; nombre: string }[]
}) {
  const { cargando, error, ejecutar } = useAccion()
  const [d, setD] = useState(datos)
  const [guardado, setGuardado] = useState(false)
  const fecha = (k: keyof DatosEditables, label: string, ayuda?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      <input type="date" className={inputCls} value={(d[k] as string | null) ?? ''} onChange={e => setD({ ...d, [k]: e.target.value || null })} />
      {ayuda && <span className="text-[11px] text-gray-600">{ayuda}</span>}
    </label>
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-gray-400">Estado</span>
          <select className={inputCls} value={d.estado} onChange={e => setD({ ...d, estado: e.target.value })}>
            {Object.entries(estados).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {fecha('fecha_comunicacion_tipo_liquidacion', 'Comunicación tipo de liquidación', '3 días hábiles desde el denuncio')}
        {fecha('fecha_antecedentes_completos', 'Antecedentes completos', 'Inicia el plazo de pago (art. 30)')}
        {fecha('fecha_certificado_incapacidad', 'Presentación cert. incapacidad')}
        {fecha('fecha_impugnacion', 'Impugnación recibida')}
        {fecha('fecha_pago', 'Fecha de pago')}
        <label className="block">
          <span className="mb-1 block text-xs text-gray-400">Exclusión confirmada (art. 34)</span>
          <select className={inputCls} value={d.exclusion_confirmada ?? ''} onChange={e => setD({ ...d, exclusion_confirmada: e.target.value || null })}>
            <option value="">Ninguna</option>
            {exclusiones.map(x => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        {esSupervisor && (
          <label className="block">
            <span className="mb-1 block text-xs text-gray-400">Liquidador asignado</span>
            <select className={inputCls} value={d.liquidador_id ?? ''} onChange={e => setD({ ...d, liquidador_id: e.target.value || null })}>
              <option value="">Sin asignar</option>
              {liquidadores.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </label>
        )}
      </div>
      {esSupervisor && (
        <div className="rounded-lg border border-white/5 p-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={d.prorroga_liquidacion} onChange={e => setD({ ...d, prorroga_liquidacion: e.target.checked })} />
            Prórroga del plazo de liquidación (+45 días, DS 1.055 art. 23)
          </label>
          {d.prorroga_liquidacion && (
            <textarea
              className={`${inputCls} mt-2`}
              rows={2}
              placeholder="Motivos fundados y gestiones concretas (se comunican al asegurado y a la CMF)"
              value={d.prorroga_fundamento ?? ''}
              onChange={e => setD({ ...d, prorroga_fundamento: e.target.value })}
            />
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          className={botonCls}
          disabled={cargando}
          onClick={async () => {
            const cambios: Partial<DatosEditables> = { ...d }
            if (!esSupervisor) {
              delete cambios.prorroga_liquidacion
              delete cambios.prorroga_fundamento
              delete cambios.liquidador_id
            }
            setGuardado(await ejecutar(`/api/siniestros/casos/${casoId}`, { ...json(cambios), method: 'PATCH' }))
          }}
        >
          {cargando ? 'Guardando…' : 'Guardar y recalcular plazos'}
        </button>
        {guardado && !error && <span className="text-xs text-emerald-400">Guardado</span>}
      </div>
      <Err e={error} />
    </div>
  )
}

export function AgregarPersona({ casoId }: { casoId: string }) {
  const { cargando, error, ejecutar } = useAccion()
  const [abierto, setAbierto] = useState(false)
  const [p, setP] = useState({ rol: 'beneficiario', nombre: '', rut: '', parentesco: 'conyuge' as Parentesco, fecha_nacimiento: '', acredita_posesion_efectiva: false })
  if (!abierto) return <button className={botonSecCls} onClick={() => setAbierto(true)}>+ Persona</button>
  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-white/10 p-3 md:grid-cols-3">
      <select className={inputCls} value={p.rol} onChange={e => setP({ ...p, rol: e.target.value })}>
        {['beneficiario', 'conductor', 'propietario', 'tomador', 'victima'].map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <input className={inputCls} placeholder="Nombre" value={p.nombre} onChange={e => setP({ ...p, nombre: e.target.value })} />
      <input className={inputCls} placeholder="RUT" value={p.rut} onChange={e => setP({ ...p, rut: e.target.value })} />
      {p.rol === 'beneficiario' && (
        <>
          <select className={inputCls} value={p.parentesco} onChange={e => setP({ ...p, parentesco: e.target.value as Parentesco })}>
            {['conyuge', 'hijo', 'padre', 'madre', 'madre_hijos_no_matrimoniales', 'conviviente_civil', 'heredero'].map(x => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}
          </select>
          <input type="date" className={inputCls} value={p.fecha_nacimiento} onChange={e => setP({ ...p, fecha_nacimiento: e.target.value })} />
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input type="checkbox" checked={p.acredita_posesion_efectiva} onChange={e => setP({ ...p, acredita_posesion_efectiva: e.target.checked })} /> Posesión efectiva
          </label>
        </>
      )}
      <div className="flex gap-2 md:col-span-3">
        <button
          className={botonCls}
          disabled={cargando}
          onClick={async () => {
            const ok = await ejecutar(`/api/siniestros/casos/${casoId}/personas`, json({
              rol: p.rol,
              nombre: p.nombre,
              rut: p.rut || null,
              parentesco: p.rol === 'beneficiario' ? p.parentesco : null,
              fecha_nacimiento: p.fecha_nacimiento || null,
              acredita_posesion_efectiva: p.acredita_posesion_efectiva,
            }))
            if (ok) setAbierto(false)
          }}
        >
          Agregar
        </button>
        <button className={botonSecCls} onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
      <Err e={error} />
    </div>
  )
}

export function NuevoInforme({ casoId }: { casoId: string }) {
  const { cargando, error, ejecutar } = useAccion()
  const [tipo, setTipo] = useState('informe_liquidacion')
  const [conclusion, setConclusion] = useState('')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select className={`${inputCls} max-w-[220px]`} value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="preinforme">Preinforme</option>
          <option value="informe_liquidacion">Informe de liquidación</option>
          <option value="finiquito">Finiquito y orden de pago</option>
        </select>
        <button className={botonCls} disabled={cargando} onClick={() => ejecutar(`/api/siniestros/casos/${casoId}/informes`, json({ tipo, conclusion: conclusion || null }))}>
          {cargando ? 'Generando…' : 'Redactar y enviar a aprobación'}
        </button>
      </div>
      <textarea className={inputCls} rows={3} placeholder="Conclusión del liquidador (opcional)" value={conclusion} onChange={e => setConclusion(e.target.value)} />
      <Err e={error} />
    </div>
  )
}

export function AprobarInforme({ informeId }: { informeId: string }) {
  const { cargando, error, ejecutar } = useAccion()
  const [obs, setObs] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={botonCls} disabled={cargando} onClick={() => ejecutar(`/api/siniestros/informes/${informeId}/aprobar`, json({ accion: 'aprobar' }))}>
        Aprobar y emitir PDF
      </button>
      <input className={`${inputCls} max-w-[240px]`} placeholder="Observación para devolver" value={obs} onChange={e => setObs(e.target.value)} />
      <button className={botonSecCls} disabled={cargando || !obs} onClick={() => ejecutar(`/api/siniestros/informes/${informeId}/aprobar`, json({ accion: 'devolver', observacion: obs }))}>
        Devolver
      </button>
      <Err e={error} />
    </div>
  )
}
