import { useEffect, useRef } from 'react'
import { Engine } from '../engine/engine.ts'

export function Stave() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const engine = new Engine(canvas)
    engine.start()
    return () => engine.destroy()
  }, [])

  return (
    <canvas
      ref={ref}
      className="stave"
      aria-label="对位：两条互相回答、却不愿重合的墨线。触纸面可拨动上声部。"
    />
  )
}
