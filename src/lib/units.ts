// Unit handling. The model always stores lengths in METERS; these helpers
// convert to/from the user's chosen display unit.

export type Unit = 'mm' | 'm'

/** Format a length (meters) as a string in the given unit, with a suffix. */
export function formatLength(meters: number, unit: Unit): string {
  if (unit === 'mm') return `${Math.round(meters * 1000)} mm`
  return `${meters.toFixed(2)} m`
}

/** Numeric value of a length (meters) expressed in the given unit, for inputs. */
export function lengthValue(meters: number, unit: Unit): number {
  if (unit === 'mm') return Math.round(meters * 1000)
  return Math.round(meters * 1000) / 1000
}

/** Convert a value typed in the given unit back to meters. */
export function toMeters(value: number, unit: Unit): number {
  if (unit === 'mm') return value / 1000
  return value
}

/** Sensible numeric step for inputs in the given unit. */
export function unitStep(unit: Unit): number {
  return unit === 'mm' ? 10 : 0.05
}

/** Area is always shown in m² (mm² is unwieldy for rooms). */
export function formatArea(squareMeters: number): string {
  return `${squareMeters.toFixed(2)} m²`
}
