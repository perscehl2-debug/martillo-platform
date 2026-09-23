// Placas patentes chilenas: formato antiguo AA·1234 y nuevo BBBB·12 (más motos y remolques).

export function normalizarPatente(p: string | null | undefined): string | null {
  if (!p) return null
  const limpio = p.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // El dígito verificador de la patente a veces se anota como sufijo "-K"/"-3".
  const sinDv = limpio.match(/^([A-Z]{4}\d{2}|[A-Z]{2}\d{4})[0-9K]$/)
  return sinDv ? sinDv[1] : limpio || null
}

export function formatoPatenteValido(p: string | null | undefined): boolean {
  const n = normalizarPatente(p)
  if (!n) return false
  return /^([A-Z]{2}\d{4}|[BCDFGHJKLPRSTVWXYZ]{4}\d{2}|[A-Z]{3}\d{2,3}|[A-Z]{2}\d{3})$/.test(n)
}

export function mismaPatente(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarPatente(a)
  const nb = normalizarPatente(b)
  return !!na && na === nb
}
