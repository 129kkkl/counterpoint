import { catmull, clamp, lerp, smoother, smoothstep } from './math.ts'

export type Knot = { x: number; d: number }

export const INTERVALS = [
  { id: 'unison', label: '同度', degree: 0, refuse: true },
  { id: 'third', label: '三度', degree: 3, refuse: false },
  { id: 'fourth', label: '四度', degree: 4, refuse: false },
  { id: 'fifth', label: '五度', degree: 5, refuse: false },
  { id: 'tenth', label: '十度', degree: 9, refuse: false },
] as const

export type IntervalId = (typeof INTERVALS)[number]['id']

const PHRASE_A: Knot[][] = [
  [
    { x: 0, d: 0.04 },
    { x: 0.38, d: 0.08 },
    { x: 0.52, d: 1.25 },
    { x: 0.6, d: 0.12 },
    { x: 1, d: 0.06 },
  ],
  [
    { x: 0, d: 0 },
    { x: 0.1, d: 1.15 },
    { x: 0.22, d: 2.45 },
    { x: 0.34, d: 4.05 },
    { x: 0.46, d: 3.15 },
    { x: 0.58, d: 2.1 },
    { x: 0.7, d: 0.7 },
    { x: 0.84, d: -0.35 },
    { x: 1, d: 0.1 },
  ],
  [
    { x: 0, d: 1.8 },
    { x: 0.14, d: 3.4 },
    { x: 0.28, d: 2.2 },
    { x: 0.42, d: 4.6 },
    { x: 0.5, d: 0.2 },
    { x: 0.58, d: 3.8 },
    { x: 0.72, d: 1.1 },
    { x: 0.86, d: 2.6 },
    { x: 1, d: 3.2 },
  ],
  [
    { x: 0, d: 2.4 },
    { x: 0.18, d: 1.1 },
    { x: 0.36, d: 0.45 },
    { x: 0.48, d: 0.08 },
    { x: 0.52, d: -0.06 },
    { x: 0.64, d: 1.8 },
    { x: 0.8, d: 3.1 },
    { x: 1, d: 2.7 },
  ],
  [
    { x: 0, d: 2.2 },
    { x: 0.22, d: 2.55 },
    { x: 0.48, d: 2.15 },
    { x: 0.72, d: 2.85 },
    { x: 1, d: 2.4 },
  ],
]

const PHRASE_B: Knot[][] = [
  [
    { x: 0, d: -1.8 },
    { x: 0.3, d: -1.7 },
    { x: 0.6, d: -2.1 },
    { x: 1, d: -1.85 },
  ],
  [
    { x: 0, d: -2.1 },
    { x: 0.1, d: -3.3 },
    { x: 0.22, d: -4.15 },
    { x: 0.34, d: -2.35 },
    { x: 0.46, d: -1.05 },
    { x: 0.58, d: -2.5 },
    { x: 0.7, d: -3.7 },
    { x: 0.84, d: -2.2 },
    { x: 1, d: -1.6 },
  ],
  [
    { x: 0, d: -3.4 },
    { x: 0.14, d: -1.6 },
    { x: 0.28, d: -3.8 },
    { x: 0.42, d: -0.6 },
    { x: 0.5, d: -3.2 },
    { x: 0.58, d: -0.9 },
    { x: 0.72, d: -2.8 },
    { x: 0.86, d: -4.1 },
    { x: 1, d: -2.4 },
  ],
  [
    { x: 0, d: -2.8 },
    { x: 0.18, d: -1.4 },
    { x: 0.36, d: -0.55 },
    { x: 0.48, d: -0.12 },
    { x: 0.52, d: 0.1 },
    { x: 0.64, d: -2.2 },
    { x: 0.8, d: -3.6 },
    { x: 1, d: -3.2 },
  ],
  [
    { x: 0, d: -3.4 },
    { x: 0.22, d: -3.15 },
    { x: 0.48, d: -3.55 },
    { x: 0.72, d: -2.95 },
    { x: 1, d: -3.35 },
  ],
]

function samplePath(knots: Knot[], x: number): number {
  const n = knots.length
  if (n === 0) return 0
  if (x <= knots[0].x) return knots[0].d
  if (x >= knots[n - 1].x) return knots[n - 1].d
  let i = 0
  while (i < n - 1 && knots[i + 1].x < x) i += 1
  const p0 = knots[Math.max(0, i - 1)]
  const p1 = knots[i]
  const p2 = knots[i + 1]
  const p3 = knots[Math.min(n - 1, i + 2)]
  const span = p2.x - p1.x || 1
  const t = (x - p1.x) / span
  return catmull(p0.d, p1.d, p2.d, p3.d, t)
}

function morph(phrases: Knot[][], progress: number, x: number): number {
  const n = phrases.length - 1
  const f = clamp(progress, 0, 1) * n
  const i = Math.min(n - 1, Math.floor(f))
  const t = smoothstep(0, 1, f - i)
  return lerp(samplePath(phrases[i], x), samplePath(phrases[i + 1], x), t)
}

export function melodyA(progress: number, x: number): number {
  return morph(PHRASE_A, progress, x)
}

export function melodyB(progress: number, x: number): number {
  return morph(PHRASE_B, progress, x)
}

export function previousA(progress: number, x: number): number {
  const n = PHRASE_A.length - 1
  const f = clamp(progress, 0, 1) * n
  const i = Math.min(n - 1, Math.floor(f))
  return samplePath(PHRASE_A[i], x)
}

export function previousB(progress: number, x: number): number {
  const n = PHRASE_B.length - 1
  const f = clamp(progress, 0, 1) * n
  const i = Math.min(n - 1, Math.floor(f))
  return samplePath(PHRASE_B[i], x)
}

export function turnSqueeze(progress: number): number {
  const u = (progress - 0.56) / 0.038
  if (progress < 0.46 || progress > 0.68) return 0
  const envelope = smoothstep(0.46, 0.54, progress) * (1 - smoothstep(0.58, 0.68, progress))
  return envelope * Math.exp(-u * u)
}

export function dissonance(interval: number): number {
  const cons = [0, 3, 4, 5, 7, 8, 9]
  let min = 99
  for (const c of cons) {
    const d = Math.abs(Math.abs(interval) - c)
    if (d < min) min = d
  }
  return clamp(min / 1.6, 0, 1)
}

export function movementOf(progress: number): 0 | 1 | 2 | 3 {
  if (progress < 0.22) return 0
  if (progress < 0.5) return 1
  if (progress < 0.74) return 2
  return 3
}

export function timeToScore(elapsed: number, touched: boolean): number {
  const t = elapsed
  if (t < 0.9) return 0
  if (t < 4.4) return lerp(0, 0.12, smoothstep(0.9, 4.4, t))
  if (t < 5.4) return 0.12
  const bEnter = touched ? 4.6 : 5.4
  if (t < bEnter + 3.2) return lerp(0.12, 0.28, smoothstep(bEnter, bEnter + 3.2, t))
  if (t < 22) return lerp(0.28, 0.42, smoothstep(bEnter + 3.2, 22, t))
  return 0.42
}

export function writeHeads(
  elapsed: number,
  touched: boolean,
  reduced: boolean,
): { a: number; b: number } {
  if (reduced) return { a: 1, b: 1 }
  const a = clamp((elapsed - 0.85) / 3.8, 0, 1)
  const bStart = touched ? 1.55 : 5.15
  const b = clamp((elapsed - bStart) / 3.4, 0, 1)
  return { a: penLift(a), b: penLift(b) }
}

function penLift(t: number): number {
  const x = clamp(t, 0, 1)
  if (x < 0.34) return smoother(0, 0.34, x) * 0.4
  if (x < 0.46) return 0.4
  if (x < 0.78) return 0.4 + smoother(0.46, 0.78, x) * 0.42
  if (x < 0.86) return 0.82
  return 0.82 + smoother(0.86, 1, x) * 0.18
}
