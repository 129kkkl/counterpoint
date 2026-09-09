export class IntervalAudio {
  private ctx: AudioContext | null = null
  private gain: GainNode | null = null
  private a: OscillatorNode | null = null
  private b: OscillatorNode | null = null
  private d: OscillatorNode | null = null
  private filter: BiquadFilterNode | null = null
  enabled = false

  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.stop()
      this.enabled = false
      return false
    }
    await this.start()
    this.enabled = true
    return true
  }

  async start(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    this.stop()
    const ctx = this.ctx
    const gain = ctx.createGain()
    gain.gain.value = 0.028
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 720
    filter.Q.value = 0.7
    const make = (type: OscillatorType) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = 196
      o.connect(filter)
      o.start()
      return o
    }
    filter.connect(gain)
    gain.connect(ctx.destination)
    this.filter = filter
    this.gain = gain
    this.a = make('sine')
    this.b = make('sine')
    this.d = make('triangle')
    const dg = ctx.createGain()
    dg.gain.value = 0.35
    this.d.disconnect()
    this.d.connect(dg)
    dg.connect(filter)
  }

  set(freqA: number, freqB: number): void {
    if (!this.enabled || !this.a || !this.b || !this.d || !this.ctx) return
    const t = this.ctx.currentTime
    this.a.frequency.setTargetAtTime(freqA, t, 0.08)
    this.b.frequency.setTargetAtTime(freqB, t, 0.08)
    this.d.frequency.setTargetAtTime(Math.abs(freqA - freqB) + 40, t, 0.12)
  }

  stop(): void {
    this.a?.stop()
    this.b?.stop()
    this.d?.stop()
    this.a = null
    this.b = null
    this.d = null
    this.gain?.disconnect()
    this.filter?.disconnect()
    this.gain = null
    this.filter = null
  }

  dispose(): void {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
    this.enabled = false
  }
}
