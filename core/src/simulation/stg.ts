// src/simulation/stg.ts
// Prinz, Bucher & Marder (2004) stomatogastric (STG) neuron — single compartment,
// 8 voltage-gated currents (Na, CaT, CaS, A, KCa, Kd, H, leak) + intracellular Ca²⁺.
// Ported from mackelab/pyloric (simulator.pyx). Integrated by exponential Euler.
import type { STGParams } from '../types'

export interface STGState {
  V: number; Ca: number
  mNa: number; hNa: number
  mCaT: number; hCaT: number
  mCaS: number; hCaS: number
  mA: number; hA: number
  mKCa: number; mKd: number; mH: number
}

// Fixed constants (mackelab/pyloric).
const AREA = 0.628e-3      // cm² — scales table conductances (mS/cm²) to mS
const C = 0.6283e-3        // µF (= AREA · 1 µF/cm²)
const ENa = 50, EK = -80, EH = -20, ELeak = -50
const F_CA = 14961         // µM per µA
const CATAU = 200          // ms
const CA_EXT = 3000, CA0 = 0.05
const RTOVERZF = 8.31451e3 * 283 / (2 * 96485.3415)   // ≈ 12.20 mV

const sig  = (V: number, a: number, b: number) => 1 / (1 + Math.exp((V + a) / b))
const sig2 = (V: number, a: number, b: number, c: number, d: number) =>
  1 / (Math.exp((V + a) / b) + Math.exp((V + c) / d))

// Resting initial state (gating at steady state for V₀, Ca at rest).
export function makeSTGState(V0 = -55): STGState {
  return {
    V: V0, Ca: CA0,
    mNa: sig(V0, 25.5, -5.29), hNa: sig(V0, 48.9, 5.18),
    mCaT: sig(V0, 27.1, -7.2), hCaT: sig(V0, 32.1, 5.5),
    mCaS: sig(V0, 33, -8.1), hCaS: sig(V0, 60, 6.2),
    mA: sig(V0, 27.2, -8.7), hA: sig(V0, 56.9, 4.9),
    mKCa: 0, mKd: sig(V0, 12.3, -11.8), mH: sig(V0, 75, 5.5),
  }
}

// One integration step (dt should be ≤ ~0.025 ms for stability). Iext in µA.
// gSyn = total graded-synaptic conductance onto this neuron (mS), gSynE = Σ g·s·E_syn
// (each synapse acts as a conductance pulling V toward its reversal potential).
export function stgStep(s: STGState, p: STGParams, Iext: number, dt: number, gSyn = 0, gSynE = 0): STGState {
  const V = s.V
  const Ca = Math.max(s.Ca, 1e-4)
  const ECa = RTOVERZF * Math.log(CA_EXT / Ca)

  // Steady states & time constants at the present V.
  const mNaInf = sig(V, 25.5, -5.29), hNaInf = sig(V, 48.9, 5.18)
  const tmNa = 2.64 - 2.52 * sig(V, 120, -25)
  const thNa = (1.34 / (1 + Math.exp((V + 62.9) / -10))) * (1.5 + 1 / (1 + Math.exp((V + 34.9) / 3.6)))
  const mCaTInf = sig(V, 27.1, -7.2), hCaTInf = sig(V, 32.1, 5.5)
  const tmCaT = 43.4 - 42.6 * sig(V, 68.1, -20.5), thCaT = 210 - 179.6 * sig(V, 55, -16.9)
  const mCaSInf = sig(V, 33, -8.1), hCaSInf = sig(V, 60, 6.2)
  const tmCaS = 2.8 + 14 * sig2(V, 27, 10, 70, -13), thCaS = 120 + 300 * sig2(V, 55, 9, 65, -16)
  const mAInf = sig(V, 27.2, -8.7), hAInf = sig(V, 56.9, 4.9)
  const tmA = 23.2 - 20.8 * sig(V, 32.9, -15.2), thA = 77.2 - 58.4 * sig(V, 38.9, -26.5)
  const mKCaInf = (Ca / (Ca + 3)) * sig(V, 28.3, -12.6)
  const tmKCa = 180.6 - 150.2 * sig(V, 46, -22.7)
  const mKdInf = sig(V, 12.3, -11.8), tmKd = 14.4 - 12.8 * sig(V, 28.3, -19.2)
  const mHInf = sig(V, 75, 5.5)
  const tmH = 2 / (Math.exp(-14.59 - 0.086 * V) + Math.exp(-1.87 + 0.0701 * V))

  // Advance gating (exponential Euler).
  const ex = (x: number, xinf: number, tau: number) => xinf + (x - xinf) * Math.exp(-dt / tau)
  const mNa = ex(s.mNa, mNaInf, tmNa), hNa = ex(s.hNa, hNaInf, thNa)
  const mCaT = ex(s.mCaT, mCaTInf, tmCaT), hCaT = ex(s.hCaT, hCaTInf, thCaT)
  const mCaS = ex(s.mCaS, mCaSInf, tmCaS), hCaS = ex(s.hCaS, hCaSInf, thCaS)
  const mA = ex(s.mA, mAInf, tmA), hA = ex(s.hA, hAInf, thA)
  const mKCa = ex(s.mKCa, mKCaInf, tmKCa)
  const mKd = ex(s.mKd, mKdInf, tmKd)
  const mH = ex(s.mH, mHInf, tmH)

  // Conductances (mS) from the new gating.
  const cNa = p.gNa * AREA * mNa ** 3 * hNa
  const cCaT = p.gCaT * AREA * mCaT ** 3 * hCaT
  const cCaS = p.gCaS * AREA * mCaS ** 3 * hCaS
  const cA = p.gA * AREA * mA ** 3 * hA
  const cKCa = p.gKCa * AREA * mKCa ** 4
  const cKd = p.gKd * AREA * mKd ** 4
  const cH = p.gH * AREA * mH
  const cLeak = p.gLeak * AREA

  const gTot = cNa + cCaT + cCaS + cA + cKCa + cKd + cH + cLeak + gSyn
  const Vinf_ = cNa * ENa + (cCaT + cCaS) * ECa + cA * EK + cKCa * EK + cKd * EK + cH * EH + cLeak * ELeak + gSynE + Iext
  const Vinf = Vinf_ / gTot
  const Vnew = Vinf + (V - Vinf) * Math.exp(-dt * gTot / C)

  // Ca²⁺ (uses the old V & ECa for the Ca current).
  const ICa = (cCaT + cCaS) * (V - ECa)
  const CaInf = CA0 - F_CA * ICa
  const CaNew = Math.max(1e-4, CaInf + (s.Ca - CaInf) * Math.exp(-dt / CATAU))

  return { V: Vnew, Ca: CaNew, mNa, hNa, mCaT, hCaT, mCaS, hCaS, mA, hA, mKCa, mKd, mH }
}

// --- Graded chemical synapse (Prinz) ------------------------------------------
// Reversal potential (mV) and decay-rate parameter kminus (ms) per transmitter.
export const SYN_GLUT = { E: -70, kminus: 40 }   // glutamatergic
export const SYN_CHOL = { E: -80, kminus: 100 }  // cholinergic

// Steady-state release as a function of presynaptic voltage (Vth = −35, Δ = 5).
export function synActivationInf(preV: number): number {
  return 1 / (1 + Math.exp((-35 - preV) / 5))
}

// Advance the synaptic activation s toward s∞(V_pre). τ_s = kminus·(1 − s∞).
export function stepGradedS(sPrev: number, preV: number, kminus: number, dt: number): number {
  const sInf = synActivationInf(preV)
  const tau = Math.max(1e-3, kminus * (1 - sInf))
  return sInf + (sPrev - sInf) * Math.exp(-dt / tau)
}
