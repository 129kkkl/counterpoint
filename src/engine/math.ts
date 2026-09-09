export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export function smoother(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

export function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function gauss(x: number, mu: number, sigma: number): number {
  const d = (x - mu) / sigma
  return Math.exp(-0.5 * d * d)
}

export function recedeOf(progress: number): number {
  const invent = smoothstep(0.18, 0.4, progress) * (1 - smoothstep(0.46, 0.53, progress))
  const cad = smoothstep(0.72, 0.88, progress)
  return Math.max(invent, cad)
}
