// Checklist dinámico: se genera desde las reglas del producto según las
// coberturas del caso. Un requisito nuevo en el JSON aparece sin tocar código.
import { obtenerCobertura } from './reglas/consultas'
import type { EstadoRequisito, ReglasProducto, RequisitoChecklist } from './tipos'

export function generarChecklist(reglas: ReglasProducto, coberturas: string[]): RequisitoChecklist[] {
  const porDocumento = new Map<string, RequisitoChecklist>()
  for (const id of coberturas) {
    const cob = obtenerCobertura(reglas, id)
    for (const doc of cob.documentos) {
      const catalogo = reglas.catalogo_documentos[doc.id]
      const existente = porDocumento.get(doc.id)
      if (existente) {
        existente.obligatorio ||= doc.obligatorio
        existente.coberturas.push(cob.id)
      } else {
        porDocumento.set(doc.id, {
          documento_id: doc.id,
          nombre: doc.nombre ?? catalogo?.nombre ?? doc.id,
          coberturas: [cob.id],
          obligatorio: doc.obligatorio,
          estado: 'pendiente',
        })
      }
    }
  }
  return Array.from(porDocumento.values()).sort((a, b) => Number(b.obligatorio) - Number(a.obligatorio))
}

export interface ResumenChecklist {
  total: number
  obligatorios: number
  obligatorios_validados: number
  pendientes_obligatorios: string[]
  completo: boolean
}

export function resumirChecklist(requisitos: { nombre: string; obligatorio: boolean; estado: EstadoRequisito }[]): ResumenChecklist {
  const obligatorios = requisitos.filter(r => r.obligatorio)
  const validados = obligatorios.filter(r => r.estado === 'validado')
  const pendientes = obligatorios.filter(r => r.estado !== 'validado').map(r => r.nombre)
  return {
    total: requisitos.length,
    obligatorios: obligatorios.length,
    obligatorios_validados: validados.length,
    pendientes_obligatorios: pendientes,
    completo: pendientes.length === 0,
  }
}
