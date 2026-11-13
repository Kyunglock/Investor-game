import { GUN_GRADE_COLOR, type GunGrade } from '@web/features/game/cat/draw'
import { FIRE_STYLES, type FireStyle } from './weaponEffects'

export const WEAPON_GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const

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
}

export function gradeTint(grade: GunGrade) {
  return Number.parseInt(GUN_GRADE_COLOR[grade].slice(1), 16)
}

export function drawWeaponBullet(c: CanvasRenderingContext2D, grade: GunGrade, frame: number) {
  const color = GUN_GRADE_COLOR[grade]
  const bar = (x: number, y: number, w: number, h: number, fill: string | CanvasGradient) => {
    c.fillStyle = fill
    c.beginPath()
    c.roundRect(x, y, w, h, h / 2)
    c.fill()
  }
  // 탄두와 잔상을 분리한다. 텍스처 크기·중심과 충돌 판정은 유지한다.
  const tail = c.createLinearGradient(0, 0, 24, 0)
  tail.addColorStop(0, `${color}00`)
  tail.addColorStop(1, `${color}bb`)
  bar(frame ? 2 : 0, 3.5, 24, 3, tail)
  const shell = (back: number, half: number, fill: string) => {
    c.beginPath()
    c.moveTo(back, 5 - half)
    c.lineTo(25, 5 - half)
    c.quadraticCurveTo(29, 5 - half, 31, 5)
    c.quadraticCurveTo(29, 5 + half, 25, 5 + half)
    c.lineTo(back, 5 + half)
    c.closePath()
    c.fillStyle = fill
    c.fill()
    c.strokeStyle = '#26364b'
    c.lineWidth = 0.8
    c.stroke()
  }
  if (grade === 'F' || grade === 'E') {
    shell(18, 2.4, grade === 'F' ? '#f4c569' : color)
    bar(20, 3.5, 7, 1.2, '#fff8db')
    c.fillStyle = grade === 'F' ? '#b97935' : '#176453'
    c.fillRect(18, 3, 2, 4)
  } else if (grade === 'D') {
    shell(15, 3.3, '#9dddf5')
    bar(18, 3, 9, 1.5, '#fff')
    c.fillStyle = '#37728e'
    c.fillRect(16, 2.5, 2, 5)
  } else if (grade === 'C' || grade === 'B') {
    shell(13, grade === 'B' ? 2.5 : 1.8, color)
    bar(15, 4.3, 13, 1.2, '#fff')
    if (grade === 'B') {
      bar(frame ? 4 : 7, 1, 9, 1, '#f0abfc')
      bar(frame ? 7 : 4, 8, 9, 1, '#f0abfc')
    }
  } else if (grade === 'A') {
    c.fillStyle = '#ffba58'
    c.beginPath()
    c.moveTo(18, 2)
    c.lineTo(frame ? 5 : 1, 5)
    c.lineTo(18, 8)
    c.fill()
    shell(18, 3.6, '#fb923c')
    bar(22, 3, 6, 2, '#fff4cc')
    c.fillStyle = '#9a4b31'
    c.fillRect(18, 2, 2, 6)
  } else {
    c.strokeStyle = frame ? '#c4b5fd' : color
    c.lineWidth = 1
    c.beginPath()
    c.ellipse(22, 5, 7, 4, 0, 0, Math.PI * 2)
    c.stroke()
    c.beginPath()
    c.moveTo(12, 5)
    c.lineTo(23, 2)
    c.lineTo(31, 5)
    c.lineTo(23, 8)
    c.closePath()
    c.fillStyle = '#ecfeff'
    c.fill()
    c.strokeStyle = '#0891b2'
    c.stroke()
    bar(2, 4.5, 24, 1, '#ffffffcc')
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
    c.arc(0, 0, grade === 'S' ? 30 : 18 + rank * 2, 0, Math.PI * 2)
    c.stroke()
  }
  if (grade === 'S') {
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
    c.lineTo(20 + rank * 2, 0)
    c.lineTo(8, 2)
    c.fill()
    c.restore()
  }
  c.fillStyle = '#fff'
  c.beginPath()
  c.arc(0, 0, 4 + rank, 0, Math.PI * 2)
  c.fill()
}
