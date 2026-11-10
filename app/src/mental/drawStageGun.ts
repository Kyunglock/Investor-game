import { GUN_GRADE_COLOR, type GunGrade, type GunKind } from '@web/features/game/cat/draw'

/** 총구는 +x, 피벗은 뒷손. 무기 종류와 등급을 실제 장비에 맞춰 그린다. */
export function drawStageGun(
  c: CanvasRenderingContext2D,
  fur: string,
  _kind: GunKind,
  grade: GunGrade,
) {
  const glow = GUN_GRADE_COLOR[grade]
  const box = (x: number, y: number, w: number, h: number, fill: string, radius = 2) => {
    c.beginPath()
    c.roundRect(x, y, w, h, radius)
    c.fillStyle = fill
    c.fill()
    c.lineWidth = 1.4
    c.strokeStyle = '#46596b'
    c.stroke()
  }
  c.lineJoin = 'round'
  // 팔은 몸 쪽에서 손까지 이어지며 무기와 함께 회전한다.
  c.beginPath()
  c.moveTo(-5, 10)
  c.quadraticCurveTo(-6, 5, 2, 2)
  c.lineTo(12, 1)
  c.lineTo(13, 6)
  c.lineTo(2, 8)
  c.lineTo(-1, 12)
  c.closePath()
  c.fillStyle = fur
  c.fill()
  c.strokeStyle = '#76563f'
  c.lineWidth = 1.5
  c.stroke()
  const disk = (x: number, y: number, r: number, color: string) => {
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fillStyle = color
    c.fill()
  }
  box(-1, 0, 6, 10, '#334155')
  if (grade === 'F') {
    box(0, -4, 15, 7, '#94a3b8')
    box(15, -3, 4, 4, '#475569', 1)
    box(2, -6, 2, 2, '#334155', 0.5)
    c.fillStyle = '#e2e8f0'
    c.fillRect(2, -3, 10, 1)
  } else if (grade === 'E') {
    box(0, -5, 19, 8, '#244b45')
    box(18, -4, 6, 5, '#5d877f', 1)
    box(3, -7, 8, 2, '#a7f3d0', 0.5)
    c.fillStyle = glow
    c.fillRect(3, -2, 13, 2)
    for (let i = 0; i < 3; i++) box(13 + i * 2, -5, 1, 3, '#bbf7d0', 0.2)
  } else if (grade === 'D') {
    box(0, -5, 16, 8, '#234e70')
    box(13, -5, 12, 5, '#94c9e0', 1)
    disk(8, -1, 5, '#183449')
    disk(8, -1, 3.5, glow)
    for (let i = 0; i < 6; i++)
      disk(
        8 + Math.cos((i * Math.PI) / 3) * 2.5,
        -1 + Math.sin((i * Math.PI) / 3) * 2.5,
        0.65,
        '#164e63',
      )
    c.fillStyle = '#e0f2fe'
    c.fillRect(16, -4, 7, 1)
  } else if (grade === 'C') {
    box(-5, -3, 7, 6, '#4c3b6b')
    box(0, -6, 18, 10, '#5b4780')
    box(3, -8, 10, 2, '#c4b5fd', 0.5)
    box(17, -4, 8, 5, '#a78bfa', 1)
    box(9, 3, 5, 8, '#4c3b6b')
    for (let i = 0; i < 4; i++) box(3 + i * 3, -3, 1, 4, glow, 0.2)
  } else if (grade === 'B') {
    box(-5, -5, 8, 9, '#702659')
    box(0, -6, 15, 11, '#963d85')
    disk(7, 5, 5, '#4a2144')
    disk(7, 5, 2.5, glow)
    for (let i = 0; i < 3; i++) box(14, -6 + i * 4, 11, 3, '#d3a0ce', 1)
    box(19, -7, 3, 13, '#702659', 1)
    disk(5, -2, 2, '#fdf4ff')
  } else if (grade === 'A') {
    box(-5, -6, 25, 12, '#7c3923', 5)
    box(17, -7, 8, 14, '#fb923c', 3)
    box(-4, -4, 5, 8, '#facc15', 2)
    box(4, -8, 8, 2, '#fdba74', 1)
    for (let i = 0; i < 3; i++) box(3 + i * 4, -4, 2, 8, i % 2 ? '#ffedd5' : '#f97316', 1)
    c.fillStyle = '#431407'
    c.fillRect(23, -3, 2, 6)
  } else {
    // 성운포: 떠 있는 쌍날과 발광 핵. 기존 총과 실루엣부터 다르다.
    c.shadowColor = glow
    c.shadowBlur = 5
    for (const sign of [-1, 1]) {
      c.beginPath()
      c.moveTo(-5, sign * 3)
      c.lineTo(8, sign * 8)
      c.lineTo(25, sign * 6)
      c.lineTo(16, sign * 2)
      c.lineTo(2, sign * 1)
      c.closePath()
      c.fillStyle = '#164e63'
      c.fill()
      c.strokeStyle = glow
      c.lineWidth = 1.2
      c.stroke()
    }
    disk(9, 0, 5, '#a78bfa')
    disk(9, 0, 3.5, '#ecfeff')
    disk(20, 0, 1.5, glow)
    c.shadowBlur = 0
    c.beginPath()
    c.ellipse(9, 0, 7, 3, -0.6, 0, Math.PI * 2)
    c.strokeStyle = '#f0abfc'
    c.lineWidth = 1
    c.stroke()
  }
  for (const [x, y] of [
    [1, 7],
    [11, 4],
  ]) {
    c.beginPath()
    c.ellipse(x, y, 3.7, 3.1, -0.25, 0, Math.PI * 2)
    c.fillStyle = fur
    c.fill()
    c.strokeStyle = '#76563f'
    c.lineWidth = 1.3
    c.stroke()
  }
}
