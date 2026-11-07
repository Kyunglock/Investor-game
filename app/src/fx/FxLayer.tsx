import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { type BurstKind, useFx } from './fx'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  spin: number
  angle: number
  shape: 'coin' | 'rect' | 'spark' | 'puff'
}

const GOLD = ['#f5d36b', '#e0b44a', '#c9962a', '#fff1b0']
const CONFETTI = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ffffff']

function spawn(kind: BurstKind, x: number, y: number): Particle[] {
  const out: Particle[] = []
  const n = kind === 'confetti' ? 90 : kind === 'coins' ? 28 : kind === 'sparks' ? 24 : 14
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const speed =
      kind === 'sparks'
        ? 6 + Math.random() * 7
        : kind === 'smoke'
          ? 0.6 + Math.random() * 1.2
          : 3 + Math.random() * 6
    const up = kind === 'confetti' ? -9 : kind === 'coins' ? -7 : 0
    out.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed * (kind === 'smoke' ? 0.4 : 1) + up * Math.random(),
      life: 0,
      max:
        kind === 'sparks'
          ? 24 + Math.random() * 12
          : kind === 'smoke'
            ? 50 + Math.random() * 30
            : 60 + Math.random() * 40,
      size:
        kind === 'confetti'
          ? 4 + Math.random() * 5
          : kind === 'coins'
            ? 5 + Math.random() * 4
            : kind === 'smoke'
              ? 10 + Math.random() * 14
              : 2 + Math.random() * 2,
      color:
        kind === 'coins' || kind === 'sparks'
          ? GOLD[i % GOLD.length]
          : kind === 'confetti'
            ? CONFETTI[i % CONFETTI.length]
            : 'rgba(120,120,130,0.6)',
      spin: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI,
      shape:
        kind === 'coins'
          ? 'coin'
          : kind === 'confetti'
            ? 'rect'
            : kind === 'sparks'
              ? 'spark'
              : 'puff',
    })
  }
  return out
}

/**
 * 임팩트 층 (decisions.md 310번): 화면 맨 위의 캔버스에 코인·색종이·불꽃·연기가 터지고, 떠오르는 글과 번쩍임을 그린다. 손은 통과한다.
 * 움직임 줄이기면 터짐은 그리지 않는다.
 */
export function FxLayer() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const raf = useRef(0)
  const flash = useFx((s) => s.flash)
  const floats = useFx((s) => s.floats)
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const el = canvas.current
    if (!el) {
      return
    }
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      el.width = Math.floor(window.innerWidth * dpr)
      el.height = Math.floor(window.innerHeight * dpr)
      el.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const draw = () => {
      const g = el.getContext('2d')
      if (!g) {
        return
      }
      const ps = particles.current
      g.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (const p of ps) {
        p.life++
        p.x += p.vx
        p.y += p.vy
        if (p.shape !== 'puff') {
          p.vy += p.shape === 'spark' ? 0.15 : 0.32
          p.vx *= 0.985
        } else {
          p.vy -= 0.03
        }
        p.angle += p.spin
        const t = 1 - p.life / p.max
        g.globalAlpha = Math.max(0, p.shape === 'puff' ? t * 0.6 : t)
        g.fillStyle = p.color
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.angle)
        if (p.shape === 'coin') {
          const w = Math.abs(Math.cos(p.angle * 2)) * p.size
          g.beginPath()
          g.ellipse(0, 0, Math.max(1, w), p.size, 0, 0, Math.PI * 2)
          g.fill()
          g.strokeStyle = '#8a6514'
          g.lineWidth = 1
          g.stroke()
        } else if (p.shape === 'rect') {
          g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        } else if (p.shape === 'spark') {
          g.fillRect(-p.size * 2, -p.size / 2, p.size * 4, p.size)
        } else {
          g.beginPath()
          g.arc(0, 0, p.size * (1 + p.life / p.max), 0, Math.PI * 2)
          g.fill()
        }
        g.restore()
      }
      particles.current = ps.filter((p) => p.life < p.max)
      g.globalAlpha = 1
      raf.current = particles.current.length > 0 ? requestAnimationFrame(draw) : 0
    }
    const unsub = useFx.subscribe((state) => {
      if (state.bursts.length === 0) {
        return
      }
      const bursts = useFx.getState().consumeBursts()
      if (reduced) {
        return
      }
      for (const b of bursts) {
        particles.current.push(...spawn(b.kind, b.x, b.y))
      }
      if (!raf.current) {
        raf.current = requestAnimationFrame(draw)
      }
    })
    return () => {
      unsub()
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf.current)
      raf.current = 0
    }
  }, [reduced])

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[60]"
      aria-hidden="true"
      data-testid="fx-layer"
    >
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {flash && (
        <div
          key={flash.id}
          className="fx-flash absolute inset-0"
          style={{ background: flash.color }}
        />
      )}
      {floats.map((f) => (
        <FloatText key={f.id} id={f.id} x={f.x} y={f.y} text={f.text} tone={f.tone} />
      ))}
    </div>,
    document.body,
  )
}

const TONES = {
  up: 'text-[#ff8a7a]',
  down: 'text-[#8cc3ec]',
  gold: 'text-[#f5d36b]',
  plain: 'text-white',
}

function FloatText({
  id,
  x,
  y,
  text,
  tone,
}: {
  id: number
  x: number
  y: number
  text: string
  tone: keyof typeof TONES
}) {
  const drop = useFx((s) => s.dropFloat)
  useEffect(() => {
    const t = setTimeout(() => drop(id), 1300)
    return () => clearTimeout(t)
  }, [id, drop])
  return (
    <span
      className={`fx-float absolute whitespace-nowrap font-mono-num text-[20px] font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)] ${TONES[tone]}`}
      style={{ left: x, top: y }}
    >
      {text}
    </span>
  )
}
