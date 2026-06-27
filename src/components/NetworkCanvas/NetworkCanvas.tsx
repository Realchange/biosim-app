import { useRef, useState } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import { NeuronSVG } from '../NeuronSVG/NeuronSVG'
import { ElectrodePin, ELECTRODE_OFFSETS } from '../Electrode/Electrode'
import { StimElectrode } from '../Electrode/StimElectrode'
import { SynapseArrow } from './SynapseArrow'
import { COMPARTMENT_COLORS } from '../../types'
import type { Compartment, LIFParams, HHParams } from '../../types'
import { stimulusCurrent } from '../../utils/stimulus'
import styles from './NetworkCanvas.module.css'

// Injection point per compartment (left edge of the thermometer body).
const STIM_OFFSETS: Record<string, { x: number; y: number }> = {
  soma:  { x: -20, y: -44 },
  dend1: { x: -12, y: -11 },
  dend2: { x: -12, y: 16 },
  dend3: { x: -12, y: 43 },
}

// Is the neuron's stimulus injecting current at time t? (pulse or ramp)
function stimActiveAt(p: LIFParams | HHParams, t: number): boolean {
  if ((p.I_stim ?? 0) <= 0) return false
  return stimulusCurrent(p, t) > 0.01
}

export function NetworkCanvas() {
  const { neurons, synapses, mode, selectedId, electrodes, activity, sim, editorTool, editorModel,
          addNeuron, moveNeuron, setSelected, addSynapse, removeSynapse, setEditorTool,
          removeNeuron, addElectrode, removeElectrode } = useNetworkStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)

  const placeTool = editorTool === 'spiking' || editorTool === 'nonspiking' || editorTool === 'afferent'
  const placing = mode === 'editor' && placeTool

  const svgPoint = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // Click on empty canvas: place a neuron of the active tool, else cancel any pending
  // synapse / clear the selection.
  const handleBackgroundClick = (e: React.MouseEvent) => {
    setConnectingFrom(null)
    if (placing) {
      const kind = editorTool === 'afferent' ? 'afferent' : undefined
      const model = editorTool === 'nonspiking' ? 'graded' : editorModel
      addNeuron(svgPoint(e), model, kind)
      // Placing is one-shot: drop back to Sperre so you don't keep adding neurons by accident.
      setEditorTool('select')
      return
    }
    setSelected(null)
  }

  // Click on a neuron compartment — depends on the active tool:
  //  - placement tool → just select (no electrode, no place-on-top)
  //  - synapse tool (or shift in Sperre) → pick source, then target → connect
  //  - Sperre → select + drop a recording electrode on the clicked compartment
  const handleCompartmentClick = (neuronId: string, compartment: Compartment, e: React.MouseEvent) => {
    e.stopPropagation()
    if (placing) { setSelected(neuronId); return }
    const connectMode = editorTool === 'synapse' || (e.shiftKey && mode === 'editor')
    if (connectingFrom && connectingFrom !== neuronId) {
      addSynapse(connectingFrom, neuronId)
      setConnectingFrom(null)
      // Synapse drawing is one-shot: drop back to Sperre; press Synapse again for the next.
      if (editorTool === 'synapse') setEditorTool('select')
      return
    }
    if (connectMode) {
      setConnectingFrom(neuronId)
      setSelected(neuronId)
      return
    }
    setSelected(neuronId)
    const exists = electrodes.some(el => el.neuronId === neuronId && el.compartment === compartment)
    if (!exists) addElectrode(neuronId, compartment)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!selectedId) return
      const isSynapse = synapses.some(s => s.id === selectedId)
      if (isSynapse) removeSynapse(selectedId)
      else { removeNeuron(selectedId) }
      setSelected(null)
    }
  }

  return (
    <svg ref={svgRef} className={styles.canvas}
         tabIndex={0} onKeyDown={handleKeyDown}
         onClick={handleBackgroundClick}
         onMouseMove={e => { if (dragging) moveNeuron(dragging, svgPoint(e)) }}
         onMouseUp={() => setDragging(null)}>

      {connectingFrom && (
        <text x={10} y={20} fill="#d29922" fontSize={12}>
          Ziel-Neuron klicken um Synapse zu verbinden
        </text>
      )}

      {/* Connecting lines — under the neuron bodies */}
      {synapses.map(s => (
        <SynapseArrow key={s.id} layer="line" synapse={s} neurons={neurons}
          selected={s.id === selectedId}
          onClick={() => { setSelected(s.id) }} />
      ))}

      {neurons.map((neuron, i) => {
        const neuronElectrodes = electrodes.filter(e => e.neuronId === neuron.id)
        const highlightCompartment = neuronElectrodes.length === 1
          ? neuronElectrodes[0].compartment : null
        return (
          <g key={neuron.id}
             transform={`translate(${neuron.position.x},${neuron.position.y})`}
             onMouseDown={e => { if (!e.shiftKey) setDragging(neuron.id) }}>
            {/* Label above the soma — role name if set, else the "Neuron N" numbering */}
            <text x={0} y={-68} textAnchor="middle" fill="#8b949e" fontSize={10}
              pointerEvents="none" style={{ userSelect: 'none' }}>
              {neuron.label ?? `Neuron ${i + 1}`}
            </text>
            <NeuronSVG
              neuron={neuron}
              selected={neuron.id === selectedId}
              highlightCompartment={highlightCompartment}
              activity={activity[neuron.id] ?? 0}
              onClick={(c, e) => handleCompartmentClick(neuron.id, c, e)} />
            {neuronElectrodes.map(el => {
              const offset = ELECTRODE_OFFSETS[el.compartment]
              return (
                <ElectrodePin key={el.compartment}
                  x={offset.x} y={offset.y}
                  color={COMPARTMENT_COLORS[el.compartment]}
                  onRemove={() => removeElectrode(neuron.id, el.compartment)} />
              )
            })}
            {/* Stimulation electrode on the compartment that receives I_stim */}
            {(() => {
              const p = neuron.params as LIFParams | HHParams
              if ((p.I_stim ?? 0) <= 0) return null
              const comp = neuron.model === 'hodgkin-huxley'
                ? ((p as HHParams).stimCompartment ?? 'soma')
                : 'soma'
              const o = STIM_OFFSETS[comp]
              return <StimElectrode x={o.x} y={o.y} active={sim.running && stimActiveAt(p, sim.t)} />
            })()}
          </g>
        )
      })}

      {/* Synapse terminal dots — on top of the neuron bodies, at the post-synaptic site */}
      {synapses.map(s => (
        <SynapseArrow key={s.id} layer="dot" synapse={s} neurons={neurons}
          selected={s.id === selectedId}
          onClick={() => { setSelected(s.id) }} />
      ))}
    </svg>
  )
}
