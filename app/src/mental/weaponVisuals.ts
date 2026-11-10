import { GUN_GRADE_COLOR, type GunGrade } from '@web/features/game/cat/draw'
import { FIRE_STYLES, type FireStyle } from './weaponEffects'

export const WEAPON_GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const

/** 등급은 무기 실루엣뿐 아니라 탄·총구·꼬리·명중 모양까지 결정한다. */
export const GRADE_FIRE: Record<GunGrade, FireStyle> = {
  F: { ...FIRE_STYLES.pistol, length: 0.8, width: 0.8, flash: 0.7, trailMs: 70 },
  E: { ...FIRE_STYLES.pistol, length: 1.2, width: 1, flash: 1.1, trailMs: 40 },
  D: { ...FIRE_STYLES.revolver, length: 1.5, width: 1.35, sparks: 3 },
  C: { ...FIRE_STYLES.smg, length: 1.1, width: 0.9, flash: 0.9 },
  B: { ...FIRE_STYLES.smg, length: 1.5, width: 1.3, flash: 1.3, sparks: 3, trailMs: 28 },
  A: { ...FIRE_STYLES.shotgun, length: 1.7, width: 2.1, flash: 2.3 },
  S: { ...FIRE_STYLES.rifle, length: 3, width: 2, flash: 2.7, sparks: 9, trailMs: 12 },
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
  const tail = c.createLinearGradient(0, 0, 30, 0)
  tail.addColorStop(0, `${color}00`)
  tail.addColorStop(1, color)
  bar(0, 3, 30, 4, tail)
  if (grade === 'F') bar(18, 3, 11, 4, '#e2e8f0')
  if (grade === 'E') {
    bar(10, 2, 20, 6, color)
    bar(15, 3, 13, 2, '#ecfdf5')
  }
  if (grade === 'D') {
    c.fillStyle = color
    c.beginPath()
    c.moveTo(9, 5)
    c.lineTo(20, 0)
    c.lineTo(31, 5)
    c.lineTo(20, 10)
    c.fill()
    bar(18, 4, 9, 2, '#fff')
  }
  if (grade === 'C') {
    bar(9, 2, 21, 3, color)
    bar(9, 6, 17, 2, '#ede9fe')
  }
  if (grade === 'B') {
    for (let i = 0; i < 3; i++) bar(5 + i * 4, i * 3 + 0.5, 25 - i * 4, 2, i === 1 ? '#fff' : color)
  }
  if (grade === 'A') {
    bar(12, 1, 17, 8, '#7c2d12')
    bar(16, 1.5, 13, 7, color)
    bar(20, 3, 9, 3, '#fff7ed')
    c.fillStyle = '#facc15'
    c.beginPath()
    c.moveTo(14, 1)
    c.lineTo(frame ? 0 : 5, 5)
    c.lineTo(14, 9)
    c.fill()
  }
  if (grade === 'S') {
    bar(0, 4, 31, 2, '#fff')
    c.strokeStyle = frame ? '#e9d5ff' : color
    c.lineWidth = 1
    c.beginPath()
    c.ellipse(22, 5, 7, 4, 0, 0, Math.PI * 2)
    c.stroke()
    c.fillStyle = '#fff'
    c.beginPath()
    c.moveTo(30, 5)
    c.lineTo(21, 1)
    c.lineTo(15, 5)
    c.lineTo(21, 9)
    c.fill()
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
