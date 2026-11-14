import { GUN_GRADE_COLOR, GUN_GRADES, type GunGrade } from '@web/features/game/cat/draw'
import { FIRE_STYLES, type FireStyle } from './weaponEffects'

export const WEAPON_GRADES = GUN_GRADES

/** 표시만 키운다. 충돌 원은 이 배율을 나눠 기존 크기를 유지한다. */
export const BULLET_VISUAL_SCALE = 1.65

/** 등급은 무기 실루엣뿐 아니라 탄·총구·꼬리·명중 모양까지 결정한다. */
export const GRADE_FIRE: Record<GunGrade, FireStyle> = {
  F: { ...FIRE_STYLES.pistol, length: 0.8, width: 0.8, flash: 0.7, trailMs: 70 },
  E: { ...FIRE_STYLES.pistol, length: 1.2, width: 1, flash: 1.1, trailMs: 40 },
  D: { ...FIRE_STYLES.revolver, length: 1.5, width: 1.35, sparks: 3 },
  C: { ...FIRE_STYLES.smg, length: 1.1, width: 0.9, flash: 0.9 },
  B: { ...FIRE_STYLES.smg, length: 1.5, width: 1.3, flash: 1.3, sparks: 3, trailMs: 28 },
  A: { ...FIRE_STYLES.shotgun, length: 1.35, width: 1.4, flash: 1.2 },
  S: { ...FIRE_STYLES.rifle, length: 1.6, width: 1.3, flash: 1.3, sparks: 3, trailMs: 12 },
  SS: { ...FIRE_STYLES.rifle, length: 1.65, width: 1.3, flash: 1.3, sparks: 3, trailMs: 12 },
  SSS: { ...FIRE_STYLES.rifle, length: 1.7, width: 1.35, flash: 1.4, sparks: 3, trailMs: 12 },
  SR: { ...FIRE_STYLES.rifle, length: 1.75, width: 1.4, flash: 1.4, sparks: 4, trailMs: 12 },
  UR: { ...FIRE_STYLES.rifle, length: 1.8, width: 1.4, flash: 1.5, sparks: 4, trailMs: 12 },
  LR: { ...FIRE_STYLES.rifle, length: 1.85, width: 1.45, flash: 1.5, sparks: 4, trailMs: 12 },
}

export function gradeTint(grade: GunGrade) {
  return Number.parseInt(GUN_GRADE_COLOR[grade].slice(1), 16)
}

/** 탄 그림의 크기: 가로는 충돌 계산의 BULLET_W(32)와 같고, 세로는 등급마다 다른 모양이 들어가게 16이다 (512번). */
export const BULLET_ART = { w: 32, h: 16 }

/** S 등급부터는 탄이 반짝이 가루를 흘린다 (512번). */
export const sparkles = (grade: GunGrade) => GUN_GRADES.indexOf(grade) >= GUN_GRADES.indexOf('S')

/**
 * 등급마다 탄의 생김새가 다르다 (512번). 머리는 오른쪽(+x) (26, 8) 언저리, 꼬리는 왼쪽이다. frame은 두 장을 번갈아 보여 살아 움직이게 한다.
 * F 납작한 쇠구슬 · E 가는 바늘 · D 물방울 구슬 · C 쌍둥이 볼트 · B 화살촉 · A 불덩이 · S 레이저 · SS 마름모 창 · SSS 고리 두른 별 ·
 * SR 도는 표창 · UR 플라스마 물결 · LR 금빛 혜성.
 */
export function drawWeaponBullet(c: CanvasRenderingContext2D, grade: GunGrade, frame: number) {
  const color = GUN_GRADE_COLOR[grade]
  const y = BULLET_ART.h / 2
  const bar = (x: number, top: number, w: number, h: number, fill: string | CanvasGradient) => {
    c.fillStyle = fill
    c.beginPath()
    c.roundRect(x, top, w, h, h / 2)
    c.fill()
  }
  const fade = (from: number, to: number, alpha = 'cc') => {
    const g = c.createLinearGradient(from, 0, to, 0)
    g.addColorStop(0, `${color}00`)
    g.addColorStop(1, `${color}${alpha}`)
    return g
  }
  const orb = (x: number, r: number, edge = color) => {
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.2, x, y, r)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, color)
    g.addColorStop(1, edge)
    c.fillStyle = g
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
  }
  const star = (x: number, points: number, outer: number, inner: number, turn: number, cy = y) => {
    c.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const a = turn + (i * Math.PI) / points
      const r = i % 2 ? inner : outer
      c.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    c.closePath()
    c.fill()
  }
  const outline = (width = 0.8, stroke = '#ffffffdd') => {
    c.strokeStyle = stroke
    c.lineWidth = width
    c.stroke()
  }
  switch (grade) {
    case 'F': {
      // 쇠구슬: 꼬리 없이 작고 납작하다.
      bar(18 + frame, y - 0.8, 6, 1.6, fade(18, 24, '88'))
      orb(26, 2.6, '#475569')
      break
    }
    case 'E': {
      // 바늘: 가늘고 길며 끝이 뾰족하다.
      bar(4 + frame * 2, y - 0.6, 18, 1.2, fade(4, 22))
      c.fillStyle = color
      c.beginPath()
      c.moveTo(30, y)
      c.lineTo(19, y - 2.2)
      c.lineTo(21, y)
      c.lineTo(19, y + 2.2)
      c.closePath()
      c.fill()
      outline(0.6)
      break
    }
    case 'D': {
      // 물방울 구슬: 둥근 핵에 흰 반사광.
      bar(frame ? 4 : 2, y - 1.5, 22, 3, fade(2, 24, 'bb'))
      orb(26, 4.3, '#265c9a')
      c.beginPath()
      c.arc(26, y, 4.3, 0, Math.PI * 2)
      outline()
      bar(10, y - 0.5, 12, 1, '#ffffffbb')
      break
    }
    case 'C': {
      // 쌍둥이 볼트: 위아래로 나란한 두 줄.
      for (const dy of [-3.2, 3.2]) {
        const shift = (dy < 0 ? frame : 1 - frame) * 2
        bar(6 + shift, y + dy - 1.1, 18, 2.2, fade(6, 24))
        bar(22 + shift, y + dy - 1.3, 7, 2.6, '#ffffff')
      }
      bar(14, y - 0.4, 8, 0.8, `${color}aa`)
      break
    }
    case 'B': {
      // 화살촉: 뒤가 갈라진 꺾쇠가 겹쳐 난다.
      for (const [x, alpha] of [
        [10 - frame * 2, '55'],
        [17 - frame, '99'],
        [24, 'ff'],
      ] as const) {
        c.fillStyle = `${color}${alpha}`
        c.beginPath()
        c.moveTo(x + 6, y)
        c.lineTo(x - 3, y - 5.5)
        c.lineTo(x, y)
        c.lineTo(x - 3, y + 5.5)
        c.closePath()
        c.fill()
      }
      outline(0.7)
      break
    }
    case 'A': {
      // 불덩이: 뒤로 일렁이는 불꼬리와 노란 심.
      const flame = c.createLinearGradient(2, 0, 30, 0)
      flame.addColorStop(0, '#ff3d1a00')
      flame.addColorStop(0.5, '#ff5a1fcc')
      flame.addColorStop(1, color)
      c.fillStyle = flame
      c.beginPath()
      c.moveTo(30, y)
      c.quadraticCurveTo(27, y - 6.5, 18, y - (frame ? 5.5 : 4))
      c.lineTo(11, y - (frame ? 2 : 4.5))
      c.lineTo(15, y - 1)
      c.lineTo(3, y + (frame ? 1.5 : -1))
      c.lineTo(14, y + 1.5)
      c.lineTo(10, y + (frame ? 5 : 3))
      c.quadraticCurveTo(26, y + 7, 30, y)
      c.closePath()
      c.fill()
      c.fillStyle = '#fff3b0'
      c.beginPath()
      c.ellipse(24.5, y, 3.6, 2.6, 0, 0, Math.PI * 2)
      c.fill()
      break
    }
    case 'S': {
      // 레이저: 길고 곧은 빛줄기에 흰 심.
      bar(0, y - 2.6, 32, 5.2, fade(0, 14, '66'))
      bar(4 + frame * 2, y - 1.7, 27 - frame * 2, 3.4, color)
      bar(8, y - 0.7, 23, 1.4, '#ffffff')
      break
    }
    case 'SS': {
      // 마름모 창: 빛줄기 끝에 각진 창날.
      bar(2 + frame * 2, y - 1.3, 22, 2.6, fade(2, 22))
      bar(8, y - 0.5, 14, 1, '#ffffffcc')
      c.fillStyle = color
      c.beginPath()
      c.moveTo(31, y)
      c.lineTo(24, y - 5)
      c.lineTo(17, y)
      c.lineTo(24, y + 5)
      c.closePath()
      c.fill()
      outline()
      c.fillStyle = '#ffffff'
      c.beginPath()
      c.moveTo(28, y)
      c.lineTo(24, y - 2.2)
      c.lineTo(20, y)
      c.lineTo(24, y + 2.2)
      c.closePath()
      c.fill()
      break
    }
    case 'SSS': {
      // 고리 두른 별: 구슬 둘레를 기울어진 고리가 돈다.
      bar(2, y - 2, 20, 4, fade(2, 22, '99'))
      orb(24, 4.6, '#6b21a8')
      c.beginPath()
      c.ellipse(24, y, 7.2, 2.4, frame ? 0.5 : -0.5, 0, Math.PI * 2)
      outline(1.1, '#f3e8ff')
      c.fillStyle = '#ffffff'
      star(frame ? 9 : 13, 4, 2.2, 0.7, 0)
      break
    }
    case 'SR': {
      // 도는 표창: 네 날이 프레임마다 돌아간다.
      bar(2, y - 1.6, 18, 3.2, fade(2, 20))
      c.fillStyle = color
      star(24, 4, 7.4, 2.4, frame ? Math.PI / 4 : 0)
      outline(0.8)
      c.fillStyle = '#ffffff'
      star(24, 4, 3.2, 1.1, frame ? 0 : Math.PI / 4)
      break
    }
    case 'UR': {
      // 플라스마 물결: 두 가닥이 꼬이며 구슬을 끈다.
      for (const side of [1, -1]) {
        c.beginPath()
        for (let x = 2; x <= 22; x += 2) {
          const wave = Math.sin(x * 0.55 + (frame ? Math.PI / 2 : 0)) * 4 * side
          c.lineTo(x, y + wave * (x / 22))
        }
        c.strokeStyle = side > 0 ? color : '#d9ffe8'
        c.lineWidth = 1.6
        c.stroke()
      }
      orb(25, 5, '#166534')
      c.beginPath()
      c.arc(25, y, 5, 0, Math.PI * 2)
      outline(1, '#eafff1')
      break
    }
    case 'LR': {
      // 금빛 혜성: 굵은 금빛 꼬리, 여덟 갈래 별, 흩날리는 금가루.
      const tail = c.createLinearGradient(0, 0, 24, 0)
      tail.addColorStop(0, '#facc1500')
      tail.addColorStop(0.6, '#fbbf24cc')
      tail.addColorStop(1, '#fff7c2')
      c.fillStyle = tail
      c.beginPath()
      c.moveTo(25, y - 4.5)
      c.lineTo(0, y - (frame ? 1.5 : 0.5))
      c.lineTo(0, y + (frame ? 0.5 : 1.5))
      c.lineTo(25, y + 4.5)
      c.closePath()
      c.fill()
      c.fillStyle = color
      star(24, 8, 7.6, 3.4, frame ? Math.PI / 8 : 0)
      outline(0.8, '#fffbe8')
      c.fillStyle = '#fffbe8'
      star(24, 4, 4.4, 1.3, 0)
      c.fillStyle = '#fff7c2'
      for (const [x, dy] of frame
        ? [
            [6, -5],
            [13, 5.5],
          ]
        : [
            [9, 5],
            [15, -5.5],
          ])
        star(x, 4, 1.6, 0.5, 0, y + dy)
      break
    }
  }
}

export function drawWeaponImpact(c: CanvasRenderingContext2D, grade: GunGrade) {
  const rank = WEAPON_GRADES.indexOf(grade)
  const color = GUN_GRADE_COLOR[grade]
  c.translate(40, 40)
  c.strokeStyle = color
  c.lineWidth = grade === 'A' ? 5 : 2
  if (rank > 0) {
    c.beginPath()
    c.arc(0, 0, Math.min(30, 18 + rank * 2), 0, Math.PI * 2)
    c.stroke()
  }
  if (rank >= WEAPON_GRADES.indexOf('S')) {
    c.strokeStyle = '#e9d5ff'
    c.beginPath()
    c.ellipse(0, 0, 37, 12, -0.5, 0, Math.PI * 2)
    c.stroke()
  }
  for (let i = 0; i < 4 + rank; i++) {
    c.save()
    c.rotate((i * Math.PI * 2) / (4 + rank))
    c.fillStyle = color
    c.beginPath()
    c.moveTo(8, -2)
    c.lineTo(Math.min(36, 20 + rank * 2), 0)
    c.lineTo(8, 2)
    c.fill()
    c.restore()
  }
  c.fillStyle = '#fff'
  c.beginPath()
  c.arc(0, 0, 4 + rank, 0, Math.PI * 2)
  c.fill()
}
