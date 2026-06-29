import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useNetworkStore } from '../../store/networkStore'

interface Props { children: ReactNode }
interface State { error: Error | null }

// Catches render errors so a crash shows a recovery panel instead of a blank
// (dark) screen with the whole UI gone. Recovery clears the simulation traces —
// the usual culprit on long runs — and stops the run, keeping the network intact.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BioSim crashed:', error, info)
  }

  recover = () => {
    const s = useNetworkStore.getState()
    s.clearTraces()
    s.setSim({ running: false, paused: false, t: 0 })
    s.setActivity({})
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#0d1117', color: '#c9d1d9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}>
          <div style={{
            maxWidth: 460, padding: 24, background: '#161b22',
            border: '1px solid #30363d', borderRadius: 8, textAlign: 'center',
          }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>⚠️</div>
            <h2 style={{ fontSize: 17, margin: '0 0 8px', color: '#f0f6fc' }}>Etwas ist schiefgelaufen</h2>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#8b949e', margin: '0 0 16px' }}>
              Die Darstellung hat einen Fehler ausgelöst. Dein Netzwerk ist noch da — du kannst
              die Simulation zurücksetzen und weiterarbeiten.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={this.recover} style={{
                padding: '8px 16px', background: '#238636', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              }}>Zurücksetzen & weiter</button>
              <button onClick={() => window.location.reload()} style={{
                padding: '8px 16px', background: '#21262d', color: '#c9d1d9',
                border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer', fontSize: 13,
              }}>Seite neu laden</button>
            </div>
            <pre style={{
              marginTop: 14, fontSize: 10, color: '#6e7681', textAlign: 'left',
              whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto',
            }}>{this.state.error.message}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
