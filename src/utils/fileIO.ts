import { Network } from '../types'

export function serializeNetwork(network: Network): string {
  const clean: Network = {
    ...network,
    neurons: network.neurons.map(n => ({ ...n, compartments: undefined })),
  }
  return JSON.stringify(clean, null, 2)
}

export function deserializeNetwork(json: string): Network {
  let data: unknown
  try { data = JSON.parse(json) } catch { throw new Error('Ungültiges JSON') }
  const net = data as Network
  if (net.version !== 1) throw new Error(`Unbekannte Version: ${(net as Record<string, unknown>).version}`)
  if (!Array.isArray(net.neurons) || !Array.isArray(net.synapses)) {
    throw new Error('Ungültiges Netzwerkformat')
  }
  return net
}

export function downloadNetwork(network: Network, filename?: string) {
  const json = serializeNetwork(network)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = filename ?? `${network.name.replace(/\s+/g, '-')}.biosim.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function uploadNetwork(): Promise<Network> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.biosim.json'

    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      window.removeEventListener('focus', onFocus)
      fn()
    }

    const onFocus = () => {
      // Give the change event time to fire before treating as cancel
      setTimeout(() => {
        settle(() => reject(new Error('Abgebrochen')))
      }, 300)
    }

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return settle(() => reject(new Error('Keine Datei ausgewählt')))
      try {
        const text = await file.text()
        settle(() => resolve(deserializeNetwork(text)))
      } catch (e) { settle(() => reject(e)) }
    }

    window.addEventListener('focus', onFocus)
    input.click()
  })
}
