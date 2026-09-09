import { IntervalAudio } from './audio.ts'
import { clamp, gauss, hash, lerp, recedeOf } from './math.ts'
import {
  dissonance,
  melodyA,
  melodyB,
  movementOf,
  previousA,
  previousB,
  timeToScore,
  turnSqueeze,
  writeHeads,
  INTERVALS,
} from './score.ts'
import { getSnapshot, publish, setPreferred } from './store.ts'

const INK_A = { r: 34, g: 27, b: 20 }
const INK_B = { r: 22, g: 38, b: 46 }
const SEAL = '#9e3324'
const PAPER = '#e6d7bc'

type Ptr = { id: number; x: number; y: number; sx: number; sy: number; t: number }
type Tick = { x: number; y: number; a: number; l: number; life: number }

export let toggleListening: () => Promise<boolean> = async () => false

export class Engine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private paper: HTMLCanvasElement
  private n = 112
  private xs = new Float32Array(112)
  private yA = new Float32Array(112)
  private yB = new Float32Array(112)
  private dA = new Float32Array(112)
  private dB = new Float32Array(112)
  private vA = new Float32Array(112)
  private vB = new Float32Array(112)
  private w = 1
  private h = 1
  private dpr = 1
  private cy = 0
  private margin = 80
  private staff = 16
  private alive = false
  private raf = 0
  private t0 = 0
  private last = 0
  private elapsed = 0
  private score = 0
  private scrollScore = 0
  private touched = false
  private reduced = false
  private ptr: Ptr | null = null
  private drawing = false
  private still = 0
  private hold = 0
  private plucks: number[] = []
  private seal = false
  private sealX = 0
  private sealY = 0
  private stamped = false
  private squeezed = 0
  private energy = 0
  private ticks: Tick[] = []
  private bow = 0
  private audio = new IntervalAudio()
  private listening = false
  private onResize: () => void
  private onScroll: () => void
  private onKey: (e: KeyboardEvent) => void
  private onMq: () => void
  private mq: MediaQueryList

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
    if (!ctx) throw new Error('canvas')
    this.ctx = ctx
    this.paper = makePaper(256, 256)
    this.mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.reduced = this.mq.matches
    this.onResize = () => this.resize()
    this.onScroll = () => this.readScroll()
    this.onKey = (e) => this.key(e)
    this.onMq = () => {
      this.reduced = this.mq.matches
    }
  }

  start(): void {
    this.alive = true
    this.t0 = performance.now()
    this.last = this.t0
    this.resize()
    this.readScroll()
    window.addEventListener('resize', this.onResize)
    window.addEventListener('scroll', this.onScroll, { passive: true })
    window.addEventListener('keydown', this.onKey)
    this.mq.addEventListener('change', this.onMq)
    this.bindPointer()
    toggleListening = () => this.toggleAudio()
    this.loop(this.t0)
  }

  destroy(): void {
    this.alive = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('keydown', this.onKey)
    this.mq.removeEventListener('change', this.onMq)
    this.unbindPointer()
    this.audio.dispose()
    toggleListening = async () => false
  }

  async toggleAudio(): Promise<boolean> {
    const on = await this.audio.toggle()
    this.listening = on
    publish({ listening: on, announce: on ? '开始听音程。' : '静音。' })
    return on
  }

  private bindPointer(): void {
    const el = this.canvas
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointercancel', this.onUp)
    el.addEventListener('pointerleave', this.onLeave)
  }

  private unbindPointer(): void {
    const el = this.canvas
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointercancel', this.onUp)
    el.removeEventListener('pointerleave', this.onLeave)
  }

  private onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId)
    this.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }
    this.drawing = true
    this.touched = true
    this.still = 0
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.ptr || e.pointerId !== this.ptr.id) {
      this.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() }
      return
    }
    const dy = e.clientY - this.ptr.sy
    const dx = e.clientX - this.ptr.sx
    if (this.drawing && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.6) {
      this.drawing = false
      try {
        this.canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    this.ptr.x = e.clientX
    this.ptr.y = e.clientY
    this.still = 0
  }

  private onUp = (e: PointerEvent): void => {
    if (!this.ptr || e.pointerId !== this.ptr.id) return
    const dt = performance.now() - this.ptr.t
    const dist = Math.hypot(e.clientX - this.ptr.sx, e.clientY - this.ptr.sy)
    if (dt < 220 && dist < 22) this.pluck(e.clientX, e.clientY)
    this.drawing = false
    this.ptr = null
  }

  private onLeave = (): void => {
    if (!this.drawing) this.ptr = null
  }

  private pluck(x: number, y: number): void {
    const now = performance.now()
    this.plucks.push(now)
    this.plucks = this.plucks.filter((t) => now - t < 1100)
    const i = this.nearest(x)
    const dir = y < this.yA[i] ? -1 : 1
    const rad = 7
    for (let k = Math.max(1, i - rad); k <= Math.min(this.n - 2, i + rad); k++) {
      const g = gauss(k, i, 2.4)
      this.vA[k] += dir * 420 * g
      this.vB[k] -= dir * 280 * g
    }
    this.energy = Math.min(1, this.energy + 0.35)
    if (this.plucks.length >= 3 && !this.seal) {
      this.seal = true
      this.sealX = x
      this.sealY = (this.yA[i] + this.yB[i]) * 0.5
    }
  }

  private key(e: KeyboardEvent): void {
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('button, a, input, textarea, [role="radio"]')
    ) {
      return
    }
    if (e.code === 'Space') {
      e.preventDefault()
      this.pluck(this.w * 0.5, this.cy)
      this.touched = true
    }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault()
      const ids = INTERVALS.map((x) => x.id)
      const cur = getSnapshot().preferred
      const i = ids.indexOf(cur)
      const n = e.code === 'ArrowRight' ? i + 1 : i - 1
      const next = ids[(n + ids.length) % ids.length]
      setPreferred(next)
    }
  }

  private nearest(x: number): number {
    const u = clamp((x - this.margin) / Math.max(1, this.w - this.margin * 2), 0, 1)
    return clamp(Math.round(u * (this.n - 1)), 1, this.n - 2)
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect()
    const mobile = window.innerWidth < 720
    this.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
    this.w = r.width
    this.h = r.height
    this.canvas.width = Math.round(r.width * this.dpr)
    this.canvas.height = Math.round(r.height * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.n = mobile ? 80 : 120
    this.xs = new Float32Array(this.n)
    this.yA = new Float32Array(this.n)
    this.yB = new Float32Array(this.n)
    this.dA = new Float32Array(this.n)
    this.dB = new Float32Array(this.n)
    this.vA = new Float32Array(this.n)
    this.vB = new Float32Array(this.n)
    this.margin = mobile ? 28 : Math.max(64, this.w * 0.08)
    this.staff = clamp(this.h * 0.038, 12, 22)
    this.cy = this.h * (mobile ? 0.42 : 0.5)
    this.placeCenter()
    for (let i = 0; i < this.n; i++) {
      this.xs[i] = lerp(this.margin, this.w - this.margin, i / (this.n - 1))
    }
  }

  private readScroll(): void {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    this.scrollScore = clamp(window.scrollY / max, 0, 1)
  }

  private loop = (now: number): void => {
    if (!this.alive) return
    const dt = clamp((now - this.last) / 1000, 0, 0.048)
    this.last = now
    this.elapsed = (now - this.t0) / 1000
    this.step(dt)
    this.draw()
    this.emit()
    this.raf = requestAnimationFrame(this.loop)
  }

  private placeCenter(): void {
    const mobile = this.w < 720
    const recede = recedeOf(this.score)
    this.cy = lerp(this.h * (mobile ? 0.42 : 0.5), this.h * (mobile ? 0.2 : 0.26), recede)
  }

  private stampAt(x: number, y: number): void {
    this.seal = true
    this.sealX = x
    this.sealY = y
    this.stamped = true
    this.ticks = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + hash(i, 4) * 0.4
      this.ticks.push({
        x,
        y,
        a,
        l: 7 + hash(i, 9) * 22,
        life: 1,
      })
    }
  }

  private step(dt: number): void {
    const timeScore = timeToScore(this.elapsed, this.touched)
    this.score = Math.max(this.score, timeScore, this.scrollScore)
    if (this.scrollScore < this.score - 0.02) {
      this.score = lerp(this.score, this.scrollScore, 0.04)
    }
    this.placeCenter()
    const heads = writeHeads(this.elapsed, this.touched, this.reduced)
    const squeeze = turnSqueeze(this.score)
    this.bow = squeeze
    if (this.squeezed < 0.88 && squeeze >= 0.88 && !this.stamped) {
      const i = Math.floor(this.n * 0.5)
      this.vA[i] += 620
      this.vB[i] -= 620
      this.stampAt(this.xs[i], this.cy)
    }
    this.squeezed = squeeze
    for (const t of this.ticks) t.life = Math.max(0, t.life - dt * 0.35)
    const inGap = this.inInterval()

    const preferred = INTERVALS.find((x) => x.id === getSnapshot().preferred)
    const want = preferred?.refuse ? 8.2 : (preferred?.degree ?? 5)
    const refusePull = preferred?.refuse ? 1 : 0

    let sumA = 0
    let sumB = 0
    let qsum = 0
    let isum = 0
    let count = 0

    for (let i = 0; i < this.n; i++) {
      const x = i / (this.n - 1)
      let aDeg = melodyA(this.score, x)
      let bDeg = melodyB(this.score, x)
      const natural = aDeg - bDeg
      const sign = natural >= 0 ? 1 : -1
      bDeg = aDeg - sign * lerp(Math.abs(natural), want, 0.22)
      if (refusePull) bDeg -= 0.35

      aDeg = lerp(aDeg, 0, squeeze * 0.86)
      bDeg = lerp(bDeg, 0, squeeze * 0.86)

      const bowY = Math.sin(x * Math.PI) * squeeze * this.staff * 2.4
      const baseA = this.cy - aDeg * this.staff + bowY
      const baseB = this.cy - bDeg * this.staff + bowY

      if (!this.reduced) {
        const breath = Math.sin(this.elapsed * 0.65 + i * 0.07) * 0.35
        const attract = this.drawing && this.ptr && !inGap ? this.field(i, this.ptr) : 0
        this.vA[i] += attract * 1.55
        this.vB[i] -= attract * 0.88

        const tA = 46
        const tB = 62
        this.vA[i] += (-this.dA[i]) * tA * dt
        this.vB[i] += (-this.dB[i]) * tB * dt

        this.dA[i] += this.vA[i] * dt
        this.dB[i] += this.vB[i] * dt
        this.vA[i] *= Math.pow(0.012, dt)
        this.vB[i] *= Math.pow(0.004, dt)
        this.dA[i] *= 0.999
        this.dB[i] *= 0.999

        this.yA[i] = baseA + this.dA[i] + breath
        this.yB[i] = baseB + this.dB[i] - breath * 0.6
      } else {
        this.dA[i] = 0
        this.dB[i] = 0
        this.yA[i] = baseA
        this.yB[i] = baseB
      }

      sumA += this.yA[i]
      sumB += this.yB[i]
      const iv = (this.yA[i] - this.yB[i]) / this.staff
      isum += iv
      qsum += 1 - dissonance(iv)
      count += 1
    }

    if (!this.reduced) this.smoothString(this.dA, this.vA, 0.18)
    if (!this.reduced) this.smoothString(this.dB, this.vB, 0.24)

    this.energy *= Math.pow(0.22, dt)

    const moving = this.drawing || this.energy > 0.08
    if (moving) this.still = 0
    else this.still += dt

    if (inGap) this.hold += dt
    else this.hold = Math.max(0, this.hold - dt * 1.4)
    this.canvas.style.cursor = inGap ? 'cell' : 'crosshair'

    if (this.listening) {
      const avgA = (this.cy - sumA / count) / this.staff
      const avgB = (this.cy - sumB / count) / this.staff
      this.audio.set(degreeToHz(avgA), degreeToHz(avgB))
    }

    this._heads = heads
    this._meanA = sumA / count
    this._meanB = sumB / count
    this._quality = qsum / count
    this._meanI = isum / count
  }

  private _heads = { a: 0, b: 0 }
  private _meanA = 0
  private _meanB = 0
  private _quality = 0.5
  private _meanI = 5

  private field(i: number, ptr: Ptr): number {
    const sigma = this.n * 0.045
    const ix = this.nearest(ptr.x)
    const g = gauss(i, ix, sigma)
    const target = ptr.y
    const y = this.yA[i]
    return (target - y) * g * 3.4
  }

  private smoothString(d: Float32Array, v: Float32Array, k: number): void {
    for (let i = 1; i < this.n - 1; i++) {
      const lap = d[i - 1] + d[i + 1] - 2 * d[i]
      v[i] += lap * k * 60 * 0.016
    }
  }

  private inInterval(): boolean {
    if (!this.ptr) return false
    const i = this.nearest(this.ptr.x)
    const top = Math.min(this.yA[i], this.yB[i])
    const bot = Math.max(this.yA[i], this.yB[i])
    if (bot - top < 18) return false
    const y = this.ptr.y
    return y > top + 6 && y < bot - 6 && this._heads.a > 0.6 && this._heads.b > 0.4
  }

  private emit(): void {
    const fermata = this.still > 2.4 && this._heads.b > 0.8
    const intervalHold = this.hold > 1.65
    let announce = getSnapshot().announce
    if (intervalHold && !getSnapshot().intervalHold) announce = '我在这里。不在任何一条线上。'
    else if (fermata && !getSnapshot().fermata) announce = '停够久，墨才会干。'
    publish({
      progress: this.score,
      movement: movementOf(this.score),
      writeA: this._heads.a,
      writeB: this._heads.b,
      quality: this._quality,
      meanInterval: this._meanI,
      awakened: this.touched || this._heads.b > 0.05,
      fermata,
      intervalHold,
      seal: this.seal,
      energy: this.energy,
      offsetA: clamp((this._meanA - this.cy) * 0.12, -14, 14),
      offsetB: clamp((this._meanB - this.cy) * 0.12, -14, 14),
      announce,
      listening: this.listening,
    })
  }

  private draw(): void {
    const ctx = this.ctx
    const w = this.w
    const h = this.h
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 0.35
    ctx.drawImage(this.paper, 0, 0, w, h)
    ctx.globalAlpha = 1

    this.drawStaff(ctx)
    this.drawPalimpsest(ctx)
    const na = Math.max(2, Math.floor(this._heads.a * this.n))
    const nb = Math.max(2, Math.floor(this._heads.b * this.n))
    this.drawMembrane(ctx, Math.min(na, nb))
    this.drawInterval(ctx)
    this.drawPlayhead(ctx)
    if (this._heads.a > 0.01) {
      this.drawVoice(ctx, this.yA, na, INK_A, 1.7, 0.28, true)
    }
    if (this._heads.b > 0.01) {
      this.drawVoice(ctx, this.yB, nb, INK_B, 1.05, 0.12, false)
    }
    this.drawNibs(ctx, na, nb)
    this.drawTicks(ctx)
    if (this.seal) this.drawSeal(ctx)
    this.drawHoldMark(ctx)
    this.drawCrop(ctx)
  }

  private drawStaff(ctx: CanvasRenderingContext2D): void {
    const lines = [-2, -1, 0, 1, 2]
    ctx.beginPath()
    const segs = 24
    for (const k of lines) {
      for (let s = 0; s <= segs; s++) {
        const t = s / segs
        const x = lerp(this.margin, this.w - this.margin, t)
        const bowY = Math.sin(t * Math.PI) * this.bow * this.staff * 2.4
        const y = this.cy + k * this.staff * 1.15 + bowY
        if (s === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
    }
    ctx.strokeStyle = 'rgba(34,27,20,0.13)'
    ctx.lineWidth = 0.7
    ctx.stroke()

    ctx.beginPath()
    const bx = this.margin - 10
    const y0 = this.cy - this.staff * 2.4
    const y1 = this.cy + this.staff * 2.4
    ctx.moveTo(bx + 8, y0)
    ctx.bezierCurveTo(bx - 6, y0 + 8, bx - 6, y1 - 8, bx + 8, y1)
    ctx.strokeStyle = 'rgba(34,27,20,0.45)'
    ctx.lineWidth = 1.1
    ctx.stroke()
  }

  private drawPalimpsest(ctx: CanvasRenderingContext2D): void {
    if (this.score < 0.18) return
    ctx.beginPath()
    for (let i = 0; i < this.n; i++) {
      const x = this.xs[i]
      const u = i / (this.n - 1)
      const y = this.cy - previousA(this.score, u) * this.staff
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(34,27,20,0.055)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    for (let i = 0; i < this.n; i++) {
      const x = this.xs[i]
      const u = i / (this.n - 1)
      const y = this.cy - previousB(this.score, u) * this.staff
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = 'rgba(22,38,46,0.05)'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }

  private drawInterval(ctx: CanvasRenderingContext2D): void {
    const n = Math.min(
      this.n,
      Math.floor(Math.min(this._heads.a, this._heads.b) * this.n),
    )
    if (n < 8) return
    const holding = this.hold > 0.45
    for (let i = 4; i < n - 4; i += 2) {
      const iv = (this.yA[i] - this.yB[i]) / this.staff
      const diss = dissonance(iv)
      const top = Math.min(this.yA[i], this.yB[i])
      const bot = Math.max(this.yA[i], this.yB[i])
      if (bot - top < 8) continue
      const marks = 1 + Math.round(diss * 4)
      const tilt = (diss - 0.2) * 0.7
      for (let m = 1; m <= marks; m++) {
        const t = m / (marks + 1)
        const x = this.xs[i] + (hash(i, m) - 0.5) * 3
        const y = lerp(top, bot, t)
        const len = lerp(5, 11, diss)
        ctx.beginPath()
        ctx.moveTo(x - len * tilt, y - 0.4)
        ctx.lineTo(x + len, y + 0.4)
        const a = holding ? 0.22 : 0.07 + diss * 0.1
        ctx.strokeStyle = holding
          ? `rgba(158,51,36,${a})`
          : `rgba(34,27,20,${a})`
        ctx.lineWidth = 0.7
        ctx.stroke()
      }
    }
  }

  private drawMembrane(ctx: CanvasRenderingContext2D, n: number): void {
    if (n < 8 || this._heads.b < 0.08) return
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const diss = dissonance((this.yA[i] - this.yB[i]) / this.staff)
      const jx = (hash(i, 11) - 0.5) * diss * 4
      const x = this.xs[i] + jx
      const y = this.yA[i] + (hash(i, 3) - 0.5) * diss * 3
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    for (let i = n - 1; i >= 0; i--) {
      const diss = dissonance((this.yA[i] - this.yB[i]) / this.staff)
      const jx = (hash(i, 17) - 0.5) * diss * 4
      ctx.lineTo(this.xs[i] + jx, this.yB[i])
    }
    ctx.closePath()
    const holding = this.hold > 0.4
    const alpha = holding ? 0.16 : 0.055 + this._quality * 0.05
    ctx.fillStyle = holding ? `rgba(158,51,36,${alpha})` : `rgba(34,27,20,${alpha})`
    ctx.fill()
    ctx.save()
    ctx.clip()
    ctx.globalAlpha = holding ? 0.22 : 0.12
    const drift = this.reduced ? 0 : (this.elapsed * 6) % 256
    ctx.drawImage(this.paper, -drift, 0, this.w + 256, this.h)
    ctx.restore()
  }

  private drawPlayhead(ctx: CanvasRenderingContext2D): void {
    if (this._heads.a >= 0.995 && this._heads.b >= 0.995) return
    const xa = lerp(this.margin, this.w - this.margin, this._heads.a)
    ctx.beginPath()
    ctx.moveTo(xa, this.cy - this.staff * 3.2)
    ctx.lineTo(xa, this.cy + this.staff * 3.2)
    ctx.strokeStyle = 'rgba(34,27,20,0.35)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    if (this._heads.b > 0.02 && this._heads.b < 0.995) {
      const xb = lerp(this.margin, this.w - this.margin, this._heads.b)
      ctx.beginPath()
      ctx.moveTo(xb, this.cy - this.staff * 3.2)
      ctx.lineTo(xb, this.cy + this.staff * 3.2)
      ctx.strokeStyle = 'rgba(22,38,46,0.35)'
      ctx.lineWidth = 0.7
      ctx.stroke()
    }
  }

  private drawTicks(ctx: CanvasRenderingContext2D): void {
    for (const t of this.ticks) {
      if (t.life <= 0) continue
      const x2 = t.x + Math.cos(t.a) * t.l * (1.15 - t.life * 0.15)
      const y2 = t.y + Math.sin(t.a) * t.l * (1.15 - t.life * 0.15)
      ctx.beginPath()
      ctx.moveTo(t.x, t.y)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = `rgba(158,51,36,${0.55 * t.life})`
      ctx.lineWidth = 0.9
      ctx.stroke()
    }
  }

  private drawHoldMark(ctx: CanvasRenderingContext2D): void {
    if (this.hold < 1.65 || !this.ptr) return
    const i = this.nearest(this.ptr.x)
    const y = (this.yA[i] + this.yB[i]) * 0.5
    ctx.save()
    ctx.translate(this.ptr.x, y)
    ctx.rotate(-0.12)
    ctx.fillStyle = SEAL
    ctx.globalAlpha = clamp((this.hold - 1.65) * 2, 0, 0.9)
    ctx.font = '600 15px "Noto Serif SC", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('对', 0, 0)
    ctx.restore()
  }

  private drawVoice(
    ctx: CanvasRenderingContext2D,
    ys: Float32Array,
    n: number,
    ink: { r: number; g: number; b: number },
    baseW: number,
    vary: number,
    wet: boolean,
  ): void {
    const xs = this.xs
    const widthAt = (i: number) => {
      const i0 = Math.max(0, i - 1)
      const i1 = Math.min(n - 1, i + 1)
      const spd = Math.hypot(xs[i1] - xs[i0], ys[i1] - ys[i0])
      const v = clamp((spd - 8) * 0.04, 0, 1)
      const head = wet ? smoothHead(i / n, n) : 1
      return (baseW + v * vary * 2.4) * head
    }
    ctx.fillStyle = `rgba(${ink.r},${ink.g},${ink.b},0.07)`
    fillRibbon(ctx, xs, ys, n, (i) => widthAt(i) * 2.6)
    ctx.fillStyle = `rgba(${ink.r},${ink.g},${ink.b},0.92)`
    fillRibbon(ctx, xs, ys, n, widthAt)
  }

  private drawNibs(ctx: CanvasRenderingContext2D, na: number, nb: number): void {
    if (this.reduced) return
    if (this._heads.a > 0.02 && this._heads.a < 0.995) {
      const i = Math.max(1, na - 1)
      nib(ctx, this.xs[i], this.yA[i], this.xs[i] - this.xs[i - 1], this.yA[i] - this.yA[i - 1], INK_A, 2.4)
    }
    if (this._heads.b > 0.02 && this._heads.b < 0.995) {
      const i = Math.max(1, nb - 1)
      nib(ctx, this.xs[i], this.yB[i], this.xs[i] - this.xs[i - 1], this.yB[i] - this.yB[i - 1], INK_B, 1.6)
    }
  }

  private drawSeal(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.translate(this.sealX, this.sealY)
    ctx.rotate(-0.16)
    ctx.strokeStyle = SEAL
    ctx.lineWidth = 1.35
    ctx.globalAlpha = 0.88
    ctx.strokeRect(-17, -17, 34, 34)
    ctx.strokeRect(-14.5, -14.5, 29, 29)
    ctx.fillStyle = SEAL
    ctx.font = '600 16px "Noto Serif SC", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('对', 0, 1)
    ctx.restore()
  }

  private drawCrop(ctx: CanvasRenderingContext2D): void {
    const m = 18
    const L = 11
    ctx.strokeStyle = 'rgba(34,27,20,0.28)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(m, m + L)
    ctx.lineTo(m, m)
    ctx.lineTo(m + L, m)
    ctx.moveTo(this.w - m - L, m)
    ctx.lineTo(this.w - m, m)
    ctx.lineTo(this.w - m, m + L)
    ctx.moveTo(m, this.h - m - L)
    ctx.lineTo(m, this.h - m)
    ctx.lineTo(m + L, this.h - m)
    ctx.moveTo(this.w - m, this.h - m - L)
    ctx.lineTo(this.w - m, this.h - m)
    ctx.lineTo(this.w - m - L, this.h - m)
    ctx.stroke()
  }
}

function fillRibbon(
  ctx: CanvasRenderingContext2D,
  xs: Float32Array,
  ys: Float32Array,
  n: number,
  widthAt: (i: number) => number,
): void {
  if (n < 3) return
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const j = Math.min(n - 1, i + 1)
    let dx = xs[j] - xs[i]
    let dy = ys[j] - ys[i]
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const w = widthAt(i) * 0.5
    const nx = -dy * w
    const ny = dx * w
    if (i === 0) ctx.moveTo(xs[i] + nx, ys[i] + ny)
    else ctx.lineTo(xs[i] + nx, ys[i] + ny)
  }
  for (let i = n - 1; i >= 0; i--) {
    const j = Math.min(n - 1, i + 1)
    let dx = xs[j] - xs[i]
    let dy = ys[j] - ys[i]
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const w = widthAt(i) * 0.5
    ctx.lineTo(xs[i] + dy * w, ys[i] - dx * w)
  }
  ctx.closePath()
  ctx.fill()
}

function nib(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  ink: { r: number; g: number; b: number },
  r: number,
): void {
  const ang = Math.atan2(dy, dx)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(ang)
  ctx.fillStyle = `rgba(${ink.r},${ink.g},${ink.b},0.9)`
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 1.6, r * 0.7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function smoothHead(t: number, _n: number): number {
  const tip = 1 - t
  return 1 + Math.exp(-tip * 18) * 1.3
}

function degreeToHz(deg: number): number {
  const pent = [0, 2, 4, 7, 9]
  const oct = Math.floor((deg + 12) / 5)
  const i = ((Math.round(deg) % 5) + 5) % 5
  const semi = pent[i] + oct * 12
  return 164.81 * Math.pow(2, semi / 12)
}

function makePaper(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return c
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash(x, y)
      const n2 = hash(x * 0.33, y * 2.1)
      const laid = y % 8 === 0 ? 8 : 0
      const chain = x % 37 === 0 ? 5 : 0
      const v = 214 + n * 22 + n2 * 8 - laid - chain
      const i = (y * w + x) * 4
      img.data[i] = v
      img.data[i + 1] = v - 12
      img.data[i + 2] = v - 36
      img.data[i + 3] = 48
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}
