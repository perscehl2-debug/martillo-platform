'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { generarChecklist } from '@/lib/siniestros/checklist'
import { resolverRegimen } from '@/lib/siniestros/reglas/consultas'
import { validarRut } from '@/lib/siniestros/rut'
import type { Parentesco, ReglasProducto, RolSiniestros } from '@/lib/siniestros/tipos'
import { botonCls, botonSecCls, Chip, inputCls, Tarjeta } from './ui'

interface Beneficiario {
  nombre: string
  rut: string
  parentesco: Parentesco
  fecha_nacimiento: string
  acredita_posesion_efectiva: boolean
}

const PARENTESCOS: [Parentesco, string][] = [
  ['conyuge', 'Cónyuge'],
  ['hijo', 'Hijo/a'],
  ['padre', 'Padre'],
  ['madre', 'Madre'],
  ['madre_hijos_no_matrimoniales', 'Madre de hijos no matrimoniales'],
  ['conviviente_civil', 'Conviviente civil'],
  ['heredero', 'Heredero'],
]

function Campo({ label, children, ayuda }: { label: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-400">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-gray-600">{ayuda}</span>}
    </label>
  )
}

export function FormularioCaso({ reglas, liquidadores, rol }: { reglas: ReglasProducto[]; liquidadores: { id: string; nombre: string }[]; rol: RolSiniestros }) {
  const router = useRouter()
  const [producto, setProducto] = useState(reglas[0]?.producto ?? 'SOAP')
  const r = reglas.find(x => x.producto === producto) ?? reglas[0]
  const [f, setF] = useState({
    variante: r.variantes?.[0]?.id ?? '',
    fecha_accidente: '',
    fecha_fallecimiento: '',
    fecha_denuncio: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()),
    fecha_aviso: '',
    lugar_accidente: '',
    relato: '',
    patente: '',
    poliza_numero: '',
    poliza_fecha_contratacion: '',
    poliza_vigencia_desde: '',
    poliza_vigencia_hasta: '',
    tipo_liquidacion: 'registrada',
    liquidador_id: '',
    victima_nombre: '',
    victima_rut: '',
    victima_fecha_nacimiento: '',
  })
  const [coberturas, setCoberturas] = useState<string[]>([])
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const regimen = useMemo(() => {
    if (!f.poliza_fecha_contratacion) return null
    try {
      return resolverRegimen(r, f.poliza_fecha_contratacion)
    } catch {
      return null
    }
  }, [r, f.poliza_fecha_contratacion])
  const checklist = useMemo(() => (coberturas.length ? generarChecklist(r, coberturas) : []), [r, coberturas])
  const conMuerte = coberturas.includes('muerte')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (coberturas.length === 0) return setError('Seleccione al menos una cobertura')
    if (f.victima_rut && !validarRut(f.victima_rut)) return setError('El RUT de la víctima no es válido')
    const malos = beneficiarios.filter(b => b.rut && !validarRut(b.rut))
    if (malos.length) return setError(`RUT inválido: ${malos.map(b => b.nombre).join(', ')}`)
    const opt = (v: string) => (v.trim() ? v.trim() : null)
    setEnviando(true)
    const res = await fetch('/api/siniestros/casos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_id: producto,
        variante: opt(f.variante),
        coberturas,
        fecha_accidente: f.fecha_accidente,
        fecha_fallecimiento: conMuerte ? opt(f.fecha_fallecimiento) : null,
        fecha_denuncio: f.fecha_denuncio,
        fecha_aviso: opt(f.fecha_aviso),
        lugar_accidente: opt(f.lugar_accidente),
        relato: opt(f.relato),
        patente: opt(f.patente),
        poliza_numero: opt(f.poliza_numero),
        poliza_fecha_contratacion: f.poliza_fecha_contratacion,
        poliza_vigencia_desde: opt(f.poliza_vigencia_desde),
        poliza_vigencia_hasta: opt(f.poliza_vigencia_hasta),
        tipo_liquidacion: f.tipo_liquidacion,
        liquidador_id: opt(f.liquidador_id),
        personas: [
          { rol: 'victima', nombre: f.victima_nombre, rut: opt(f.victima_rut), fecha_nacimiento: opt(f.victima_fecha_nacimiento) },
          ...(conMuerte ? beneficiarios : []).map(b => ({
            rol: 'beneficiario',
            nombre: b.nombre,
            rut: opt(b.rut),
            parentesco: b.parentesco,
            fecha_nacimiento: opt(b.fecha_nacimiento),
            acredita_posesion_efectiva: b.acredita_posesion_efectiva,
          })),
        ],
      }),
    })
    const json = await res.json()
    setEnviando(false)
    if (!res.ok) {
      setError(json.detalle ? json.detalle.map((d: { path: string[]; message: string }) => `${d.path.join('.')}: ${d.message}`).join(' · ') : json.error)
      return
    }
    router.push(`/siniestros/${json.id}`)
  }

  return (
    <form onSubmit={enviar} className="space-y-6">
      <Tarjeta titulo="Producto y coberturas">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Producto">
            <select className={inputCls} value={producto} onChange={e => { setProducto(e.target.value); setCoberturas([]) }}>
              {reglas.map(x => <option key={x.producto} value={x.producto}>{x.nombre}</option>)}
            </select>
          </Campo>
          {r.variantes && (
            <Campo label="Variante">
              <select className={inputCls} value={f.variante} onChange={set('variante')}>
                {r.variantes.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </Campo>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {r.coberturas.map(c => {
            const activa = coberturas.includes(c.id)
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setCoberturas(activa ? coberturas.filter(x => x !== c.id) : [...coberturas, c.id])}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${activa ? 'border-[#c8902a] bg-[#c8902a]/10 text-white' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
              >
                {activa ? '✓ ' : ''}{c.nombre}
              </button>
            )
          })}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Siniestro y póliza">
        <div className="grid gap-4 md:grid-cols-3">
          <Campo label="Fecha del accidente *"><input required type="date" className={inputCls} value={f.fecha_accidente} onChange={set('fecha_accidente')} /></Campo>
          <Campo label="Fecha del denuncio *"><input required type="date" className={inputCls} value={f.fecha_denuncio} onChange={set('fecha_denuncio')} /></Campo>
          <Campo label="Fecha de aviso a la aseguradora" ayuda="Si difiere del denuncio (art. 8: 30 días)"><input type="date" className={inputCls} value={f.fecha_aviso} onChange={set('fecha_aviso')} /></Campo>
          {conMuerte && <Campo label="Fecha de fallecimiento *"><input required type="date" className={inputCls} value={f.fecha_fallecimiento} onChange={set('fecha_fallecimiento')} /></Campo>}
          <Campo label="Patente"><input className={inputCls} value={f.patente} onChange={set('patente')} placeholder="BBCL12" /></Campo>
          <Campo label="Lugar del accidente"><input className={inputCls} value={f.lugar_accidente} onChange={set('lugar_accidente')} /></Campo>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Campo label="N° póliza / certificado"><input className={inputCls} value={f.poliza_numero} onChange={set('poliza_numero')} /></Campo>
          <Campo label="Fecha de contratación *"><input required type="date" className={inputCls} value={f.poliza_fecha_contratacion} onChange={set('poliza_fecha_contratacion')} /></Campo>
          <Campo label="Vigencia desde"><input type="date" className={inputCls} value={f.poliza_vigencia_desde} onChange={set('poliza_vigencia_desde')} /></Campo>
          <Campo label="Vigencia hasta"><input type="date" className={inputCls} value={f.poliza_vigencia_hasta} onChange={set('poliza_vigencia_hasta')} /></Campo>
        </div>
        {f.poliza_fecha_contratacion && (
          <p className="mt-3 text-sm">
            {regimen ? (
              <>Régimen aplicable: <Chip color="azul">{regimen.nombre ?? regimen.id}</Chip>{' '}
                <span className="text-gray-500">Topes: {Object.entries(regimen.topes_uf).map(([k, v]) => `${k} ${v} UF`).join(' · ')}</span></>
            ) : <span className="text-red-400">Ningún régimen cubre esa fecha de contratación.</span>}
          </p>
        )}
        <div className="mt-4">
          <Campo label="Relato"><textarea rows={3} className={inputCls} value={f.relato} onChange={set('relato')} /></Campo>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Víctima">
        <div className="grid gap-4 md:grid-cols-3">
          <Campo label="Nombre completo *"><input required minLength={3} className={inputCls} value={f.victima_nombre} onChange={set('victima_nombre')} /></Campo>
          <Campo label="RUT"><input className={inputCls} value={f.victima_rut} onChange={set('victima_rut')} placeholder="12.345.678-5" /></Campo>
          <Campo label="Fecha de nacimiento"><input type="date" className={inputCls} value={f.victima_fecha_nacimiento} onChange={set('victima_fecha_nacimiento')} /></Campo>
        </div>
      </Tarjeta>

      {conMuerte && (
        <Tarjeta
          titulo="Beneficiarios (art. 31)"
          acciones={<button type="button" className={botonSecCls} onClick={() => setBeneficiarios([...beneficiarios, { nombre: '', rut: '', parentesco: 'conyuge', fecha_nacimiento: '', acredita_posesion_efectiva: false }])}>+ Agregar</button>}
        >
          <p className="mb-3 text-xs text-gray-500">Orden: cónyuge → hijos menores → hijos mayores → padres → madre de hijos no matrimoniales → herederos. El conviviente civil cobra sólo como heredero.</p>
          {beneficiarios.length === 0 && <p className="text-sm text-gray-500">Sin beneficiarios registrados.</p>}
          <div className="space-y-3">
            {beneficiarios.map((b, i) => {
              const upd = (c: Partial<Beneficiario>) => setBeneficiarios(beneficiarios.map((x, j) => (j === i ? { ...x, ...c } : x)))
              return (
                <div key={i} className="grid items-end gap-2 rounded-lg border border-white/5 p-3 md:grid-cols-[2fr_1fr_1.5fr_1fr_auto]">
                  <Campo label="Nombre"><input required className={inputCls} value={b.nombre} onChange={e => upd({ nombre: e.target.value })} /></Campo>
                  <Campo label="RUT"><input className={inputCls} value={b.rut} onChange={e => upd({ rut: e.target.value })} /></Campo>
                  <Campo label="Parentesco">
                    <select className={inputCls} value={b.parentesco} onChange={e => upd({ parentesco: e.target.value as Parentesco })}>
                      {PARENTESCOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Nacimiento"><input type="date" className={inputCls} value={b.fecha_nacimiento} onChange={e => upd({ fecha_nacimiento: e.target.value })} /></Campo>
                  <button type="button" className={botonSecCls} onClick={() => setBeneficiarios(beneficiarios.filter((_, j) => j !== i))}>Quitar</button>
                  {(b.parentesco === 'heredero' || b.parentesco === 'conviviente_civil') && (
                    <label className="flex items-center gap-2 text-xs text-gray-400 md:col-span-5">
                      <input type="checkbox" checked={b.acredita_posesion_efectiva} onChange={e => upd({ acredita_posesion_efectiva: e.target.checked })} />
                      Acredita posesión efectiva
                    </label>
                  )}
                </div>
              )
            })}
          </div>
        </Tarjeta>
      )}

      <Tarjeta titulo="Liquidación">
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Tipo de liquidación" ayuda="Por defecto, liquidador registrado (DS 1.055 arts. 20-21)">
            <select className={inputCls} value={f.tipo_liquidacion} onChange={set('tipo_liquidacion')}>
              <option value="registrada">Liquidador registrado</option>
              <option value="directa">Directa por la aseguradora</option>
            </select>
          </Campo>
          {rol !== 'liquidador' && (
            <Campo label="Liquidador asignado">
              <select className={inputCls} value={f.liquidador_id} onChange={set('liquidador_id')}>
                <option value="">Sin asignar</option>
                {liquidadores.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </Campo>
          )}
        </div>
      </Tarjeta>

      {checklist.length > 0 && (
        <Tarjeta titulo={`Checklist que se generará (${checklist.length} documentos)`}>
          <ul className="grid gap-1 text-sm md:grid-cols-2">
            {checklist.map(c => (
              <li key={c.documento_id} className="text-gray-300">
                {c.obligatorio ? <span className="text-[#c8902a]">●</span> : <span className="text-gray-600">○</span>} {c.nombre}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={enviando || !regimen} className={botonCls}>{enviando ? 'Registrando…' : 'Registrar denuncio'}</button>
    </form>
  )
}
