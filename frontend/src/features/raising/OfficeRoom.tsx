import { memo, useEffect, useRef } from 'react'
import type { Company } from '../../api/client'
import { bakeCat, CAT_H, CAT_W, type CatLook, EYE, INK } from '../game/cat/draw'
import { BOSS_LOOK, employeeLook } from '../game/cat/look'
import { officeName, seatTiles, type Tier, tierOf } from './office'

/**
 * 일하는 고양이 사무실 (decisions.md 343번): 앱 첫 화면의 그림. 벽·창문·간판이 있는 방에 책상이 늘어서 있고, 앉은 직원 고양이들은 차트를 보고(모니터에
 * 선이 흐른다), 전화를 하고, 커피를 마신다(김이 오른다). 사장냥은 앞에 서 있다. 가벼운 움직임만: 깜빡임·고개 까딱·구름 흐름. 그림은 코드다(341번):
 * 고양이는 한 번 구워 두고 매 프레임은 덧그림만 한다. 움직임 줄이기면 멈춘 그림, 화면이 숨으면 멈춘다.
 */

/** 그림 상자(논리 px). 가로에 맞춰 늘어난다. */
export const ROOM_W = 360
export const ROOM_H = 200
const FLOOR_Y = 152
/** 책상 하나의 크기와 자리(가운데 x, 윗변 y). 뒷줄 셋, 앞줄 둘. 여섯째부터는 그리지 않는다(미니맵이 보인다). */
const DESK_W = 78
const DESK_H = 22
const DESKS: [number, number][] = [
  [96, 100],
  [194, 100],
  [292, 100],
  [146, 146],
  [244, 146],
]
const CAT_SCALE = 0.44
const FPS = 12

/** 벽·바닥색: 단계가 오를수록 밝고 차분해진다. */
const WALLS: Record<Tier, [string, string]> = {
  basement: ['#e4ddd2', '#c9c0b2'],
  shop: ['#eee4d2', '#d4c6ad'],
  small: ['#eaf0f4', '#cfd9df'],
  yeouido: ['#e6eef7', '#c7d4e3'],
  whole: ['#e9f1fa', '#c9d7e6'],
  hq: ['#f2eff8', '#d6cfe6'],
  landmark: ['#fff4e6', '#e8d4b8'],
}

type Activity = 'chart' | 'phone' | 'coffee'
const ACTIVITIES: Activity[] = ['chart', 'phone', 'coffee']

interface Seat {
  cx: number
  top: number
  look: CatLook | null
  activity: Activity
  /** 모니터 선: 1 오름, -1 내림, 0 가만히 */
  trend: -1 | 0 | 1
  seed: number
}

function seatsOf(company: Company): Seat[] {
  const { tiles } = seatTiles(company)
  return DESKS.slice(0, Math.max(1, Math.min(DESKS.length, company.seats))).map(([cx, top], i) => {
    const t = tiles[i]
    const e = t?.employee ?? null
    return {
      cx,
      top,
      look: e ? employeeLook(e.id, e.overallGrade, t.mood) : null,
      activity: e ? ACTIVITIES[e.id % ACTIVITIES.length] : 'chart',
      trend: t?.pnl == null || t.pnl === 0 ? 0 : t.pnl > 0 ? 1 : -1,
      seed: e ? (e.id * 37) % 17 : i * 5,
    }
  })
}

type Ctx = CanvasRenderingContext2D

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, lw = 1.6) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fillStyle = fill
  c.fill()
  if (lw) {
    c.lineWidth = lw
    c.strokeStyle = INK
    c.lineJoin = 'round'
    c.stroke()
  }
}

/** 구워 둔 고양이. 열쇠는 생김새 JSON. */
class CatCache {
  private map = new Map<string, HTMLCanvasElement>()
  private scale: number
  constructor(scale: number) {
    this.scale = scale
  }
  get(look: CatLook): HTMLCanvasElement {
    const key = JSON.stringify(look)
    let cv = this.map.get(key)
    if (!cv) {
      cv = bakeCat(look, this.scale)
      this.map.set(key, cv)
    }
    return cv
  }
}

/** 고양이를 (x, y)에 발끝이 오게 그리고, 깜빡일 때는 눈을 덮는다. */
function cat(
  c: Ctx,
  cache: CatCache,
  look: CatLook,
  x: number,
  feetY: number,
  t: number,
  seed: number,
) {
  const w = CAT_W * CAT_SCALE
  const h = CAT_H * CAT_SCALE
  const bob = Math.sin(t * 2.1 + seed) * 0.9
  const left = x - w / 2
  const top = feetY - h * 0.9 + bob
  c.drawImage(cache.get(look), left, top, w, h)
  const blink = (t + seed * 0.37) % 3.9 < 0.13
  if (blink && look.face !== 'boss' && look.face !== 'sleep') {
    const eyeBg =
      look.pattern === 'tuxedo'
        ? '#fff8ee'
        : look.pattern === 'point'
          ? (look.fur2 ?? look.fur)
          : look.fur
    for (const sgn of [-1, 1]) {
      const ex = left + (EYE.cx + sgn * EYE.dx) * CAT_SCALE
      const ey = top + EYE.y * CAT_SCALE
      c.beginPath()
      c.ellipse(ex, ey, 2.2, 2.4, 0, 0, Math.PI * 2)
      c.fillStyle = eyeBg
      c.fill()
      c.beginPath()
      c.moveTo(ex - 1.6, ey + 0.3)
      c.lineTo(ex + 1.6, ey + 0.3)
      c.lineWidth = 1
      c.strokeStyle = INK
      c.stroke()
    }
  }
  return { left, top, w, h }
}

function monitor(c: Ctx, x: number, y: number, trend: -1 | 0 | 1, t: number, on: boolean) {
  rr(c, x, y, 26, 18, 2.5, on ? '#2b3448' : '#8f97a6', 1.6)
  rr(c, x + 10, y + 18, 6, 4, 1, '#8f97a6', 1.2)
  if (!on) {
    return
  }
  const col = trend > 0 ? '#58d48c' : trend < 0 ? '#ff6b8a' : '#8fc3ff'
  c.save()
  c.beginPath()
  c.rect(x + 2, y + 2, 22, 14)
  c.clip()
  c.beginPath()
  const shift = (t * 6) % 6
  for (let i = 0; i <= 8; i++) {
    const px = x + 2 + i * 3 - shift
    const base = y + 10 - trend * (i - 4) * 0.9
    const py = base + Math.sin(i * 1.7 + t * 1.5) * 1.6
    if (i === 0) c.moveTo(px, py)
    else c.lineTo(px, py)
  }
  c.lineWidth = 1.4
  c.strokeStyle = col
  c.lineJoin = 'round'
  c.stroke()
  c.restore()
}

function mug(c: Ctx, x: number, y: number, t: number) {
  rr(c, x, y - 7, 8, 7, 1.5, '#fff8ee', 1.3)
  c.beginPath()
  c.arc(x + 8.5, y - 3.5, 2, -Math.PI / 2, Math.PI / 2)
  c.lineWidth = 1.3
  c.strokeStyle = INK
  c.stroke()
  // 김
  c.strokeStyle = 'rgba(74,53,40,.35)'
  c.lineWidth = 1
  for (const k of [0, 1]) {
    const ph = t * 2 + k * 2
    const rise = (ph % 3) * 2.2
    c.beginPath()
    c.moveTo(x + 2.5 + k * 3, y - 8 - rise)
    c.quadraticCurveTo(x + 4 + k * 3, y - 11 - rise, x + 2.5 + k * 3, y - 14 - rise)
    c.globalAlpha = Math.max(0, 1 - (ph % 3) / 3)
    c.stroke()
  }
  c.globalAlpha = 1
}

function phone(c: Ctx, x: number, y: number, t: number) {
  c.save()
  c.translate(x, y)
  c.rotate(-0.35 + Math.sin(t * 3) * 0.05)
  rr(c, -2.5, -7, 5, 12, 1.5, '#4b5878', 1.2)
  c.restore()
}

function plant(c: Ctx, x: number, y: number) {
  rr(c, x - 7, y - 10, 14, 10, 2, '#e8a87c', 1.5)
  for (const [dx, dy, r] of [
    [-5, -16, 5],
    [5, -17, 5],
    [0, -22, 6],
  ]) {
    c.beginPath()
    c.ellipse(x + dx, y + dy, r, r * 1.1, 0, 0, Math.PI * 2)
    c.fillStyle = '#8fcf86'
    c.fill()
    c.lineWidth = 1.5
    c.strokeStyle = INK
    c.stroke()
  }
}

function room(
  c: Ctx,
  tier: Tier,
  name: string,
  seats: Seat[],
  resting: CatLook[],
  cache: CatCache,
  t: number,
) {
  const [wall, floor] = WALLS[tier]
  c.clearRect(0, 0, ROOM_W, ROOM_H)
  c.fillStyle = wall
  c.fillRect(0, 0, ROOM_W, FLOOR_Y)
  c.fillStyle = floor
  c.fillRect(0, FLOOR_Y, ROOM_W, ROOM_H - FLOOR_Y)
  c.beginPath()
  c.moveTo(0, FLOOR_Y)
  c.lineTo(ROOM_W, FLOOR_Y)
  c.lineWidth = 1.6
  c.strokeStyle = INK
  c.stroke()
  // 걸레받이
  c.fillStyle = 'rgba(74,53,40,.12)'
  c.fillRect(0, FLOOR_Y - 5, ROOM_W, 5)
  // 창문: 하늘과 구름(흐른다), 해
  const wx = 236
  const wy = 16
  const ww = 100
  const wh = 62
  c.save()
  c.beginPath()
  c.roundRect(wx, wy, ww, wh, 5)
  c.clip()
  c.fillStyle = '#cfeaf5'
  c.fillRect(wx, wy, ww, wh)
  c.beginPath()
  c.ellipse(wx + 78, wy + 16, 9, 9, 0, 0, Math.PI * 2)
  c.fillStyle = '#ffe28a'
  c.fill()
  const cloudX = wx - 30 + ((t * 5) % (ww + 70))
  for (const [dx, dy, r] of [
    [0, 0, 8],
    [8, -3, 7],
    [-8, -2, 6],
  ]) {
    c.beginPath()
    c.ellipse(cloudX + dx, wy + 34 + dy, r, r * 0.7, 0, 0, Math.PI * 2)
    c.fillStyle = '#fff'
    c.fill()
  }
  // 먼 건물
  for (const [bx, bw, bh] of [
    [wx + 6, 16, 26],
    [wx + 28, 12, 18],
    [wx + 56, 20, 32],
  ]) {
    c.fillStyle = '#b7cfdf'
    c.fillRect(bx, wy + wh - bh, bw, bh)
  }
  c.restore()
  rr(c, wx, wy, ww, wh, 5, 'rgba(0,0,0,0)', 2)
  c.beginPath()
  c.moveTo(wx + ww / 2, wy)
  c.lineTo(wx + ww / 2, wy + wh)
  c.moveTo(wx, wy + wh / 2)
  c.lineTo(wx + ww, wy + wh / 2)
  c.lineWidth = 1.4
  c.strokeStyle = INK
  c.stroke()
  // 간판
  c.font = '600 13px Jua, "Noto Sans KR", sans-serif'
  const tw = c.measureText(name).width + 26
  rr(c, 22, 26, tw, 24, 6, '#ff9fc0', 2)
  c.beginPath()
  c.ellipse(34, 38, 3, 3, 0, 0, Math.PI * 2)
  c.fillStyle = INK
  c.fill()
  c.fillStyle = INK
  c.textBaseline = 'middle'
  c.fillText(name, 42, 39)
  // 책상 줄: 뒤에서부터. 고양이 → 책상 → 소품 순으로 쌓는다.
  for (const s of seats) {
    const left = s.cx - DESK_W / 2
    if (s.look) {
      cat(c, cache, s.look, s.cx + 10, s.top + 13, t, s.seed)
    }
    rr(c, left, s.top, DESK_W, DESK_H, 4, '#f3e3c8', 1.8)
    c.fillStyle = 'rgba(74,53,40,.12)'
    c.fillRect(left + 3, s.top + DESK_H - 5, DESK_W - 6, 3)
    monitor(c, left + 6, s.top - 20, s.trend, t, s.look !== null && s.activity === 'chart')
    if (s.look === null) {
      // 빈 자리: 의자 등받이만 비죽
      rr(c, s.cx + 2, s.top - 12, 18, 12, 4, '#cfd9df', 1.5)
    } else if (s.activity === 'coffee') {
      mug(c, left + DESK_W - 20, s.top + 1, t)
    } else if (s.activity === 'phone') {
      phone(c, s.cx + 21, s.top - 17, t)
    }
  }
  // 화분과 쉬는 직원(오른쪽)
  plant(c, 338, FLOOR_Y + 28)
  resting.slice(0, 2).forEach((look, i) => {
    cat(c, cache, look, 318 - i * 26, FLOOR_Y + 40, t, 7 + i * 3)
  })
  // 사장냥: 왼쪽 앞에 커피를 들고
  const boss = cat(c, cache, { ...BOSS_LOOK }, 50, FLOOR_Y + 44, t, 1)
  mug(c, boss.left + boss.w - 8, boss.top + boss.h * 0.68, t)
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

export const OfficeRoom = memo(function OfficeRoom({
  company,
  className,
}: {
  company: Company
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const seats = seatsOf(company)
  const resting = company.employees
    .filter((e) => !e.desk)
    .map((e) => employeeLook(e.id, e.overallGrade, null))
  const tier = tierOf(company.grade)
  const name = officeName(company.grade)
  const key = JSON.stringify({ seats, resting, tier })
  useEffect(() => {
    const cv = ref.current
    const c = cv?.getContext('2d')
    if (!cv || !c) {
      return
    }
    const dpr = Math.min(3, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
    cv.width = ROOM_W * dpr
    cv.height = ROOM_H * dpr
    const cache = new CatCache(CAT_SCALE * dpr)
    const { seats: ss, resting: rs } = JSON.parse(key) as { seats: Seat[]; resting: CatLook[] }
    const t0 = performance.now()
    let last = 0
    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 1000 / FPS || document.hidden) {
        return
      }
      last = now
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      room(c, tier, name, ss, rs, cache, (now - t0) / 1000)
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    room(c, tier, name, ss, rs, cache, 0)
    if (!reducedMotion()) {
      raf = requestAnimationFrame(frame)
    }
    return () => cancelAnimationFrame(raf)
  }, [key, tier, name])
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: '100%', aspectRatio: `${ROOM_W} / ${ROOM_H}`, display: 'block' }}
      role="img"
      aria-label={`${name}에서 일하는 고양이들`}
      data-testid="office-room"
      data-seats={seats.length}
    />
  )
})
