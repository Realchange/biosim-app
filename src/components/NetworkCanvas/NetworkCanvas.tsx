import { useRef, useState } from 'react'
import { useNetworkStore } from '../../store/networkStore'
import { NeuronSVG } from '../NeuronSVG/NeuronSVG'
import { ElectrodePin, ELECTRODE_OFFSETS } from '../Electrode/Electrode'
import { SynapseArrow } from './SynapseArrow'
import { COMPARTMENT_COLORS } from '../../types'
import type { Compartment } from '../../types'
import styles from './NetworkCanvas.module.css'

export function NetworkCanvas() {
  const { neurons, synapses, mode, selectedId, electrodes,
          addNeuron, moveNeuron, setSelected, addSynapse, removeSynapse,
          removeNeuron, addElectrode, removeElectrode } = useNetworkStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)

  const svgPoint = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleDblClick = (e: React.MouseEvent) => {
    if (mode !== 'editor') return
    const pos = svgPoint(e)
    addNeuron(pos, 'lif')
  }

  const handleNeuronClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (connectingFrom && connectingFrom !== id) {
      addSynapse(connectingFrom, id)
      setConnectingFrom(null)
      return
    }
    if (e.shiftKey && mode === 'editor') {
      setConnectingFrom(id)
      return
    }
    setSelected(id)
  }

  const handleCompartmentClick = (neuronId: string, compartment: Compartment) => {
    const exists = electrodes.some(el => el.neuronId === neuronId && el.compartment === compartment)
    if (exists) removeElectrode(neuronId, compartment)
    else addElectrode(neuronId, compartment)
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
         onDoubleClick={handleDblClick}
         onClick={() => { setSelected(null); setConnectingFrom(null) }}
         onMouseMove={e => { if (dragging) moveNeuron(dragging, svgPoint(e)) }}
         onMouseUp={() => setDragging(null)}>

      <defs>
        <marker id="arrow-excitatory" markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#3fb950" />
        </marker>
        <marker id="arrow-inhibitory" markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#f85149" />
        </marker>
      </defs>

      {connectingFrom && (
        <text x={10} y={20} fill="#d29922" fontSize={12}>
          Ziel-Neuron klicken um Synapse zu verbinden
        </text>
      )}

      {synapses.map(s => (
        <SynapseArrow key={s.id} synapse={s} neurons={neurons}
          selected={s.id === selectedId}
          onClick={() => { setSelected(s.id) }} />
      ))}

      {neurons.map(neuron => {
        const neuronElectrodes = electrodes.filter(e => e.neuronId === neuron.id)
        const highlightCompartment = neuronElectrodes.length === 1
          ? neuronElectrodes[0].compartment : null
        return (
          <g key={neuron.id}
             transform={`translate(${neuron.position.x},${neuron.position.y})`}
             onClick={e => handleNeuronClick(neuron.id, e)}
             onMouseDown={e => { if (!e.shiftKey) setDragging(neuron.id) }}>
            <NeuronSVG
              neuron={neuron}
              selected={neuron.id === selectedId}
              highlightCompartment={highlightCompartment}
              onClick={(c) => handleCompartmentClick(neuron.id, c)} />
            {neuronElectrodes.map(el => {
              const offset = ELECTRODE_OFFSETS[el.compartment]
              return (
                <ElectrodePin key={el.compartment}
                  x={offset.x} y={offset.y}
                  color={COMPARTMENT_COLORS[el.compartment]}
                  onRemove={() => removeElectrode(neuron.id, el.compartment)} />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
