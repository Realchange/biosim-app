// Build the injected-stimulus current as a step waveform over [tStart, tEnd].
// Returns corner points [t, I] suitable for an SVG polyline:
//   0 before stimOnset, I_stim during the pulse window, 0 after.
// stimDuration absent or 0 => sustained current (on from stimOnset to tEnd).
export function stimulusPoints(
  params: { I_stim: number; stimOnset?: number; stimDuration?: number },
  tStart: number,
  tEnd: number,
): [number, number][] {
  const amp = params.I_stim
  const onset = params.stimOnset ?? 0
  const dur = params.stimDuration ?? 0
  const offT = dur > 0 ? onset + dur : Infinity

  const level = (t: number) => (t >= onset && t < offT ? amp : 0)
  const pts: [number, number][] = [[tStart, level(tStart)]]

  // Rising edge at onset
  if (onset > tStart && onset < tEnd) {
    pts.push([onset, 0], [onset, amp])
  }
  // Falling edge at offT
  if (offT > tStart && offT < tEnd) {
    pts.push([offT, amp], [offT, 0])
  }

  pts.push([tEnd, level(tEnd)])
  return pts
}
