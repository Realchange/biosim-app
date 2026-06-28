import type { ReactNode } from 'react'

// Small uppercase divider heading that groups parameters into sections
// (e.g. "Reiz" vs "Neuron") in the parameter panel.
export function SectionLabel({ children, first }: { children: ReactNode; first?: boolean }) {
  return (
    <div style={{
      borderTop: first ? 'none' : '1px solid #30363d',
      marginTop: first ? 0 : 12,
      paddingTop: first ? 0 : 9,
      marginBottom: 8,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#768390',
      fontWeight: 700,
    }}>
      {children}
    </div>
  )
}
