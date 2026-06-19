export function formatSessionCode(seed?: number | null) {
  if (seed === undefined || seed === null) return 'Sesión sin ID'
  return `Sesión ${seed}`
}
