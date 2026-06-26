// Fixed physiological voltage window (mV): shows resting potential, AHP trough
// and a full action-potential overshoot. Used as the default, stable Y-axis so
// sub-threshold responses look small. Users rescale on demand in the detail view.
export const FIXED_V_RANGE: [number, number] = [-90, 50]

// Auto-scale a set of voltage samples to a [min, max] window for plotting.
// Enforces a minimum span so a tiny sub-threshold response (a few mV) is NOT
// magnified to fill the whole graph — it should read as small, the way a real
// EPSP looks small next to a full action potential.
export function autoScaleVoltage(values: number[], minSpan = 40): [number, number] {
  if (!values.length) return [-90, 60]
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = Math.max((hi - lo) * 0.10, 5)
  lo -= pad
  hi += pad
  if (hi - lo < minSpan) {
    const mid = (lo + hi) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  return [lo, hi]
}
