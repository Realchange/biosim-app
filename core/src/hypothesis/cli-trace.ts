/**
 * cli-trace.ts — dump voltage traces V(t) for AB/PD, LP, PY at the reference
 * rhythm (pyloricPreset), so the paper can show the simulated triphasic
 * pattern from real, deterministic data.
 *
 * Run from the repo:
 *     cd core && npx tsx src/hypothesis/cli-trace.ts
 *
 * Writes:  core/results/trace-reference.json
 *
 * Uses the real core API discovered from src/index.ts and src/simulation/network.ts:
 *   - pyloricPreset            : the reference three-cell network
 *   - resetSimulationState()   : clears all integrator state
 *   - networkStep(neurons, synapses, dt) -> { voltages, updatedNeurons, ... }
 *
 * networkStep is stateful and returns updated neurons each step; we feed those
 * back in so graded synapses see the correct presynaptic soma voltage.
 * Nothing here mutates the engine — it only drives it, consistent with the
 * "deterministic layer is sacred" rule.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  pyloricPreset,
  resetSimulationState,
  networkStep,
  APP_VERSION,
} from '../index';

// ── settings ────────────────────────────────────────────────────────────────
const DT_MS = 0.05;        // integration step (ms) — matches the FIM run
const DURATION_MS = 5000;  // total simulated time (ms): ~4-5 cycles
const SETTLE_MS = 2000;    // discard leading transient before saving
const NOISE_OFF = true;    // deterministic geometry: force per-neuron noise to 0

// deep-clone the preset so we never mutate the exported object
type AnyObj = Record<string, any>;
const preset: AnyObj = JSON.parse(JSON.stringify(pyloricPreset));

// the engine reads presynaptic voltage from neuron.compartments.soma.V; seed it
function seedCompartments(neurons: AnyObj[]): AnyObj[] {
  return neurons.map((n) => {
    const restGuess =
      (n.params && (n.params.E_rest ?? n.params.Eleak)) ?? -55;
    if (NOISE_OFF && n.params && typeof n.params.noise === 'number') {
      n.params = { ...n.params, noise: 0 };
    }
    return {
      ...n,
      compartments: n.compartments ?? {
        soma: { V: restGuess },
        dend1: { V: restGuess },
        dend2: { V: restGuess },
        dend3: { V: restGuess },
      },
    };
  });
}

function main(): void {
  const synapses: AnyObj[] = preset.synapses;
  let neurons: AnyObj[] = seedCompartments(preset.neurons);

  const ids = neurons.map((n) => n.id as string); // ["abpd","lp","py"]
  const nSteps = Math.round(DURATION_MS / DT_MS);
  const settleSteps = Math.round(SETTLE_MS / DT_MS);

  // record voltages per cell after settling
  const tArr: number[] = [];
  const vArr: Record<string, number[]> = {};
  for (const id of ids) vArr[id] = [];

  resetSimulationState();

  for (let i = 0; i < nSteps; i++) {
    const res: AnyObj = networkStep(neurons as any, synapses as any, DT_MS);
    // feed updated neurons back so the next step sees fresh soma voltages
    if (res.neurons) neurons = res.neurons as AnyObj[];

    if (i >= settleSteps) {
      const tMs = (i - settleSteps) * DT_MS; // re-zeroed after settling
      tArr.push(tMs);
      const volts: Record<string, number> = res.voltages ?? {};
      for (const id of ids) vArr[id].push(volts[id]);
    }
  }

  // downsample for a compact JSON (~4000 points is plenty for a smooth plot)
  const targetPoints = 4000;
  const stride = Math.max(1, Math.floor(tArr.length / targetPoints));
  const ds = <T,>(a: T[]) => a.filter((_, i) => i % stride === 0);

  // normalise cell keys to the labels the renderer expects
  const cells: Record<string, number[]> = {
    abpd: ds(vArr['abpd'] ?? []),
    lp: ds(vArr['lp'] ?? []),
    py: ds(vArr['py'] ?? []),
  };

  const out = {
    meta: {
      appVersion: APP_VERSION,
      preset: preset.name ?? 'pyloricPreset',
      dtMs: DT_MS,
      durationMs: DURATION_MS,
      settleMs: SETTLE_MS,
      noiseOff: NOISE_OFF,
      strideAfterSettle: stride,
      note:
        'Reference rhythm voltage traces for the BIOSIM results paper. ' +
        'Deterministic (per-neuron noise forced to 0). Time re-zeroed after settling.',
    },
    t: ds(tArr),
    cells,
  };

  const outDir = path.resolve(process.cwd(), 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'trace-reference.json');
  fs.writeFileSync(outPath, JSON.stringify(out));

  // eslint-disable-next-line no-console
  console.log(
    'Wrote ' + outPath + '\n' +
    '  cells: ' + Object.keys(cells).join(', ') + '\n' +
    '  points/cell: ' + out.t.length + '  (dt=' + DT_MS + ' ms, stride=' + stride + ')\n' +
    '  V ranges (mV): ' +
      ids.map((id) => {
        const a = vArr[id];
        const lo = Math.min(...a).toFixed(1);
        const hi = Math.max(...a).toFixed(1);
        return id + ' [' + lo + ', ' + hi + ']';
      }).join('  ') + '\n' +
    '  appVersion: ' + APP_VERSION
  );
}

main();
