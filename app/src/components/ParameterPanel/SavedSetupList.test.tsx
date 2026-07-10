import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SavedSetupList } from './SavedSetupList'
import { useNetworkStore } from '../../store/networkStore'
import { useI18n } from '../../i18n'
import { pyloricPreset } from '@biosim/core'

beforeEach(() => {
  localStorage.clear()
  useNetworkStore.setState({ ...useNetworkStore.getInitialState(), userSetups: [], currentPresetName: null })
  useI18n.setState({ lang: 'de' })
})

describe('SavedSetupList', () => {
  it('shows the bundled pyloric collapse example under its preset when expanded', () => {
    render(<SavedSetupList onShowInfo={() => {}} />)
    fireEvent.click(screen.getByText('Pylorisches Netzwerk'))
    expect(screen.getByText('Kollabierter Rhythmus (AB/PD stumm)')).toBeInTheDocument()
  })

  it('saves the current state via the save button (prompt)', () => {
    useNetworkStore.getState().loadNetwork(pyloricPreset)
    vi.spyOn(window, 'prompt').mockReturnValue('NeuerZustand')
    render(<SavedSetupList onShowInfo={() => {}} />)
    fireEvent.click(screen.getByText('+ Aktuellen Zustand speichern'))
    expect(useNetworkStore.getState().userSetups.map(s => s.name)).toContain('NeuerZustand')
  })

  it('deletes a user setup after confirmation', () => {
    useNetworkStore.getState().loadNetwork(pyloricPreset)
    const saved = useNetworkStore.getState().saveCurrentSetup('WirdGelöscht')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SavedSetupList onShowInfo={() => {}} />)
    fireEvent.click(screen.getByText('Pylorisches Netzwerk'))
    fireEvent.click(screen.getByTitle('Löschen'))
    expect(useNetworkStore.getState().userSetups.find(s => s.id === saved.id)).toBeUndefined()
  })

  it('opens an explanation of local vs file saving via the ⓘ button, and closes it', () => {
    render(<SavedSetupList onShowInfo={() => {}} />)
    // Not shown until opened.
    expect(screen.queryByText('Lokal speichern (dieser Browser)')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Erklärung: Zustände speichern & weitergeben'))
    expect(screen.getByText('Lokal speichern (dieser Browser)')).toBeInTheDocument()
    expect(screen.getByText('Als Datei speichern (weitergeben)')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Schließen'))
    expect(screen.queryByText('Lokal speichern (dieser Browser)')).not.toBeInTheDocument()
  })
})
