'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { botonCls, botonSecCls, inputCls } from './ui'

export function EditorReglas({ puedePublicar, ejemplo }: { puedePublicar: boolean; ejemplo: string }) {
  const router = useRouter()
  const [texto, setTexto] = useState(ejemplo)
  const [vigenteDesde, setVigenteDesde] = useState(new Date().toISOString().slice(0, 10))
  const [resultado, setResultado] = useState<{ valido: boolean; errores: string[] } | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const validar = async () => {
    setMensaje(null)
    const res = await fetch('/api/siniestros/reglas/validar', { method: 'POST', body: texto })
    setResultado(await res.json())
  }

  const publicar = async () => {
    setMensaje(null)
    let json: unknown
    try {
      json = JSON.parse(texto)
    } catch {
      return setResultado({ valido: false, errores: ['JSON mal formado'] })
    }
    const res = await fetch('/api/siniestros/reglas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json_reglas: json, vigente_desde: vigenteDesde }),
    })
    const r = await res.json()
    if (res.status === 422) return setResultado(r)
    setMensaje(res.ok ? 'Versión publicada. Los casos nuevos la usarán desde su fecha de vigencia.' : r.error)
    if (res.ok) router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${botonSecCls} cursor-pointer`}>
          Cargar archivo JSON
          <input type="file" accept="application/json" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setTexto(await f.text()) }} />
        </label>
        <button className={botonSecCls} onClick={validar}>Validar contra JSON Schema</button>
        {puedePublicar && (
          <>
            <input type="date" className={`${inputCls} max-w-[170px]`} value={vigenteDesde} onChange={e => setVigenteDesde(e.target.value)} />
            <button className={botonCls} onClick={publicar}>Publicar versión</button>
          </>
        )}
      </div>
      {resultado && (
        resultado.valido
          ? <p className="text-sm text-emerald-400">✓ Reglas válidas</p>
          : <ul className="list-disc pl-5 text-sm text-red-300">{resultado.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
      )}
      {mensaje && <p className="text-sm text-gray-300">{mensaje}</p>}
      <textarea className={`${inputCls} font-mono text-xs`} rows={24} spellCheck={false} value={texto} onChange={e => setTexto(e.target.value)} />
    </div>
  )
}
