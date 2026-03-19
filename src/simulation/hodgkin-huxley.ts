// src/simulation/hodgkin-huxley.ts
import { HHParams, CompartmentState } from '../types'

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

export function hhStep(
  soma: HHCompartmentState,
  params: HHParams,
  I_synaptic: number,   // total synaptic current to soma this step
  dt: number,
  dendrites?: { dend1: HHCompartmentState; dend2: HHCompartmentState; dend3: HHCompartmentState }
): HHAllCompartments {
  const d = dendrites ?? { dend1: { ...DEFAULT_HH_COMPARTMENT }, dend2: { ...DEFAULT_HH_COMPARTMENT }, dend3: { ...DEFAULT_HH_COMPARTMENT } }
  const gc = params.g_core
  // Axial coupling: current flows from soma → dend1 → dend2 → dend3
  const I_soma_to_d1 = gc * (soma.V  - d.dend1.V)
  const I_d1_to_d2   = gc * (d.dend1.V - d.dend2.V)
  const I_d2_to_d3   = gc * (d.dend2.V - d.dend3.V)
  return {
    soma:  stepCompartment(soma,    params, params.I_stim + I_synaptic - I_soma_to_d1, dt),
    dend1: stepCompartment(d.dend1, params, I_soma_to_d1 - I_d1_to_d2,                dt),
    dend2: stepCompartment(d.dend2, params, I_d1_to_d2   - I_d2_to_d3,                dt),
    dend3: stepCompartment(d.dend3, params, I_d2_to_d3,                                dt),
  }
}
