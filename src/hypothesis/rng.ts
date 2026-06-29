// src/hypothesis/rng.ts
// Seedable RNG (mulberry32) + Gaussian + random unit vectors, for reproducible sampling.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gaussian(rng: () => number): number {
  const u = Math.max(1e-12, rng())
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** A uniformly random unit vector of dimension n (direction is isotropic; seeded via rng). */
export function randomUnitVector(n: number, rng: () => number): number[] {
  const x = Array.from({ length: n }, () => gaussian(rng))
  const norm = Math.hypot(...x) || 1
  return x.map((v) => v / norm)
}
