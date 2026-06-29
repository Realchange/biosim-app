import type { Compartment } from '@biosim/core'

// Inverted-thermometer geometry, in local coords (origin = neuron position).
// Soma "bulb" (circle) on top, vertical rod below split into three dendrite
// segments (dend1 top → dend3 bottom). Single source of truth for the neuron
// shape, its electrodes, and synapse endpoints.
export const SOMA_CY = -44
export const SOMA_R = 19
export const ROD_X = -11
export const ROD_W = 22
export const ROD_TOP = -24
export const ROD_H = 80
export const ROD_RX = 11
export const SEG_H = ROD_H / 3

export const DEND_SEGMENTS = [
  { id: 'dend1' as const, y: ROD_TOP },
  { id: 'dend2' as const, y: ROD_TOP + SEG_H },
  { id: 'dend3' as const, y: ROD_TOP + 2 * SEG_H },
]

// Centre point of each compartment — where a synapse terminal dot is anchored.
export const COMPARTMENT_CENTERS: Record<Compartment, { x: number; y: number }> = {
  soma:  { x: 0, y: SOMA_CY },
  dend1: { x: 0, y: ROD_TOP + SEG_H * 0.5 },
  dend2: { x: 0, y: ROD_TOP + SEG_H * 1.5 },
  dend3: { x: 0, y: ROD_TOP + SEG_H * 2.5 },
}
