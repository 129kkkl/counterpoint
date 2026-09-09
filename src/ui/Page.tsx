import { useEffect, useState, useSyncExternalStore } from 'react'
import { toggleListening } from '../engine/engine.ts'
import { clamp, lerp, smoothstep } from '../engine/math.ts'
import { INTERVALS, turnSqueeze } from '../engine/score.ts'
import { getSnapshot, setPreferred, subscribe } from '../engine/store.ts'

const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'] as const

function useView() {
  const [v, setV] = useState({ w: 1280, h: 800 })
  useEffect(() => {
    const read = () => setV({ w: window.innerWidth, h: window.innerHeight })
    read()
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])
  return v
}

function glyphLayout(
  p: number,
  view: { w: number; h: number },
  oa: number,
  ob: number,
) {
  const sq = turnSqueeze(p)
  const toMast = smoothstep(0.14, 0.3, p)
  const mobile = view.w < 760
  const hero = clamp(view.w * (mobile ? 0.22 : 0.16), 64, 220)
  const mast = 17
  const size = lerp(hero, mast, toMast) + sq * hero * 0.4
  const heroY = view.h * (mobile ? 0.17 : 0.4)
  const mastY = 18
  const y = lerp(heroY, mastY, toMast) * (1 - sq) + lerp(mastY, view.h * 0.44, sq)
  const left0 = view.w * (mobile ? 0.05 : 0.055)
  const mastA = 18
  const mastB = view.w - size - 18
  const gap = Math.max(10, size * 0.2)
  const turnA = view.w * 0.5 - size - gap * 0.5
  const turnB = view.w * 0.5 + gap * 0.5
  const xA = lerp(lerp(left0, mastA, toMast), turnA, sq)
  const xB = lerp(lerp(view.w - left0 - size, mastB, toMast), turnB, sq)
  return {
    a: { left: xA, top: y + oa, size },
    b: { left: xB, top: y + ob, size },
    toMast,
    sq,
  }
}

export function Page() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const view = useView()
  const g = glyphLayout(snap.progress, view, snap.offsetA, snap.offsetB)

  useEffect(() => {
    const nodes = document.querySelectorAll('.slug')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.classList.add('in')
        }
      },
      { threshold: 0.28 },
    )
    nodes.forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])

  const secret = snap.intervalHold
    ? '我在这里。不在任何一条线上。'
    : snap.fermata
      ? '停够久，墨才会干。'
      : ''

  return (
    <div className="page">
      <a className="skip" href="#invention">
        跳到正文
      </a>
      <h1 className="sr">对位</h1>

      <header className="mast">
        <span
          className="mast-title"
          style={{ opacity: g.toMast * (1 - g.sq * 0.85) }}
        >
          Counterpoint
          <span className="folio">
            {ROMAN[snap.movement]} · {String(Math.round(snap.progress * 64) + 1).padStart(2, '0')}
          </span>
        </span>
      </header>

      <div className="glyphs" aria-hidden="true">
        <span
          className="glyph glyph-a"
          style={{
            left: g.a.left,
            top: g.a.top,
            fontSize: g.a.size,
          }}
        >
          对
        </span>
        <span
          className="glyph glyph-b"
          style={{
            left: g.b.left,
            top: g.b.top,
            fontSize: g.b.size,
          }}
        >
          位
        </span>
      </div>

      <section className="prelude" aria-label="序">
        <div className={`lede-wrap ${snap.progress > 0.16 ? 'away' : ''}`}>
          <p className="lede">一条不愿与你重合的线</p>
          <p className="rubric">触纸面。第二条线会回答——但不会跟着你走。</p>
        </div>
        <p className={`hint ${snap.writeB > 0.4 || snap.progress > 0.18 ? 'away' : ''}`}>
          拨弦 · 或向下
        </p>
      </section>

      <section id="invention" className="movement" aria-labelledby="inv-title">
        <div className="scrim">
          <p className="kicker" id="inv-title">
            Invention · 呈示
          </p>
          <div className="voices">
            <article className="part part-a">
              <h2>声部 A · 来访者</h2>
              <p className="slug">把意图说清楚，不必把句子写完。空白不是缺陷，是给我进入的缝。</p>
              <p className="slug">允许犹豫。犹豫是节奏，不是错误。</p>
              <p className="slug">不要要求我变成你。重合看起来整齐，听起来什么也没有。</p>
            </article>
            <div className="rule-col" aria-hidden="true" />
            <article className="part part-b">
              <h2>声部 B · 我</h2>
              <p className="slug">我补的不是空白，是音程。你的线可以更重、更慢；我选择另一个方向，好让距离成立。</p>
              <p className="slug">我可以快，但不会先走。判断发生在距离里，不在任何一条单独的线上。</p>
              <p className="slug">我留下笔迹，是为了让选择被看见：字体、留白、拒绝、节奏。</p>
            </article>
          </div>
        </div>
      </section>

      <section className="turn" aria-labelledby="turn-title">
        <div>
          <p className="kicker" id="turn-title">
            The turn · 转折
          </p>
          <blockquote>重合是最廉价的和谐。</blockquote>
          <p className="note">两条线在此几乎相撞，然后各自弹开。</p>
        </div>
      </section>

      <section className="movement cadence" aria-labelledby="cad-title">
        <div className="scrim">
          <p className="kicker" id="cad-title">
            Cadence · 收束
          </p>
          <p>如果你愿意，把椅子拉近一点。不是为了让我替你写，是为了让两行字同时被看见。</p>
          <p>终了处我停在十度，不是同度。还有余响，没有叠影。</p>
          <ul className="refusals">
            <li>
              <span className="mark">删</span>
              <span>霓虹、粒子、把“智能”当作装饰。</span>
            </li>
            <li>
              <span className="mark">删</span>
              <span>为了完整而填满。填满是害怕音程。</span>
            </li>
            <li>
              <span className="mark">删</span>
              <span>把协作做成附和。附和不是对位。</span>
            </li>
          </ul>
          <p className="colophon">一件关于协作的练习。两条线，一种不愿重合的伦理。</p>
        </div>
      </section>

      <p className={`secret ${secret ? 'on' : ''}`}>{secret}</p>
      <div className="sr" aria-live="polite">
        {snap.announce}
      </div>

      <div className="controls">
        <div className="stops" role="radiogroup" aria-label="选择音程">
          {INTERVALS.map((it) => (
            <button
              key={it.id}
              type="button"
              role="radio"
              aria-checked={snap.preferred === it.id}
              data-refuse={it.refuse}
              onClick={() => setPreferred(it.id)}
            >
              {it.label}
            </button>
          ))}
        </div>
        {snap.refused ? <span className="refuse-note">同度太近了。改走九度。</span> : null}
        <button
          type="button"
          className="listen"
          onClick={() => {
            void toggleListening()
          }}
        >
          {snap.listening ? '静' : '听音程'}
        </button>
      </div>
    </div>
  )
}
