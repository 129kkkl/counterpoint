import { INTERVALS, type IntervalId } from './score.ts'

export type Snapshot = {
  progress: number
  movement: 0 | 1 | 2 | 3
  writeA: number
  writeB: number
  quality: number
  meanInterval: number
  awakened: boolean
  fermata: boolean
  intervalHold: boolean
  seal: boolean
  refused: boolean
  preferred: IntervalId
  energy: number
  offsetA: number
  offsetB: number
  announce: string
  listening: boolean
}

const initial: Snapshot = {
  progress: 0,
  movement: 0,
  writeA: 0,
  writeB: 0,
  quality: 0.5,
  meanInterval: 5,
  awakened: false,
  fermata: false,
  intervalHold: false,
  seal: false,
  refused: false,
  preferred: 'fifth',
  energy: 0,
  offsetA: 0,
  offsetB: 0,
  announce: '',
  listening: false,
}

let snap: Snapshot = initial
const listeners = new Set<() => void>()

export function getSnapshot(): Snapshot {
  return snap
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function publish(partial: Partial<Snapshot>): void {
  const next = { ...snap, ...partial }
  if (same(snap, next)) return
  snap = next
  listeners.forEach((fn) => fn())
}

export function setPreferred(id: IntervalId): void {
  const item = INTERVALS.find((x) => x.id === id)
  publish({
    preferred: id,
    refused: item ? item.refuse : false,
    announce: item?.refuse ? '同度被拒绝，改走九度。' : `音程改为${item?.label ?? ''}`,
  })
}

function same(a: Snapshot, b: Snapshot): boolean {
  return (
    a.movement === b.movement &&
    a.awakened === b.awakened &&
    a.fermata === b.fermata &&
    a.intervalHold === b.intervalHold &&
    a.seal === b.seal &&
    a.refused === b.refused &&
    a.preferred === b.preferred &&
    a.announce === b.announce &&
    a.listening === b.listening &&
    q(a.progress) === q(b.progress) &&
    q(a.writeA) === q(b.writeA) &&
    q(a.writeB) === q(b.writeB) &&
    q(a.quality) === q(b.quality) &&
    q(a.energy) === q(b.energy) &&
    Math.round(a.offsetA) === Math.round(b.offsetA) &&
    Math.round(a.offsetB) === Math.round(b.offsetB)
  )
}

function q(n: number): number {
  return Math.round(n * 90)
}
