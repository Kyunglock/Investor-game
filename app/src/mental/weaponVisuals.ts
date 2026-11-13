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

export function drawWeaponBullet(c: CanvasRenderingContext2D, grade: GunGrade, frame: number) {
  const color = GUN_GRADE_COLOR[grade]
  const bar = (x: number, y: number, w: number, h: number, fill: string | CanvasGradient) => {
    c.fillStyle = fill
    c.beginPath()
    c.roundRect(x, y, w, h, h / 2)
    c.fill()
  }
  // C안의 구슬형 에너지 탄. 작은 화면에서도 흰 반사광과 둥근 핵이 남는다.
  const tail = c.createLinearGradient(0, 0, 26, 0)
  tail.addColorStop(0, `${color}00`)
  tail.addColorStop(1, `${color}bb`)
  bar(frame ? 2 : 0, 3.5, 26, 3, tail)
  const orb = c.createRadialGradient(24, 3.5, 0.2, 26, 5, 4.5)
  orb.addColorStop(0, '#ffffff')
  orb.addColorStop(0.28, color)
  orb.addColorStop(1, grade === 'LR' ? '#b77909' : '#265c9a')
  c.beginPath()
  c.arc(26, 5, 4.3, 0, Math.PI * 2)
  c.fillStyle = orb
  c.fill()
  c.strokeStyle = '#ffffffdd'
  c.lineWidth = 0.8
  c.stroke()
  bar(10, 4.5, 12, 1, '#ffffffbb')
  if (['SSS', 'SR', 'UR', 'LR'].includes(grade)) {
    c.strokeStyle = color
    c.lineWidth = 0.8
    c.beginPath()
    c.ellipse(frame ? 17 : 19, 5, 1.5, 4, -0.2, 0, Math.PI * 2)
    c.stroke()
  }
  if (grade === 'LR') {
    c.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      const radius = i % 2 ? 1.2 : 3.4
      c.lineTo(26 + Math.cos(a) * radius, 5 + Math.sin(a) * radius)
    }
    c.closePath()
    c.fillStyle = '#fffbe8'
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
