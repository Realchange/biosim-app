import '@testing-library/jest-dom'

// Node v25+ exposes a native `localStorage` global stub that lacks `.clear()` and
// conflicts with jsdom. Replace it with a proper in-memory implementation so tests
// that call `localStorage.clear()` / `setItem()` / `getItem()` work correctly.
const store: Record<string, string> = {}
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string): string | null => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
    setItem: (key: string, value: string): void => { store[key] = String(value) },
    removeItem: (key: string): void => { delete store[key] },
    clear: (): void => { Object.keys(store).forEach(k => delete store[k]) },
    get length(): number { return Object.keys(store).length },
    key: (i: number): string | null => Object.keys(store)[i] ?? null,
  },
  writable: true,
  configurable: true,
})
