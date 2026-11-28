import type { GunGrade } from '@web/features/game/cat/draw'

/** 총구가 오른쪽을 향하는 96×48 원화. 장비 카드와 전투에서 같은 외형을 쓴다. */
export function drawApexWeapon(
  c: CanvasRenderingContext2D,
  grade: GunGrade,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (grade !== 'SR' && grade !== 'UR' && grade !== 'LR') return false
  c.save()
  c.translate(x, y)
  c.scale(w / 96, h / 48)
  c.lineJoin = 'round'
  const plate = (shape: string, metal: string, edge: string) => {
    const path = new Path2D(shape)
    const finish = c.createLinearGradient(0, 4, 0, 45)
    finish.addColorStop(0, edge)
    finish.addColorStop(0.46, metal)
    finish.addColorStop(0.53, '#202236')
    finish.addColorStop(1, metal)
    c.fillStyle = finish
    c.fill(path)
    c.strokeStyle = edge
    c.lineWidth = 1.8
    c.stroke(path)
  }
  const ring = (cx: number, cy: number, rx: number, ry: number, color: string, width: number) => {
    c.beginPath()
    c.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI)
    c.strokeStyle = color
    c.lineWidth = width
    c.stroke()
  }
  plate('M2 19 L26 13 L38 20 L32 32 L22 45 L14 43 L18 30 L2 33 Z', '#51556d', '#aeb7ce')
  if (grade === 'SR') {
    // 회전 날을 받치는 갈퀴와 비어 있는 원반 중심.
    plate(
      'M16 19 L35 7 L70 3 L89 10 L64 9 L46 18 L41 29 L66 36 L90 30 L76 43 L43 40 L18 30 Z',
      '#ae304d',
      '#ffb6c3',
    )
    ring(69, 23, 16, 16, '#ff7593', 4)
    for (let i = 0; i < 4; i++) {
      c.save()
      c.translate(69, 23)
      c.rotate((Math.PI * i) / 2)
      plate('M5 -3 Q12 -12 22 -8 L14 0 L6 4 Z', '#e84a69', '#ffe2e8')
      c.restore()
    }
  } else if (grade === 'UR') {
    plate('M12 16 L33 7 L55 10 L62 15 L93 13 L93 19 L52 22 L42 31 L21 32 Z', '#116963', '#acffe5')
    plate('M33 30 L54 24 L93 24 L90 32 L53 37 L32 35 Z', '#238580', '#71fbe9')
    for (const cx of [45, 58, 71]) ring(cx, 22, 5, 14, '#70ffae', 3)
    plate('M22 21 L32 14 L39 20 L30 27 Z', '#21dbab', '#dcfff1')
  } else {
    // 일식 핵 위로 펼쳐지는 왕관과 금빛 궤도.
    plate(
      'M12 25 L7 6 L28 16 L25 3 L47 16 L58 2 L65 14 L87 6 L79 18 L95 21 L80 26 L91 37 L66 31 L54 44 L43 32 L21 38 Z',
      '#b27521',
      '#ffe49b',
    )
    ring(59, 22, 23, 16, '#ffcb51', 3)
    c.fillStyle = '#231735'
    c.beginPath()
    c.arc(59, 22, 11, 0, Math.PI * 2)
    c.fill()
    ring(59, 22, 11, 11, '#fff4b7', 3)
    plate('M73 21 L94 18 L93 24 L73 26 Z', '#fff0a0', '#fffbe5')
  }
  c.restore()
  return true
}
