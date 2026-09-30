'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  clasificarIncapacidad, coberturasDesdeRespuestas, pasoBeneficiarios, PREGUNTAS_BENEFICIARIOS, TIPOS_VICTIMA, validarFechas,
  type Consecuencias, type PasoBeneficiarios, type RespuestasBeneficiarios, type TipoVictima,
} from '@/lib/siniestros/arbol'
import { generarChecklist } from '@/lib/siniestros/checklist'
import { formatearFecha } from '@/lib/siniestros/fechas'
import { POLIZAS_DEMO, type Poliza } from '@/lib/siniestros/polizas'
import { resolverRegimen } from '@/lib/siniestros/reglas/consultas'
import { formatearRut, validarRut } from '@/lib/siniestros/rut'
import type { Parentesco, ReglasProducto, RolSiniestros } from '@/lib/siniestros/tipos'
import { botonCls, botonSecCls, Chip, inputCls } from './ui'

const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())

interface PersonaForm {
  nombre: string
  rut: string
  fecha_nacimiento: string
  parentesco: Parentesco
}
const personaVacia = (parentesco: Parentesco): PersonaForm => ({ nombre: '', rut: '', fecha_nacimiento: '', parentesco })
const personaOk = (p: PersonaForm) => p.nombre.trim().length >= 3 && (!p.rut || validarRut(p.rut))

// ─── Piezas visuales ─────────────────────────────────────────
function Paso({ n, titulo, listo, children }: { n: number; titulo: string; listo: boolean; children: React.ReactNode }) {
  return (
    <section className="relative rounded-xl border border-white/10 bg-[#070b18] p-5">
      <header className="mb-4 flex items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${listo ? 'bg-emerald-500 text-black' : 'bg-[#c8902a] text-black'}`}>
          {listo ? '✓' : n}
        </span>
        <h2 className="font-bold text-white">{titulo}</h2>
      </header>
      {children}
    </section>
  )
}

function Campo({ label, children, ayuda }: { label: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-400">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-gray-600">{ayuda}</span>}
    </label>
  )
}

function Opcion({ activa, onClick, titulo, ayuda }: { activa: boolean; onClick: () => void; titulo: string; ayuda?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${activa ? 'border-[#c8902a] bg-[#c8902a]/10 text-white' : 'border-white/10 text-gray-300 hover:border-white/25'}`}
    >
      <span className="block font-medium">{activa ? '✓ ' : ''}{titulo}</span>
      {ayuda && <span className="mt-0.5 block text-xs text-gray-500">{ayuda}</span>}
    </button>
  )
}

function SiNo({ valor, onChange }: { valor: boolean | null | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <Opcion activa={valor === true} onClick={() => onChange(true)} titulo="Sí" />
      <Opcion activa={valor === false} onClick={() => onChange(false)} titulo="No" />
    </div>
  )
}

function RutInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const invalido = value.length > 0 && !validarRut(value)
  return (
    <div>
      <input className={`${inputCls} ${invalido ? 'border-red-500/60' : ''}`} value={value} onChange={e => onChange(e.target.value)} placeholder="12.345.678-5" />
      {invalido && <span className="mt-1 block text-xs text-red-400">RUT inválido</span>}
      {value && !invalido && <span className="mt-1 block text-xs text-emerald-400">✓ {formatearRut(value)}</span>}
    </div>
  )
}

function ListaPersonas({
  personas, onChange, parentescos, max, etiqueta,
}: {
  personas: PersonaForm[]
  onChange: (p: PersonaForm[]) => void
  parentescos: [Parentesco, string][]
  max?: number
  etiqueta: string
}) {
  const upd = (i: number, c: Partial<PersonaForm>) => onChange(personas.map((x, j) => (j === i ? { ...x, ...c } : x)))
  return (
    <div className="space-y-2">
      {personas.map((p, i) => (
        <div key={i} className="grid items-start gap-2 rounded-lg border border-white/5 p-3 md:grid-cols-[2fr_1.3fr_1fr_1.2fr_auto]">
          <Campo label="Nombre completo"><input className={inputCls} value={p.nombre} onChange={e => upd(i, { nombre: e.target.value })} /></Campo>
          <Campo label="RUT"><RutInput value={p.rut} onChange={v => upd(i, { rut: v })} /></Campo>
          <Campo label="Nacimiento"><input type="date" className={inputCls} value={p.fecha_nacimiento} onChange={e => upd(i, { fecha_nacimiento: e.target.value })} /></Campo>
          <Campo label="Parentesco">
            <select className={inputCls} value={p.parentesco} onChange={e => upd(i, { parentesco: e.target.value as Parentesco })} disabled={parentescos.length === 1}>
              {parentescos.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
          <button type="button" className={`${botonSecCls} md:mt-5`} onClick={() => onChange(personas.filter((_, j) => j !== i))}>Quitar</button>
        </div>
      ))}
      {(!max || personas.length < max) && (
        <button type="button" className={botonSecCls} onClick={() => onChange([...personas, personaVacia(parentescos[0][0])])}>+ {etiqueta}</button>
      )}
    </div>
  )
}

const PARENTESCOS_CLASE: Record<PasoBeneficiarios, [Parentesco, string][]> = {
  conyuge: [['conyuge', 'Cónyuge']],
  hijos: [['hijo', 'Hijo/a']],
  padres: [['madre', 'Madre'], ['padre', 'Padre']],
  madre_hijos: [['madre_hijos_no_matrimoniales', 'Madre de hijos no matrimoniales']],
  herederos: [['heredero', 'Heredero'], ['conviviente_civil', 'Conviviente civil']],
}

// ─── Asistente ───────────────────────────────────────────────
export function AsistenteDenuncio({ reglas, liquidadores, rol }: { reglas: ReglasProducto[]; liquidadores: { id: string; nombre: string }[]; rol: RolSiniestros }) {
  const router = useRouter()

  // 1. Póliza
  const [q, setQ] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<Poliza[] | null>(null)
  const [fuente, setFuente] = useState<'base' | 'demo' | null>(null)
  const [poliza, setPoliza] = useState<Poliza | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)

  // 2. Accidente
  const [fechas, setFechas] = useState({ fecha_accidente: '', fecha_denuncio: hoy(), lugar_accidente: '', relato: '' })
  // 3-4. Víctima
  const [tipoVictima, setTipoVictima] = useState<TipoVictima | null>(null)
  const [victima, setVictima] = useState({ nombre: '', rut: '', fecha_nacimiento: '' })
  // 5. Consecuencias
  const [cons, setCons] = useState<Consecuencias>({ gastos_medicos: false, incapacidad: false, fallecimiento: false })
  const [tieneCertificado, setTieneCertificado] = useState<boolean | null>(null)
  const [grado, setGrado] = useState('')
  const [fechaFallecimiento, setFechaFallecimiento] = useState('')
  // 6. Beneficiarios
  const [respBen, setRespBen] = useState<RespuestasBeneficiarios>({})
  const [beneficiarios, setBeneficiarios] = useState<PersonaForm[]>([])
  // 7. Cierre
  const [liquidacion, setLiquidacion] = useState({ tipo_liquidacion: 'registrada', liquidador_id: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const r = useMemo(() => (poliza ? reglas.find(x => x.producto === poliza.producto) ?? reglas[0] : reglas[0]), [poliza, reglas])
  const regimen = useMemo(() => {
    if (!poliza) return null
    try {
      return resolverRegimen(r, poliza.fecha_contratacion)
    } catch {
      return null
    }
  }, [poliza, r])

  async function buscar(termino = q) {
    if (!termino.trim()) return
    setBuscando(true)
    setErrorBusqueda(null)
    const res = await fetch(`/api/siniestros/polizas?q=${encodeURIComponent(termino)}`)
    const json = await res.json()
    setBuscando(false)
    if (!res.ok) return setErrorBusqueda(json.error ?? 'Error al buscar')
    setResultados(json.polizas)
    setFuente(json.fuente)
    if (json.polizas.length === 1) setPoliza(json.polizas[0])
  }

  function elegirPoliza(p: Poliza | null) {
    setPoliza(p)
    // Cambiar de póliza reinicia el árbol.
    setFechas({ fecha_accidente: '', fecha_denuncio: hoy(), lugar_accidente: '', relato: '' })
    setTipoVictima(null)
  }

  // ─── Avance del árbol ───
  const avisos = poliza ? validarFechas(poliza, r, { ...fechas, fecha_fallecimiento: cons.fallecimiento ? fechaFallecimiento || null : null }, hoy()) : []
  const bloqueoFechas = avisos.some(a => a.nivel === 'bloqueo')
  const paso2 = !!poliza && !!fechas.fecha_accidente && !!fechas.fecha_denuncio && !bloqueoFechas
  const paso3 = paso2 && !!tipoVictima
  const paso4 = paso3 && victima.nombre.trim().length >= 3 && (!victima.rut || validarRut(victima.rut))
  const gradoNum = tieneCertificado && grado !== '' ? Number(grado) : null
  const clasif = clasificarIncapacidad(gradoNum, r)
  const coberturas = coberturasDesdeRespuestas(cons, gradoNum, r)
  const benPaso = pasoBeneficiarios(respBen)
  const beneficiariosOk = !cons.fallecimiento || (!!benPaso.cobra && beneficiarios.length > 0 && beneficiarios.every(personaOk))
  const paso5 =
    paso4 &&
    (cons.gastos_medicos || cons.incapacidad || cons.fallecimiento) &&
    (!cons.fallecimiento || !!fechaFallecimiento) &&
    (!cons.incapacidad || cons.fallecimiento || tieneCertificado === false || (tieneCertificado === true && grado !== '')) &&
    coberturas.length > 0
  const paso6 = paso5 && beneficiariosOk
  const checklist = useMemo(() => (coberturas.length ? generarChecklist(r, coberturas) : []), [r, coberturas.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  function responderBen(paso: Exclude<PasoBeneficiarios, 'herederos'>, v: boolean) {
    const orden: Exclude<PasoBeneficiarios, 'herederos'>[] = ['conyuge', 'hijos', 'padres', 'madre_hijos']
    const nuevo: RespuestasBeneficiarios = {}
    for (const o of orden) {
      if (o === paso) { nuevo[o] = v; break }
      nuevo[o] = respBen[o]
    }
    setRespBen(nuevo)
    const cobra = pasoBeneficiarios(nuevo).cobra
    setBeneficiarios(cobra ? [personaVacia(PARENTESCOS_CLASE[cobra][0][0])] : [])
  }

  async function enviar() {
    if (!poliza) return
    setError(null)
    setEnviando(true)
    const opt = (v: string) => (v.trim() ? v.trim() : null)
    const res = await fetch('/api/siniestros/casos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poliza_numero: poliza.numero,
        coberturas,
        tipo_victima: tipoVictima,
        grado_incapacidad_pct: gradoNum,
        fecha_accidente: fechas.fecha_accidente,
        fecha_fallecimiento: cons.fallecimiento ? fechaFallecimiento : null,
        fecha_denuncio: fechas.fecha_denuncio,
        lugar_accidente: opt(fechas.lugar_accidente),
        relato: opt(fechas.relato),
        tipo_liquidacion: liquidacion.tipo_liquidacion,
        liquidador_id: opt(liquidacion.liquidador_id),
        personas: [
          { rol: 'victima', nombre: victima.nombre.trim(), rut: opt(victima.rut), fecha_nacimiento: opt(victima.fecha_nacimiento) },
          ...(cons.fallecimiento ? beneficiarios : []).map(b => ({
            rol: 'beneficiario',
            nombre: b.nombre.trim(),
            rut: opt(b.rut),
            parentesco: b.parentesco,
            fecha_nacimiento: opt(b.fecha_nacimiento),
            acredita_posesion_efectiva: benPaso.cobra === 'herederos',
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
    <div className="space-y-4">
      {/* 1 ─ Póliza */}
      <Paso n={1} titulo="Póliza" listo={!!poliza}>
        {!poliza ? (
          <>
            <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); buscar() }}>
              <input className={`${inputCls} max-w-sm`} value={q} onChange={e => setQ(e.target.value)} placeholder="N° de póliza o patente (ej. SOAP-2026-100245 o KJTR45)" autoFocus />
              <button className={botonCls} disabled={buscando || !q.trim()}>{buscando ? 'Buscando…' : 'Buscar póliza'}</button>
            </form>
            {errorBusqueda && <p className="mt-2 text-sm text-red-400">{errorBusqueda}</p>}
            {resultados && resultados.length === 0 && <p className="mt-3 text-sm text-amber-300">No se encontró ninguna póliza con “{q}”. Revise el número o la patente.</p>}
            {resultados && resultados.length > 1 && (
              <div className="mt-3 space-y-2">
                {resultados.map(p => <Opcion key={p.numero} activa={false} onClick={() => elegirPoliza(p)} titulo={`${p.numero} · ${p.vehiculo.patente}`} ayuda={`${p.tomador.nombre} · vigencia ${formatearFecha(p.vigencia_desde)} a ${formatearFecha(p.vigencia_hasta)}`} />)}
              </div>
            )}
            <div className="mt-4">
              <p className="mb-2 text-xs text-gray-500">Pólizas de demostración para probar:</p>
              <div className="flex flex-wrap gap-2">
                {POLIZAS_DEMO.map(p => (
                  <button key={p.numero} type="button" className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300 hover:border-[#c8902a]" onClick={() => { setQ(p.numero); buscar(p.numero) }}>
                    {p.numero}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-xs uppercase text-gray-500">Póliza</p>
                <p className="font-mono font-bold text-white">{poliza.numero}</p>
                <p className="text-gray-400">{poliza.variante ?? poliza.producto} · {poliza.aseguradora}</p>
                <p className="text-gray-400">Vigencia {formatearFecha(poliza.vigencia_desde)} a {formatearFecha(poliza.vigencia_hasta)}</p>
                <p className="text-gray-400">Contratada {formatearFecha(poliza.fecha_contratacion)}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-xs uppercase text-gray-500">Vehículo</p>
                <p className="font-mono font-bold text-white">{poliza.vehiculo.patente}</p>
                <p className="text-gray-400">{[poliza.vehiculo.marca, poliza.vehiculo.modelo, poliza.vehiculo.anio].filter(Boolean).join(' ')}</p>
                <p className="text-gray-400">{[poliza.vehiculo.tipo, poliza.vehiculo.uso].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3">
                <p className="text-xs uppercase text-gray-500">Tomador</p>
                <p className="font-bold text-white">{poliza.tomador.nombre}</p>
                <p className="text-gray-400">{poliza.tomador.rut ? `RUT ${formatearRut(poliza.tomador.rut)}` : 'Sin RUT chileno'}</p>
                <p className="text-gray-400">{[poliza.tomador.telefono, poliza.tomador.email].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {regimen && <Chip color={regimen.id === 'post_ley_jacinta' ? 'verde' : 'amarillo'}>{regimen.nombre ?? regimen.id}</Chip>}
              {regimen && <span className="text-xs text-gray-500">Topes: {Object.entries(regimen.topes_uf).map(([k, v]) => `${k.replace('_', ' ')} ${v} UF`).join(' · ')}</span>}
              {fuente === 'demo' && <Chip>Póliza de demostración</Chip>}
              <button type="button" className="ml-auto text-xs text-gray-400 underline" onClick={() => { elegirPoliza(null); setResultados(null) }}>Cambiar póliza</button>
            </div>
          </div>
        )}
      </Paso>

      {/* 2 ─ Accidente */}
      {poliza && (
        <Paso n={2} titulo="¿Cuándo y dónde ocurrió el accidente?" listo={paso2}>
          <div className="grid gap-3 md:grid-cols-3">
            <Campo label="Fecha del accidente *"><input type="date" className={inputCls} value={fechas.fecha_accidente} max={hoy()} onChange={e => setFechas({ ...fechas, fecha_accidente: e.target.value })} /></Campo>
            <Campo label="Fecha del denuncio *"><input type="date" className={inputCls} value={fechas.fecha_denuncio} onChange={e => setFechas({ ...fechas, fecha_denuncio: e.target.value })} /></Campo>
            <Campo label="Lugar"><input className={inputCls} value={fechas.lugar_accidente} onChange={e => setFechas({ ...fechas, lugar_accidente: e.target.value })} placeholder="Comuna, calle" /></Campo>
          </div>
          <div className="mt-3"><Campo label="Breve relato"><textarea rows={2} className={inputCls} value={fechas.relato} onChange={e => setFechas({ ...fechas, relato: e.target.value })} /></Campo></div>
          {avisos.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {avisos.map((a, i) => (
                <li key={i} className={a.nivel === 'bloqueo' ? 'text-red-400' : a.nivel === 'advertencia' ? 'text-amber-300' : 'text-emerald-400'}>
                  {a.nivel === 'bloqueo' ? '✗' : a.nivel === 'advertencia' ? '!' : '✓'} {a.mensaje}
                </li>
              ))}
            </ul>
          )}
        </Paso>
      )}

      {/* 3 ─ Tipo de víctima */}
      {paso2 && (
        <Paso n={3} titulo="¿Quién es la víctima?" listo={paso3}>
          <div className="grid gap-2 md:grid-cols-3">
            {TIPOS_VICTIMA.map(t => <Opcion key={t.id} activa={tipoVictima === t.id} onClick={() => setTipoVictima(t.id)} titulo={t.nombre} ayuda={t.ayuda} />)}
          </div>
        </Paso>
      )}

      {/* 4 ─ Datos de la víctima */}
      {paso3 && (
        <Paso n={4} titulo="Datos de la víctima" listo={paso4}>
          {tipoVictima === 'conductor' && (
            <button type="button" className={`${botonSecCls} mb-3`} onClick={() => setVictima({ nombre: poliza!.propietario?.nombre ?? poliza!.tomador.nombre, rut: poliza!.propietario?.rut ?? poliza!.tomador.rut ?? '', fecha_nacimiento: victima.fecha_nacimiento })}>
              El conductor es el propietario ({poliza!.propietario?.nombre ?? poliza!.tomador.nombre})
            </button>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <Campo label="Nombre completo *"><input className={inputCls} value={victima.nombre} onChange={e => setVictima({ ...victima, nombre: e.target.value })} /></Campo>
            <Campo label="RUT"><RutInput value={victima.rut} onChange={v => setVictima({ ...victima, rut: v })} /></Campo>
            <Campo label="Fecha de nacimiento"><input type="date" className={inputCls} value={victima.fecha_nacimiento} onChange={e => setVictima({ ...victima, fecha_nacimiento: e.target.value })} /></Campo>
          </div>
        </Paso>
      )}

      {/* 5 ─ Consecuencias (se abren sub-preguntas) */}
      {paso4 && (
        <Paso n={5} titulo="¿Qué consecuencias tuvo el accidente?" listo={paso5}>
          <p className="mb-3 text-xs text-gray-500">Marque todas las que correspondan.</p>
          <div className="grid gap-2 md:grid-cols-3">
            <Opcion activa={cons.gastos_medicos} onClick={() => setCons({ ...cons, gastos_medicos: !cons.gastos_medicos })} titulo="Atención médica / hospitalización" ayuda="Gastos médicos, hospitalarios y farmacéuticos" />
            {!cons.fallecimiento && (
              <Opcion activa={cons.incapacidad} onClick={() => setCons({ ...cons, incapacidad: !cons.incapacidad })} titulo="Secuelas permanentes" ayuda="Incapacidad total o parcial" />
            )}
            <Opcion activa={cons.fallecimiento} onClick={() => setCons({ ...cons, fallecimiento: !cons.fallecimiento, incapacidad: false })} titulo="Fallecimiento" ayuda="La víctima falleció a causa del accidente" />
          </div>

          {cons.incapacidad && !cons.fallecimiento && (
            <div className="mt-4 space-y-3 rounded-lg border border-white/5 p-4">
              <p className="text-sm text-white">¿Ya tiene el certificado del médico tratante con el grado de incapacidad?</p>
              <SiNo valor={tieneCertificado} onChange={setTieneCertificado} />
              {tieneCertificado && (
                <Campo label="Grado de pérdida de capacidad de trabajo (%)">
                  <input type="number" min={0} max={100} step="0.1" className={`${inputCls} max-w-[160px]`} value={grado} onChange={e => setGrado(e.target.value)} />
                </Campo>
              )}
              {tieneCertificado !== null && (tieneCertificado === false || grado !== '') && (
                <p className={`text-sm ${clasif.cobertura ? 'text-emerald-400' : 'text-amber-300'}`}>→ {clasif.mensaje}</p>
              )}
            </div>
          )}

          {cons.fallecimiento && (
            <div className="mt-4 rounded-lg border border-white/5 p-4">
              <Campo label="Fecha de fallecimiento *"><input type="date" className={`${inputCls} max-w-[200px]`} value={fechaFallecimiento} min={fechas.fecha_accidente} onChange={e => setFechaFallecimiento(e.target.value)} /></Campo>
            </div>
          )}

          {paso4 && (cons.gastos_medicos || cons.incapacidad || cons.fallecimiento) && coberturas.length === 0 && (
            <p className="mt-3 text-sm text-amber-300">Con estas respuestas no hay cobertura que liquidar todavía.</p>
          )}
        </Paso>
      )}

      {/* 6 ─ Beneficiarios (árbol del art. 31) */}
      {paso5 && cons.fallecimiento && (
        <Paso n={6} titulo="¿Quién cobra la indemnización por muerte? (art. 31)" listo={beneficiariosOk}>
          <div className="space-y-4">
            {(['conyuge', 'hijos', 'padres', 'madre_hijos'] as const).map(paso => {
              const orden = ['conyuge', 'hijos', 'padres', 'madre_hijos']
              const visible = orden.slice(0, orden.indexOf(paso)).every(prev => respBen[prev as keyof RespuestasBeneficiarios] === false)
              if (!visible) return null
              return (
                <div key={paso} className="space-y-2">
                  <p className="text-sm text-white">{PREGUNTAS_BENEFICIARIOS[paso]}</p>
                  <SiNo valor={respBen[paso]} onChange={v => responderBen(paso, v)} />
                </div>
              )
            })}
            {benPaso.cobra && (
              <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-sm text-emerald-300">
                  {benPaso.cobra === 'herederos' ? PREGUNTAS_BENEFICIARIOS.herederos : `Cobra: ${PARENTESCOS_CLASE[benPaso.cobra].map(x => x[1]).join(' / ')}. Las clases siguientes quedan excluidas.`}
                  {benPaso.cobra === 'hijos' && ' Los hijos menores de edad tienen preferencia sobre los mayores; el sistema lo calcula con la fecha de nacimiento.'}
                </p>
                <ListaPersonas
                  personas={beneficiarios}
                  onChange={setBeneficiarios}
                  parentescos={PARENTESCOS_CLASE[benPaso.cobra]}
                  max={benPaso.cobra === 'conyuge' || benPaso.cobra === 'madre_hijos' ? 1 : benPaso.cobra === 'padres' ? 2 : undefined}
                  etiqueta="Agregar persona"
                />
              </div>
            )}
          </div>
        </Paso>
      )}

      {/* 7 ─ Resumen y registro */}
      {paso6 && (
        <Paso n={cons.fallecimiento ? 7 : 6} titulo="Resumen y registro" listo={false}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <p className="text-xs uppercase text-gray-500">Coberturas determinadas</p>
              <div className="flex flex-wrap gap-2">
                {coberturas.map(c => (
                  <Chip key={c} color="azul">{r.coberturas.find(x => x.id === c)?.nombre ?? c} · tope {regimen?.topes_uf[r.coberturas.find(x => x.id === c)?.tope_uf_ref ?? ''] ?? '?'} UF</Chip>
                ))}
              </div>
              <p className="pt-2 text-xs uppercase text-gray-500">Liquidación</p>
              <select className={inputCls} value={liquidacion.tipo_liquidacion} onChange={e => setLiquidacion({ ...liquidacion, tipo_liquidacion: e.target.value })}>
                <option value="registrada">Liquidador registrado</option>
                <option value="directa">Directa por la aseguradora</option>
              </select>
              {rol !== 'liquidador' && (
                <select className={inputCls} value={liquidacion.liquidador_id} onChange={e => setLiquidacion({ ...liquidacion, liquidador_id: e.target.value })}>
                  <option value="">Liquidador: sin asignar</option>
                  {liquidadores.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </select>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs uppercase text-gray-500">Documentos que se pedirán ({checklist.length})</p>
              <ul className="space-y-1 text-sm">
                {checklist.map(c => (
                  <li key={c.documento_id} className="text-gray-300">
                    {c.obligatorio ? <span className="text-[#c8902a]">●</span> : <span className="text-gray-600">○</span>} {c.nombre}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {error && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
          <button type="button" className={`${botonCls} mt-4`} disabled={enviando} onClick={enviar}>{enviando ? 'Registrando…' : 'Registrar denuncio'}</button>
        </Paso>
      )}
    </div>
  )
}
