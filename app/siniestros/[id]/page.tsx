import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  AgregarPersona, AprobarInforme, BotonAnalizar, BotonExtraer, BotonRevisado, CargaDocumento, EditorCaso, GradoIncapacidad, NuevoInforme, VerArchivo,
} from '@/components/siniestros/AccionesCaso'
import { Chip, ChipPlazo, ChipRequisito, clp, ESTADOS_CASO, Tarjeta, uf } from '@/components/siniestros/ui'
import type { ResultadoPrelacion } from '@/lib/siniestros/beneficiarios'
import type { ResultadoCalculo } from '@/lib/siniestros/calculo'
import { resumirChecklist } from '@/lib/siniestros/checklist'
import { formatearFecha, hoyIso } from '@/lib/siniestros/fechas'
import { estadoPlazo } from '@/lib/siniestros/plazos'
import { resolverRegimen } from '@/lib/siniestros/reglas/consultas'
import { formatearRut } from '@/lib/siniestros/rut'
import { reglasDelCaso, sesionSiniestros, type CasoDb } from '@/lib/siniestros/servidor'
import type { ExtraccionDocumento, Hallazgo } from '@/lib/siniestros/tipos'
import type { ResultadoValidacion } from '@/lib/siniestros/validaciones'

export const dynamic = 'force-dynamic'

const ESTADO_INFORME: Record<string, 'gris' | 'amarillo' | 'verde' | 'azul' | 'rojo'> = {
  borrador: 'gris', pendiente_aprobacion: 'amarillo', aprobado: 'azul', emitido: 'verde', anulado: 'rojo',
}

function Hallazgos({ titulo, items, color }: { titulo: string; items: Hallazgo[]; color: 'rojo' | 'amarillo' | 'azul' }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">{titulo}</p>
      <ul className="space-y-1">
        {items.map((h, i) => (
          <li key={i} className="flex gap-2 text-sm text-gray-300">
            <Chip color={h.severidad === 'error' ? 'rojo' : h.severidad === 'info' ? 'azul' : color}>{h.severidad}</Chip>
            <span>{h.mensaje}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function DetalleCaso({ params }: { params: { id: string } }) {
  const sesion = await sesionSiniestros()
  if (!sesion) redirect(`/auth/login?redirect=/siniestros/${params.id}`)
  const { supabase, usuario } = sesion
  const sensible = usuario.rol !== 'administrativo'

  const { data: caso } = await supabase.from('casos_siniestro').select('*').eq('id', params.id).maybeSingle<CasoDb>()
  if (!caso) notFound()
  const reglas = await reglasDelCaso(supabase, caso)
  const regimen = resolverRegimen(reglas, caso.poliza_fecha_contratacion)

  const [personas, requisitos, documentos, coberturas, plazos, analisis, informes, usuarios] = await Promise.all([
    supabase.from('personas').select('*').eq('caso_id', caso.id).order('created_at'),
    supabase.from('requisitos_caso').select('*').eq('caso_id', caso.id).order('obligatorio', { ascending: false }),
    supabase.from('documentos').select('id, tipo, nombre_archivo, hash_sha256, subido_at, extracciones(id, estado, json_datos, confianza, error, created_at)').eq('caso_id', caso.id).order('subido_at'),
    supabase.from('coberturas_caso').select('*').eq('caso_id', caso.id),
    supabase.from('plazos_caso').select('*').eq('caso_id', caso.id).order('fecha_limite'),
    supabase.from('analisis_caso').select('*').eq('caso_id', caso.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('informes').select('id, tipo, estado, monto_uf, monto_clp, valor_uf, fecha_valor_uf, redactado_por, created_at, emitido_at, pdf_hash_sha256, json_contenido').eq('caso_id', caso.id).order('created_at', { ascending: false }),
    supabase.from('usuarios').select('id, nombre, rol').eq('activo', true),
  ])

  const nombreUsuario = (id: string | null) => usuarios.data?.find(u => u.id === id)?.nombre ?? '—'
  const hoy = hoyIso()
  const resumen = resumirChecklist(requisitos.data ?? [])
  const a = analisis.data
  const calculo = a?.json_calculo as { resultados: ResultadoCalculo[]; beneficiarios: ResultadoPrelacion | null; total_uf: number; total_clp: number } | undefined
  const ia = a?.json_ia as { resumen_ejecutivo?: string; observaciones?: { tipo: string; mensaje: string }[]; recomendaciones?: string[]; antecedentes_sugeridos?: string[]; error?: string } | null

  type Doc = NonNullable<typeof documentos.data>[number]
  const docsPorTipo = new Map<string, Doc[]>()
  for (const d of documentos.data ?? []) docsPorTipo.set(d.tipo, [...(docsPorTipo.get(d.tipo) ?? []), d])
  const ultimaExtraccion = (d: Doc) =>
    [...((d.extracciones as { id: string; estado: string; json_datos: ExtraccionDocumento | null; confianza: number | null; error: string | null; created_at: string }[]) ?? [])]
      .sort((x, y) => y.created_at.localeCompare(x.created_at))[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/siniestros" className="text-xs text-gray-500 hover:text-white">← Bandeja</Link>
          <h1 className="font-mono text-2xl font-black text-white md:text-3xl">{caso.numero}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip color="azul">{ESTADOS_CASO[caso.estado] ?? caso.estado}</Chip>
            <Chip>{reglas.nombre}{caso.variante ? ` · ${caso.variante}` : ''}</Chip>
            <Chip color={regimen.id === 'post_ley_jacinta' ? 'verde' : 'amarillo'}>{regimen.nombre ?? regimen.id}</Chip>
            <Chip>Reglas v{caso.reglas_version}</Chip>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-gray-500">Liquidador</p>
          <p className="text-white">{nombreUsuario(caso.liquidador_id)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Tarjeta titulo="Siniestro">
            <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              {[
                ['Accidente', formatearFecha(caso.fecha_accidente)],
                ['Denuncio', formatearFecha(caso.fecha_denuncio)],
                ['Fallecimiento', formatearFecha(caso.fecha_fallecimiento)],
                ['Patente', caso.patente ?? '—'],
                ['Póliza', `${caso.poliza_numero ?? '—'} · contratada ${formatearFecha(caso.poliza_fecha_contratacion)}`],
                ['Vigencia', `${formatearFecha(caso.poliza_vigencia_desde)} a ${formatearFecha(caso.poliza_vigencia_hasta)}`],
                ['Lugar', caso.lugar_accidente ?? '—'],
                ['Liquidación', caso.tipo_liquidacion === 'directa' ? 'Directa' : 'Liquidador registrado'],
                ['Coberturas', caso.coberturas.map(c => reglas.coberturas.find(x => x.id === c)?.nombre ?? c).join(', ')],
                ['Topes', Object.entries(regimen.topes_uf).map(([k, v]) => `${k} ${v} UF`).join(' · ')],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">{k}</dt><dd className="text-gray-200">{v}</dd></div>
              ))}
            </dl>
            {caso.relato && <p className="mt-3 text-sm text-gray-400">{caso.relato}</p>}
            {caso.exclusion_confirmada && <p className="mt-3 text-sm text-red-300">Exclusión confirmada: {caso.exclusion_confirmada}</p>}
          </Tarjeta>

          <Tarjeta
            titulo={`Checklist de antecedentes (${resumen.obligatorios_validados}/${resumen.obligatorios} obligatorios validados)`}
            acciones={resumen.completo ? <Chip color="verde">Completo</Chip> : <Chip color="amarillo">{resumen.pendientes_obligatorios.length} pendientes</Chip>}
          >
            <ul className="divide-y divide-white/5">
              {(requisitos.data ?? []).map(r => (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-white">
                        {r.obligatorio ? <span className="text-[#c8902a]">● </span> : <span className="text-gray-600">○ </span>}
                        {r.nombre}
                      </p>
                      <p className="text-xs text-gray-600">{r.coberturas.join(', ')}{r.obligatorio ? '' : ' · opcional'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChipRequisito estado={r.estado} />
                      <CargaDocumento casoId={caso.id} documentoId={r.documento_id} extraerAlSubir={sensible} />
                    </div>
                  </div>
                  {(docsPorTipo.get(r.documento_id) ?? []).map(d => {
                    const ext = ultimaExtraccion(d)
                    return (
                      <div key={d.id} className="ml-4 mt-2 rounded-lg border border-white/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <VerArchivo documentoId={d.id} nombre={d.nombre_archivo} />
                            <p className="font-mono text-[10px] text-gray-600">SHA-256 {d.hash_sha256.slice(0, 16)}… · {new Date(d.subido_at).toLocaleString('es-CL')}</p>
                          </div>
                          {sensible && <BotonExtraer documentoId={d.id} />}
                        </div>
                        {sensible && ext?.estado === 'error' && <p className="mt-2 text-xs text-red-400">Extracción fallida: {ext.error}</p>}
                        {sensible && ext?.json_datos && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-gray-400">
                              Datos extraídos por IA · confianza {Math.round(Number(ext.confianza ?? 0) * 100)}%
                              {ext.json_datos.posible_alteracion && <span className="ml-2 text-red-400">posible alteración</span>}
                              {!ext.json_datos.legible && <span className="ml-2 text-amber-400">poco legible</span>}
                            </summary>
                            <table className="mt-2 w-full text-xs">
                              <tbody>
                                {Object.entries(ext.json_datos.campos).map(([k, v]) => (
                                  <tr key={k} className="border-t border-white/5">
                                    <td className="py-1 pr-2 text-gray-500">{k}</td>
                                    <td className="py-1 pr-2 text-gray-200">{v.valor ?? <span className="text-gray-600">null</span>}</td>
                                    <td className={`py-1 pr-2 ${v.confianza < 0.6 ? 'text-amber-400' : 'text-gray-500'}`}>{Math.round(v.confianza * 100)}%</td>
                                    <td className="py-1 text-gray-600">{v.pagina ? `p. ${v.pagina}` : ''} {v.evidencia ? `“${v.evidencia}”` : ''}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {(ext.json_datos.comprobantes ?? []).length > 0 && (
                              <table className="mt-2 w-full text-xs">
                                <thead><tr className="text-gray-500"><th className="text-left">N°</th><th className="text-left">Emisor</th><th className="text-left">Fecha</th><th className="text-left">A nombre de</th><th className="text-right">Monto</th></tr></thead>
                                <tbody>
                                  {ext.json_datos.comprobantes!.map((c, i) => (
                                    <tr key={i} className="border-t border-white/5 text-gray-300">
                                      <td>{c.numero}</td><td>{c.emisor}</td><td>{formatearFecha(c.fecha)}</td><td>{c.a_nombre_de}</td><td className="text-right">{clp(c.monto_clp)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {ext.json_datos.observaciones && <p className="mt-2 text-xs text-gray-400">{ext.json_datos.observaciones}</p>}
                          </details>
                        )}
                      </div>
                    )
                  })}
                </li>
              ))}
            </ul>
          </Tarjeta>

          {sensible && (
            <Tarjeta titulo="Auto-análisis IA y cálculo (art. 26)" acciones={<BotonAnalizar casoId={caso.id} />}>
              {(coberturas.data ?? []).some(c => c.cobertura === 'ipt' || c.cobertura === 'ipp') && (
                <div className="mb-4 space-y-2 rounded-lg border border-white/5 p-3">
                  <p className="text-xs text-gray-400">Grado de incapacidad (médico tratante / COMPIN, arts. 27-28). Si se deja vacío se usa lo extraído del certificado.</p>
                  {(coberturas.data ?? []).filter(c => c.cobertura === 'ipt' || c.cobertura === 'ipp').map(c => (
                    <div key={c.id} className="flex flex-wrap items-center gap-3">
                      <span className="w-40 text-sm text-gray-300">{c.cobertura.toUpperCase()}</span>
                      <GradoIncapacidad casoId={caso.id} cobertura={c.cobertura} valor={c.grado_incapacidad === null ? null : Number(c.grado_incapacidad)} />
                    </div>
                  ))}
                </div>
              )}
              {!a && <p className="text-sm text-gray-500">Aún no se ejecuta el análisis. Suba los antecedentes y ejecute el auto-análisis.</p>}
              {a && calculo && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.03] p-3 text-sm">
                    <span className="text-gray-400">
                      Análisis del {new Date(a.created_at).toLocaleString('es-CL')} · UF {formatearFecha(a.fecha_valor_uf)} = {clp(a.valor_uf_referencia)}
                    </span>
                    {a.estado === 'revisado'
                      ? <Chip color="verde">Revisado por {nombreUsuario(a.revisado_por)}</Chip>
                      : <><Chip color="amarillo">Propuesta sujeta a revisión humana</Chip><BotonRevisado casoId={caso.id} analisisId={a.id} /></>}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Validaciones cruzadas</p>
                    <ul className="grid gap-1 md:grid-cols-2">
                      {(a.json_validaciones as ResultadoValidacion[]).map(v => (
                        <li key={v.codigo} className="text-sm text-gray-300">
                          <span className={v.ok === true ? 'text-emerald-400' : v.ok === false ? 'text-red-400' : 'text-gray-600'}>{v.ok === true ? '✓' : v.ok === false ? '✗' : '–'}</span> {v.mensaje}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Hallazgos titulo="Banderas rojas (no implican fraude; requieren revisión)" items={a.json_banderas_rojas as Hallazgo[]} color="amarillo" />
                  <Hallazgos titulo="Posibles exclusiones (art. 34)" items={a.json_exclusiones as Hallazgo[]} color="rojo" />
                  <Hallazgos titulo="Inconsistencias" items={a.json_inconsistencias as Hallazgo[]} color="amarillo" />

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Indemnización propuesta</p>
                    <div className="space-y-3">
                      {calculo.resultados.map(r => (
                        <div key={r.cobertura} className="rounded-lg border border-white/5 p-3">
                          <div className="flex justify-between">
                            <span className="font-bold text-white">{reglas.coberturas.find(c => c.id === r.cobertura)?.nombre ?? r.cobertura}</span>
                            <span className={r.procede ? 'font-bold text-[#c8902a]' : 'text-red-400'}>{r.procede ? `${uf(r.monto_uf)} · ${clp(r.monto_clp)}` : 'No procede'}</span>
                          </div>
                          <ul className="mt-2 space-y-0.5 text-xs text-gray-400">{r.pasos.map((p, i) => <li key={i}>· {p}</li>)}</ul>
                          {r.advertencias.map((w, i) => <p key={i} className="mt-1 text-xs text-amber-400">! {w}</p>)}
                        </div>
                      ))}
                      <p className="text-right text-lg font-black text-white">Total: {uf(calculo.total_uf)} · {clp(calculo.total_clp)}</p>
                    </div>
                  </div>

                  {calculo.beneficiarios && (
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Beneficiarios (art. 31)</p>
                      <p className="text-sm text-gray-300">
                        {calculo.beneficiarios.nombre_clase ?? 'Sin clase acreditada'}: {calculo.beneficiarios.beneficiarios.map(b => `${b.nombre} (${(b.cuota * 100).toFixed(1)}%)`).join(', ') || '—'}
                      </p>
                      {calculo.beneficiarios.advertencias.map((w, i) => <p key={i} className="text-xs text-amber-400">! {w}</p>)}
                    </div>
                  )}

                  {ia?.error && <p className="text-sm text-amber-400">Análisis IA no disponible: {ia.error}</p>}
                  {ia?.resumen_ejecutivo && (
                    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-sky-300">Resumen IA (propuesta)</p>
                      <p className="whitespace-pre-line text-sm text-gray-200">{ia.resumen_ejecutivo}</p>
                      {!!ia.observaciones?.length && <ul className="mt-3 space-y-1 text-sm text-gray-300">{ia.observaciones.map((o, i) => <li key={i}><Chip>{o.tipo}</Chip> {o.mensaje}</li>)}</ul>}
                      {!!ia.recomendaciones?.length && <><p className="mt-3 text-xs text-gray-500">Recomendaciones</p><ul className="list-disc pl-5 text-sm text-gray-300">{ia.recomendaciones.map((r, i) => <li key={i}>{r}</li>)}</ul></>}
                      {!!ia.antecedentes_sugeridos?.length && <><p className="mt-3 text-xs text-gray-500">Antecedentes sugeridos</p><ul className="list-disc pl-5 text-sm text-gray-300">{ia.antecedentes_sugeridos.map((r, i) => <li key={i}>{r}</li>)}</ul></>}
                    </div>
                  )}
                </div>
              )}
            </Tarjeta>
          )}

          {sensible && (
            <Tarjeta titulo="Informes y finiquito">
              <NuevoInforme casoId={caso.id} />
              <ul className="mt-4 divide-y divide-white/5">
                {(informes.data ?? []).map(inf => (
                  <li key={inf.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm text-white">{inf.tipo.replace('_', ' ')} · {uf(inf.monto_uf)} · {clp(inf.monto_clp)}</p>
                        <p className="text-xs text-gray-500">
                          Redactó {nombreUsuario(inf.redactado_por)} · {new Date(inf.created_at).toLocaleString('es-CL')} · UF {formatearFecha(inf.fecha_valor_uf)} = {clp(inf.valor_uf)}
                          {inf.pdf_hash_sha256 && <> · <span className="font-mono">SHA-256 {inf.pdf_hash_sha256.slice(0, 12)}…</span></>}
                        </p>
                        {(inf.json_contenido as { observacion_supervisor?: string })?.observacion_supervisor && (
                          <p className="text-xs text-amber-400">Devuelto: {(inf.json_contenido as { observacion_supervisor?: string }).observacion_supervisor}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip color={ESTADO_INFORME[inf.estado]}>{inf.estado.replace('_', ' ')}</Chip>
                        <a className="text-sm text-sky-300 hover:underline" href={`/api/siniestros/informes/${inf.id}/pdf`} target="_blank" rel="noopener">
                          {inf.estado === 'emitido' ? 'PDF' : 'Previsualizar'}
                        </a>
                      </div>
                    </div>
                    {usuario.rol === 'supervisor' && inf.estado === 'pendiente_aprobacion' && (
                      <div className="mt-2">
                        {inf.redactado_por === usuario.id
                          ? <p className="text-xs text-gray-500">Debe aprobarlo otro supervisor (cuatro ojos).</p>
                          : <AprobarInforme informeId={inf.id} />}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>

        <div className="space-y-6">
          <Tarjeta titulo="Plazos legales">
            <ul className="space-y-3">
              {(plazos.data ?? []).map(p => {
                const e = estadoPlazo(p, hoy)
                return (
                  <li key={p.id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-white">{p.nombre}</p>
                      <ChipPlazo estado={e.estado} dias={e.dias_restantes} />
                    </div>
                    <p className="text-xs text-gray-500">
                      Vence {formatearFecha(p.fecha_limite)} ({p.computo}) · {p.fundamento}
                      {p.cumplido_el && ` · cumplido ${formatearFecha(p.cumplido_el)}`}
                    </p>
                  </li>
                )
              })}
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Personas" acciones={<AgregarPersona casoId={caso.id} />}>
            <ul className="space-y-2">
              {(personas.data ?? []).map(p => (
                <li key={p.id} className="text-sm">
                  <p className="text-white">{p.nombre}</p>
                  <p className="text-xs text-gray-500">
                    {p.rol}{p.parentesco ? ` · ${p.parentesco.replace(/_/g, ' ')}` : ''}{p.rut ? ` · ${formatearRut(p.rut)}` : ''}
                    {p.fecha_nacimiento ? ` · nac. ${formatearFecha(p.fecha_nacimiento)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Gestión del caso">
            <EditorCaso
              casoId={caso.id}
              datos={{
                estado: caso.estado,
                fecha_comunicacion_tipo_liquidacion: caso.fecha_comunicacion_tipo_liquidacion,
                fecha_antecedentes_completos: caso.fecha_antecedentes_completos,
                fecha_certificado_incapacidad: caso.fecha_certificado_incapacidad,
                fecha_impugnacion: caso.fecha_impugnacion,
                fecha_pago: caso.fecha_pago,
                exclusion_confirmada: caso.exclusion_confirmada,
                prorroga_liquidacion: caso.prorroga_liquidacion,
                prorroga_fundamento: caso.prorroga_fundamento,
                liquidador_id: caso.liquidador_id,
              }}
              exclusiones={reglas.exclusiones ?? []}
              estados={ESTADOS_CASO}
              esSupervisor={usuario.rol === 'supervisor'}
              liquidadores={(usuarios.data ?? []).filter(u => u.rol === 'liquidador')}
            />
          </Tarjeta>
        </div>
      </div>
    </div>
  )
}
