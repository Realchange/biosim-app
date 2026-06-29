// src/simulation/hodgkin-huxley.ts
import type { HHParams, CompartmentState } from '../types'

export interface HHCompartmentState extends CompartmentState {
  V: number; m: number; h: number; n: number; q: number
}

export interface HHAllCompartments {
  soma: HHCompartmentState
  dend1: HHCompartmentState
  dend2: HHCompartmentState
  dend3: HHCompartmentState
}

export const DEFAULT_HH_COMPARTMENT: HHCompartmentState = {
  V: -65, m: 0.05, h: 0.6, n: 0.32, q: 0.0,
}

// Hodgkin-Huxley alpha/beta rate functions (classic squid axon)
function alphaN(V: number) { return 0.01 * (V + 55) / (1 - Math.exp(-(V + 55) / 10) || 1e-7) }
function betaN(V: number)  { return 0.125 * Math.exp(-(V + 65) / 80) }
function alphaM(V: number) { return 0.1 * (V + 40) / (1 - Math.exp(-(V + 40) / 10) || 1e-7) }
function betaM(V: number)  { return 4 * Math.exp(-(V + 65) / 18) }
function alphaH(V: number) { return 0.07 * Math.exp(-(V + 65) / 20) }
function betaH(V: number)  { return 1 / (1 + Math.exp(-(V + 35) / 10)) }
function alphaQ(V: number) { return 0.055 * (V + 27) / (1 - Math.exp(-(V + 27) / 3.8) || 1e-7) }
function betaQ(V: number)  { return 0.94 * Math.exp(-(V + 75) / 17) }

// Passive dendrites rest near the somatic resting potential. The HH leak
// reversal (E_leak ≈ -54 mV) is NOT the resting potential, so a purely passive
// compartment uses this dedicated reversal to sit at a realistic ~-65 mV.
const DEND_E_LEAK = -65
// Passive dendrites have a higher membrane resistance (lower leak) than the soma,
// so injected current is preserved as it spreads toward the spike-generating soma
// instead of bleeding away locally. Lowering this reduces dendritic input damping.
const DEND_LEAK_SCALE = 0.35

// Active compartment: full Hodgkin-Huxley Na⁺/K⁺/Ca²⁺ + leak (soma / spike zone).
function stepCompartment(
  c: HHCompartmentState,
  p: HHParams,
  I_ext: number,  // external current (stimulus or synaptic)
  dt: number
): HHCompartmentState {
  const { E_Na, E_K, E_Ca, E_leak, g_Na, g_K, g_Ca, g_leak, C_m } = p
  const I_Na   = g_Na  * c.m ** 3 * c.h * (c.V - E_Na)
  const I_K    = g_K   * c.n ** 4       * (c.V - E_K)
  const I_Ca   = g_Ca  * c.q ** 2       * (c.V - E_Ca)
  const I_leak = g_leak                 * (c.V - E_leak)
  const dV = (I_ext - I_Na - I_K - I_Ca - I_leak) / C_m
  const dm = alphaM(c.V) * (1 - c.m) - betaM(c.V) * c.m
  const dh = alphaH(c.V) * (1 - c.h) - betaH(c.V) * c.h
  const dn = alphaN(c.V) * (1 - c.n) - betaN(c.V) * c.n
  const dq = alphaQ(c.V) * (1 - c.q) - betaQ(c.V) * c.q
  return {
    V: c.V + dV * dt,
    m: Math.max(0, Math.min(1, c.m + dm * dt)),
    h: Math.max(0, Math.min(1, c.h + dh * dt)),
    n: Math.max(0, Math.min(1, c.n + dn * dt)),
    q: Math.max(0, Math.min(1, c.q + dq * dt)),
  }
}

// Passive compartment: leak only (dendrites). No voltage-gated channels, so it
// cannot generate its own action potential — it just integrates and decays.
function stepPassiveCompartment(
  c: HHCompartmentState,
  p: HHParams,
  I_ext: number,
  dt: number
): HHCompartmentState {
  const I_leak = p.g_leak * DEND_LEAK_SCALE * (c.V - DEND_E_LEAK)
  const dV = (I_ext - I_leak) / p.C_m
  return { ...c, V: c.V + dV * dt }
}

export function hhStep(
  soma: HHCompartmentState,
  params: HHParams,
  I_synaptic: number,   // synaptic current to soma this step
  dt: number,
  dendrites?: { dend1: HHCompartmentState; dend2: HHCompartmentState; dend3: HHCompartmentState },
  I_syn_dend?: { dend1: number; dend2: number; dend3: number }  // per-dendrite synaptic currents
): HHAllCompartments {
  const d = dendrites ?? { dend1: { ...DEFAULT_HH_COMPARTMENT }, dend2: { ...DEFAULT_HH_COMPARTMENT }, dend3: { ...DEFAULT_HH_COMPARTMENT } }
  const sd = I_syn_dend ?? { dend1: 0, dend2: 0, dend3: 0 }
  const gc = params.g_core
  // Axial coupling: current flows from soma → dend1 → dend2 → dend3
  const I_soma_to_d1 = gc * (soma.V  - d.dend1.V)
  const I_d1_to_d2   = gc * (d.dend1.V - d.dend2.V)
  const I_d2_to_d3   = gc * (d.dend2.V - d.dend3.V)
  return {
    // Soma is the active, spike-generating zone; the three dendrites are passive.
    soma:  stepCompartment(soma,           params, params.I_stim + I_synaptic - I_soma_to_d1, dt),
    dend1: stepPassiveCompartment(d.dend1, params, I_soma_to_d1 - I_d1_to_d2 + sd.dend1,    dt),
    dend2: stepPassiveCompartment(d.dend2, params, I_d1_to_d2   - I_d2_to_d3 + sd.dend2,    dt),
    dend3: stepPassiveCompartment(d.dend3, params, I_d2_to_d3                + sd.dend3,     dt),
  }
}
