import type { Network } from '../types'
import { actionPotentialPreset }   from './action-potential'
import { excitatorySynapsePreset } from './excitatory-synapse'
import { inhibitorySynapsePreset } from './inhibitory-synapse'
import { reflexArcPreset }         from './reflex-arc'
import { swimRhythmPreset }        from './swim-rhythm'

export const PRESETS: { name: string; network: Network }[] = [
  { name: 'Aktionspotential',       network: actionPotentialPreset },
  { name: 'Exzitatorische Synapse', network: excitatorySynapsePreset },
  { name: 'Inhibitorische Synapse', network: inhibitorySynapsePreset },
  { name: 'Reflexbogen',            network: reflexArcPreset },
  { name: 'Schwimmrhythmus',        network: swimRhythmPreset },
]
