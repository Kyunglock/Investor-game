/** 전투 텍스처용 벡터 원화. 기존 크기·원점·충돌 영역을 유지한다. */
type Paint = CanvasRenderingContext2D

function shape(c: Paint, points: number[][], fill: string, edge?: string) {
  c.beginPath()
  points.forEach(([x, y], i) => {
    if (i) c.lineTo(x, y)
    else c.moveTo(x, y)
  })
  c.closePath()
  c.fillStyle = fill
  c.fill()
  if (edge) {
    c.strokeStyle = edge
    c.lineWidth = 1.2
    c.stroke()
  }
}

export function drawTracer(c: Paint, look: number) {
  const trail = c.createLinearGradient(0, 0, 30, 0)
  trail.addColorStop(0, '#f5aa3000')
  trail.addColorStop(0.6, '#ffb33488')
  trail.addColorStop(1, '#fff4bb')
  c.fillStyle = trail
  c.beginPath()
  c.moveTo(0, 5)
  c.lineTo(23, look ? 0.8 : 1.6)
  c.quadraticCurveTo(33, 5, 23, look ? 9.2 : 8.4)
  c.closePath()
  c.fill()
  c.fillStyle = '#85532d'
  c.beginPath()
  c.roundRect(13, 2, 16, 6, 3)
  c.fill()
  c.fillStyle = '#ffcf62'
  c.beginPath()
  c.roundRect(12, 1.8, 16, 5, 2.5)
  c.fill()
  c.fillStyle = '#fffde7'
  c.beginPath()
  c.roundRect(15, 2.4, 12, 2, 1)
  c.fill()
}

export function drawImpact(c: Paint) {
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7
    c.save()
    c.translate(40, 40)
    c.rotate(a)
    shape(
      c,
      [
        [13, -2],
        [35 + (i % 3), -1],
        [21, 3],
      ],
      '#ffbd57',
    )
    c.restore()
  }
  shape(
    c,
    [
      [40, 17],
      [45, 31],
      [61, 25],
      [51, 39],
      [63, 49],
      [46, 47],
      [39, 64],
      [34, 48],
      [18, 51],
      [28, 39],
      [21, 27],
      [35, 31],
    ],
    '#ffdf83',
    '#e59840',
  )
  shape(
    c,
    [
      [40, 27],
      [44, 36],
      [53, 40],
      [44, 44],
      [39, 53],
      [35, 44],
      [27, 40],
      [36, 36],
    ],
    '#fffdf0',
  )
}

export function drawWater(c: Paint) {
  const g = c.createLinearGradient(0, 0, 30, 20)
  g.addColorStop(0, '#84efff33')
  g.addColorStop(0.45, '#46d9ef')
  g.addColorStop(1, '#1677b9')
  c.beginPath()
  c.moveTo(1, 10)
  c.bezierCurveTo(13, 9, 15, 0, 24, 3)
  c.bezierCurveTo(34, 6, 31, 18, 23, 18)
  c.bezierCurveTo(12, 18, 12, 12, 1, 10)
  c.fillStyle = g
  c.fill()
  c.strokeStyle = '#175e92'
  c.lineWidth = 1
  c.stroke()
  c.beginPath()
  c.moveTo(9, 10)
  c.bezierCurveTo(21, 11, 16, 3, 26, 6)
  c.strokeStyle = '#e1ffff'
  c.lineWidth = 2
  c.stroke()
  c.beginPath()
  c.arc(25, 9, 2, 0, Math.PI * 2)
  c.fillStyle = '#ffffff'
  c.fill()
}

export function drawWave(c: Paint) {
  c.beginPath()
  c.moveTo(3, 5)
  c.bezierCurveTo(41, 24, 52, 87, 4, 116)
  c.bezierCurveTo(23, 82, 22, 38, 3, 5)
  const g = c.createLinearGradient(0, 0, 44, 0)
  g.addColorStop(0, '#1a7eae00')
  g.addColorStop(0.4, '#168fbeaa')
  g.addColorStop(0.8, '#49dfe8')
  g.addColorStop(1, '#e8ffff')
  c.fillStyle = g
  c.fill()
  for (let i = 0; i < 3; i++) {
    c.beginPath()
    c.moveTo(5 + i * 3, 12 + i * 10)
    c.bezierCurveTo(35 + i * 3, 39, 37 + i * 3, 78, 7 + i * 2, 109 - i * 7)
    c.strokeStyle = i === 0 ? '#f0ffff' : '#a2f6f5aa'
    c.lineWidth = i === 0 ? 3 : 1.4
    c.stroke()
  }
  for (let i = 0; i < 9; i++) {
    const a = -1.1 + i * 0.27
    c.beginPath()
    c.ellipse(5 + Math.cos(a) * 31, 60 + Math.sin(a) * 51, 2.3, 3.2, -a, 0, Math.PI * 2)
    c.fillStyle = i % 2 ? '#f1ffff' : '#8cf0f4'
    c.fill()
  }
}

export function drawEmber(c: Paint) {
  c.beginPath()
  c.moveTo(14, 1)
  c.bezierCurveTo(18, 8, 25, 7, 25, 17)
  c.bezierCurveTo(26, 30, 1, 29, 3, 16)
  c.quadraticCurveTo(5, 10, 5, 7)
  c.lineTo(10, 12)
  c.quadraticCurveTo(16, 8, 14, 1)
  const g = c.createLinearGradient(0, 0, 0, 28)
  g.addColorStop(0, '#ffbc48')
  g.addColorStop(0.5, '#ff7530')
  g.addColorStop(1, '#c83c29')
  c.fillStyle = g
  c.fill()
  c.strokeStyle = '#bd432b'
  c.lineWidth = 1
  c.stroke()
  c.beginPath()
  c.moveTo(15, 8)
  c.bezierCurveTo(16, 16, 23, 17, 19, 23)
  c.bezierCurveTo(10, 29, 5, 20, 11, 16)
  c.quadraticCurveTo(15, 14, 15, 8)
  c.fillStyle = '#ffe180'
  c.fill()
  c.beginPath()
  c.ellipse(14, 21, 3, 4, 0, 0, Math.PI * 2)
  c.fillStyle = '#fff9d8'
  c.fill()
}

export function drawPillar(c: Paint) {
  c.beginPath()
  c.moveTo(6, 139)
  c.bezierCurveTo(-2, 103, 18, 94, 8, 66)
  c.lineTo(19, 83)
  c.bezierCurveTo(8, 46, 36, 29, 25, 3)
  c.bezierCurveTo(51, 32, 27, 57, 36, 73)
  c.lineTo(44, 51)
  c.bezierCurveTo(51, 87, 38, 101, 44, 139)
  c.closePath()
  const g = c.createLinearGradient(0, 140, 0, 0)
  g.addColorStop(0, '#ffdc73')
  g.addColorStop(0.45, '#ff8f32')
  g.addColorStop(1, '#e44d2b44')
  c.fillStyle = g
  c.fill()
  c.beginPath()
  c.moveTo(13, 140)
  c.bezierCurveTo(9, 114, 30, 98, 22, 63)
  c.bezierCurveTo(43, 90, 25, 115, 36, 140)
  c.closePath()
  c.fillStyle = '#ffedab'
  c.fill()
  c.beginPath()
  c.moveTo(19, 140)
  c.quadraticCurveTo(28, 119, 26, 105)
  c.lineTo(30, 140)
  c.fillStyle = '#fffbe4'
  c.fill()
}

/** 기존 공성 수레에 암석 장갑과 호박색 마력 균열을 입힌다. */
export function drawEarthArmor(c: Paint) {
  shape(
    c,
    [
      [7, 11],
      [19, 7],
      [31, 12],
      [30, 24],
      [12, 27],
      [5, 21],
    ],
    '#a79170',
    '#594631',
  )
  shape(
    c,
    [
      [11, 28],
      [28, 25],
      [44, 29],
      [42, 39],
      [23, 42],
      [8, 37],
    ],
    '#806e56',
    '#594631',
  )
  shape(
    c,
    [
      [32, 9],
      [45, 10],
      [49, 21],
      [40, 28],
      [31, 22],
    ],
    '#c6b18c',
    '#594631',
  )
  shape(
    c,
    [
      [7, 11],
      [19, 7],
      [31, 12],
      [23, 15],
    ],
    '#dfceaa',
  )
  c.beginPath()
  c.moveTo(14, 13)
  c.lineTo(22, 19)
  c.lineTo(19, 29)
  c.lineTo(29, 35)
  c.moveTo(22, 19)
  c.lineTo(37, 17)
  c.lineTo(41, 24)
  c.strokeStyle = '#634724'
  c.lineWidth = 4
  c.stroke()
  c.strokeStyle = '#ffd46d'
  c.lineWidth = 1.6
  c.stroke()
  shape(
    c,
    [
      [65, 12],
      [84, 24],
      [65, 35],
      [71, 24],
    ],
    '#ad9170',
    '#594631',
  )
  shape(
    c,
    [
      [65, 12],
      [84, 24],
      [71, 24],
    ],
    '#ead4ab',
  )
  c.beginPath()
  c.moveTo(66, 24)
  c.lineTo(78, 24)
  c.strokeStyle = '#ffe79a'
  c.lineWidth = 2
  c.stroke()
}

/** 한 덩어리인 매도벽의 실제 가로 비율로 굽는다. */
export function drawSellCell(c: Paint, crack: number) {
  const g = c.createLinearGradient(0, 0, 0, 60)
  g.addColorStop(0, crack >= 2 ? '#7093b9' : '#99d6ef')
  g.addColorStop(0.28, crack >= 2 ? '#456787' : '#558bb7')
  g.addColorStop(1, '#263e67')
  c.beginPath()
  if (crack === 3) {
    c.moveTo(4, 4)
    c.lineTo(291, 4)
    c.lineTo(302, 16)
    c.lineTo(320, 6)
    c.lineTo(356, 4)
    c.lineTo(356, 56)
    c.lineTo(65, 56)
    c.lineTo(44, 43)
    c.lineTo(26, 56)
    c.lineTo(4, 56)
    c.closePath()
  } else c.roundRect(3, 3, 354, 54, 6)
  c.fillStyle = g
  c.fill()
  c.strokeStyle = '#172e51'
  c.lineWidth = 3
  c.stroke()
  c.save()
  c.clip()
  c.fillStyle = '#10274766'
  c.fillRect(3, 47, 354, 10)
  c.fillStyle = '#d1f4ff99'
  c.fillRect(8, 6, 344, 2)
  // 한 덩어리의 장갑판. 중앙 물량 표시는 균열이 지나가지 않게 비운다.
  for (const x of [65, 110, 250, 295]) {
    c.fillStyle = '#19345166'
    c.fillRect(x, 10, 2, 37)
    c.fillStyle = '#b5e7ff33'
    c.fillRect(x + 2, 10, 1, 37)
  }
  c.fillStyle = '#132e5399'
  c.beginPath()
  c.roundRect(117, 14, 126, 31, 5)
  c.fill()
  c.strokeStyle = '#b5e7ff55'
  c.lineWidth = 1
  c.stroke()
  for (const x of [17, 343]) {
    for (const y of [16, 42]) {
      c.fillStyle = '#153659'
      c.beginPath()
      c.arc(x, y, 3, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#b9def1'
      c.beginPath()
      c.arc(x - 0.5, y - 0.7, 1.2, 0, Math.PI * 2)
      c.fill()
    }
  }
  c.strokeStyle = '#a7e2ec99'
  c.lineWidth = 2
  for (const x of [34, 312]) {
    c.beginPath()
    c.moveTo(x, 22)
    c.lineTo(x + 9, 30)
    c.lineTo(x, 38)
    c.stroke()
  }
  const lines = [
    [
      [80, 0],
      [73, 15],
      [87, 24],
      [76, 42],
      [83, 60],
    ],
    [
      [287, 0],
      [272, 18],
      [280, 29],
      [266, 40],
      [277, 60],
    ],
    [
      [0, 30],
      [38, 27],
      [76, 42],
      [100, 33],
      [114, 40],
    ],
    [
      [245, 35],
      [266, 40],
      [306, 27],
      [360, 36],
    ],
  ]
  for (const line of lines.slice(0, crack === 3 ? 4 : crack)) {
    c.beginPath()
    line.forEach(([x, y], i) => {
      if (i) c.lineTo(x, y)
      else c.moveTo(x, y)
    })
    c.strokeStyle = '#0e233e'
    c.lineWidth = 4
    c.stroke()
    c.strokeStyle = crack === 3 ? '#ffc678' : '#9dd8e1'
    c.lineWidth = 1
    c.stroke()
  }
  c.restore()
}
