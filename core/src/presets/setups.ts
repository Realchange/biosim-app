import type { Network, SavedSetup } from '../types'
import { APP_VERSION } from '../version'
import { pyloricPreset } from './pyloric'

// Pyloric rhythm collapsed by silencing the AB/PD pacemaker: abpd.gNa reduced by 10^-3
// (the abpd.gNa −3.0 log10 manipulation from the collapse work). AB/PD goes silent while
// LP/PY lose their drive — the triphasic rhythm as a whole is lost.
function pyloricCollapsed(): Network {
  const net = structuredClone(pyloricPreset) as Network
  const abpd = net.neurons.find(n => n.id === 'abpd')!
  ;(abpd.params as { gNa: number }).gNa *= 1e-3
  net.name = 'Pylorisches Netzwerk – Kollaps'
  return net
}

/** Read-only example setups shipped with the app (present on a fresh install). */
export const BUNDLED_SETUPS: SavedSetup[] = [
  {
    id: 'bundled:pyloric-collapsed',
    name: 'Kollabierter Rhythmus (AB/PD stumm)',
    presetName: 'Pylorisches Netzwerk',
    network: pyloricCollapsed(),
    source: 'bundled',
    createdAt: '2026-07-10T00:00:00.000Z',
    appVersion: APP_VERSION,
  },
]
