import type { GunGrade, GunKind } from '@web/features/game/cat/draw'

/** 총구는 +x, 피벗은 뒷손. 무기 종류와 등급을 실제 장비에 맞춰 그린다. */
export function drawStageGun(
  c: CanvasRenderingContext2D,
  fur: string,
  kind: GunKind,
  grade: GunGrade,
) {
  const colors = { N: '#7f9db5', R: '#659cce', SR: '#aa91cb', UR: '#d7b16b' }
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
  box(-1, 0, 6, 10, '#607789')
  box(1, -5, 19, 8, colors[grade])
  if (kind === 'revolver') box(7, -4, 6, 8, '#c5d4dc', 3)
  if (kind === 'smg') {
    box(12, 3, 5, 7, '#607789')
    box(3, -7, 10, 2, '#46596b', 1)
  }
  if (kind === 'rifle') {
    box(12, -8, 8, 3, '#607789', 1)
    box(18, -4, 7, 5, '#607789', 1)
  } else if (kind === 'shotgun') {
    box(17, -5, 8, 9, '#607789')
    box(11, 1, 9, 4, '#bc9e76', 1)
  } else box(19, -3, 6, 4, '#607789', 1)
  c.fillStyle = '#dcebf0'
  c.fillRect(3, -3, 12, 1.5)
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
