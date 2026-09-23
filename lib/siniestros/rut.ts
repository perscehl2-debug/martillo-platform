// RUT chileno: cuerpo numérico + dígito verificador (módulo 11).

export function limpiarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase()
}

export function calcularDv(cuerpo: string | number): string {
  const digitos = String(cuerpo).split('').reverse()
  let suma = 0
  let factor = 2
  for (const d of digitos) {
    suma += Number(d) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const resto = 11 - (suma % 11)
  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return String(resto)
}

export function validarRut(rut: string | null | undefined): boolean {
  if (!rut) return false
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return false
  const cuerpo = limpio.slice(0, -1)
  const dv = limpio.slice(-1)
  if (!/^\d+$/.test(cuerpo) || Number(cuerpo) < 1000) return false
  return calcularDv(cuerpo) === dv
}

/** 12345678-5 → "12.345.678-5" */
export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut)
  if (limpio.length < 2) return rut
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${cuerpo}-${limpio.slice(-1)}`
}

export function mismoRut(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return limpiarRut(a).replace(/^0+/, '') === limpiarRut(b).replace(/^0+/, '')
}
