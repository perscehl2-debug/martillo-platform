// Construcción del contenido (instantánea) de informes y finiquitos a partir
// del caso y del último análisis revisado.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { repartirPago } from './analisis'
import type { ResultadoPrelacion } from './beneficiarios'
import type { ResultadoCalculo } from './calculo'
import type { ContenidoInforme, TipoInforme } from './pdf/informe'
import { resolverRegimen } from './reglas'
import { ErrorHttp, reglasDelCaso, type CasoDb, type UsuarioSiniestros } from './servidor'
import type { Persona } from './tipos'

export async function construirContenido(
  db: SupabaseClient,
  casoId: string,
  tipo: TipoInforme,
  redactor: UsuarioSiniestros,
  conclusion: string | null,
): Promise<ContenidoInforme> {
  const { data: caso } = await db.from('casos_siniestro').select('*').eq('id', casoId).maybeSingle<CasoDb>()
  if (!caso) throw new ErrorHttp(404, 'Caso no encontrado')
  const reglas = await reglasDelCaso(db, caso)
  const regimen = resolverRegimen(reglas, caso.poliza_fecha_contratacion)

  const { data: analisis } = await db
    .from('analisis_caso')
    .select('*')
    .eq('caso_id', casoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!analisis) throw new ErrorHttp(409, 'El caso no tiene análisis; ejecute el auto-análisis primero')
  if (analisis.estado !== 'revisado') {
    throw new ErrorHttp(409, 'El último análisis debe ser revisado por el liquidador antes de emitir un informe')
  }

  if (tipo === 'finiquito') {
    const { data: informe } = await db
      .from('informes')
      .select('id')
      .eq('caso_id', casoId)
      .eq('tipo', 'informe_liquidacion')
      .eq('estado', 'emitido')
      .limit(1)
      .maybeSingle()
    if (!informe) throw new ErrorHttp(409, 'El finiquito requiere un informe de liquidación emitido')
  }

  const { data: personas } = await db.from('personas').select('*').eq('caso_id', casoId)
  const calc = analisis.json_calculo as { resultados: ResultadoCalculo[]; beneficiarios: ResultadoPrelacion | null; total_uf: number; total_clp: number }
  const nombreCob = (id: string) => reglas.coberturas.find(c => c.id === id)?.nombre ?? id
  const victima = (personas ?? []).find(p => p.rol === 'victima') as Persona | undefined

  return {
    tipo,
    caso: {
      numero: caso.numero,
      producto: reglas.producto,
      producto_nombre: reglas.nombre,
      variante: caso.variante,
      regimen: regimen.id,
      regimen_nombre: regimen.nombre ?? null,
      version_reglas: reglas.version_reglas,
      poliza_numero: caso.poliza_numero,
      poliza_fecha_contratacion: caso.poliza_fecha_contratacion,
      patente: caso.patente,
      fecha_accidente: caso.fecha_accidente,
      fecha_denuncio: caso.fecha_denuncio,
      lugar_accidente: caso.lugar_accidente,
      relato: caso.relato,
      tipo_liquidacion: caso.tipo_liquidacion,
    },
    personas: (personas ?? []).map(p => ({ rol: p.rol, nombre: p.nombre, rut: p.rut, parentesco: p.parentesco })),
    beneficiarios: repartirPago(calc.resultados, calc.beneficiarios, victima),
    coberturas: calc.resultados.map(r => ({ ...r, nombre: nombreCob(r.cobertura), monto_uf_aprobado: r.monto_uf })),
    total_uf: calc.total_uf,
    total_clp: calc.total_clp,
    valor_uf: { fecha: analisis.fecha_valor_uf, valor: Number(analisis.valor_uf_referencia) },
    validaciones: analisis.json_validaciones ?? [],
    observaciones: [
      ...((analisis.json_inconsistencias ?? []) as { mensaje: string; severidad: string }[]).filter(i => i.severidad !== 'info').map(i => i.mensaje),
      ...((analisis.json_exclusiones ?? []) as { mensaje: string }[]).map(i => i.mensaje),
    ],
    resumen: analisis.resumen,
    conclusion,
    redactado_por: { id: redactor.id, nombre: redactor.nombre },
    aprobado_por: null,
    generado_at: new Date().toISOString(),
  }
}
