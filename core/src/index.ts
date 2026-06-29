// @biosim/core — public API of the headless scientific core.
//
// The browser frontend (@biosim/app) and any external consumer import from this
// entry point only, never from deep paths. This is the library boundary that lets
// the core be installed and run on its own — the property that makes the reported
// numbers reproducible without the frontend.
//
// The Hypothesis Engine (./hypothesis) is intentionally NOT re-exported here: it is
// a Node-only CLI subsystem (SQLite-backed) run through its cli-*.ts entry points,
// not consumed as a library. Add targeted exports later if a UI needs to read it.

// --- Shared domain types and constants (single source shared with the frontend) ---
export type {
  AppMode,
  Compartment,
  StimulusSpec,
  LIFParams,
  STGParams,
  HHParams,
  CompartmentState,
  Neuron,
  Synapse,
  SimulationParams,
  Network,
  Electrode,
} from './types'
export {
  COMPARTMENT_COLORS,
  voltageToColor,
  DEFAULT_LIF_PARAMS,
  DEFAULT_GRADED_PARAMS,
  DEFAULT_STG_PARAMS,
  DEFAULT_HH_PARAMS,
  DEFAULT_SYNAPSE,
} from './types'

// --- Network presets: the pyloric reference network and the teaching examples ---
export { PRESETS } from './presets'
export { actionPotentialPreset } from './presets/action-potential'
export { excitatorySynapsePreset } from './presets/excitatory-synapse'
export { inhibitorySynapsePreset } from './presets/inhibitory-synapse'
export { reflexArcPreset } from './presets/reflex-arc'
export { halfCenterPreset } from './presets/half-center'
export { swimRhythmPreset } from './presets/swim-rhythm'
export { pyloricPreset } from './presets/pyloric'
export { xolotlBurstPreset } from './presets/xolotl-burst'
export { xolotlHcoPreset } from './presets/xolotl-hco'


// --- Deterministic simulation engine (used by the frontend Worker and the sim adapter) ---
export { networkStep, resetSimulationState } from './simulation/network'
export type { NetworkStepResult } from './simulation/network'

// --- Shared stimulus waveform (single source of truth for engine and on-screen plot) ---
export { stimulusCurrent, stimulusPoints } from './utils/stimulus'

// --- Software version (stamped into stored results for reproducibility) ---
export { APP_VERSION } from './version'
