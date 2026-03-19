import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ElectrodePin } from './Electrode'

describe('ElectrodePin', () => {
  it('renders at given position', () => {
    const { container } = render(
      <svg><ElectrodePin x={10} y={-20} color="#3fb950" /></svg>
    )
    expect(container.querySelector('g')).toBeTruthy()
  })

  it('calls onRemove when clicked', () => {
    const onRemove = vi.fn()
    const { container } = render(
      <svg><ElectrodePin x={0} y={0} color="#3fb950" onRemove={onRemove} /></svg>
    )
    container.querySelector('g')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onRemove).toHaveBeenCalled()
  })
})
