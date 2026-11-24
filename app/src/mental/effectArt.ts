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

/** 얼음 창 (561번): 오른쪽(나아가는 쪽)이 뾰족한 결정. 44×16. */
export function drawIceLance(c: Paint) {
  const g = c.createLinearGradient(0, 0, 44, 0)
  g.addColorStop(0, '#bff2ff22')
  g.addColorStop(0.35, '#8fe3f5')
  g.addColorStop(1, '#f4fdff')
  shape(
    c,
    [
      [1, 8],
      [12, 3],
      [30, 2],
      [43, 8],
      [30, 14],
      [12, 13],
    ],
    '#135a78',
  )
  c.beginPath()
  c.moveTo(3, 8)
  c.lineTo(13, 4.4)
  c.lineTo(29.5, 3.5)
  c.lineTo(40.5, 8)
  c.lineTo(29.5, 12.5)
  c.lineTo(13, 11.6)
  c.closePath()
  c.fillStyle = g
  c.fill()
  shape(
    c,
    [
      [3, 8],
      [15, 2],
      [11, 8],
    ],
    '#85ccf8',
    '#3977a2',
  )
  shape(
    c,
    [
      [13, 10],
      [22, 15],
      [30, 9],
    ],
    '#b4e7ff',
    '#3977a2',
  )
  // 결정의 모서리와 반짝임.
  c.beginPath()
  c.moveTo(13, 4.4)
  c.lineTo(20, 8)
  c.lineTo(13, 11.6)
  c.moveTo(20, 8)
  c.lineTo(40.5, 8)
  c.strokeStyle = '#ffffffcc'
  c.lineWidth = 1
  c.stroke()
  c.beginPath()
  c.arc(31, 6, 1.4, 0, Math.PI * 2)
  c.fillStyle = '#ffffff'
  c.fill()
}

/** 돌풍 (561번): 큰 물결과 같은 초승달 꼴에 옅은 풀빛 바람 줄기. 44×120. */
export function drawGust(c: Paint) {
  c.beginPath()
  c.moveTo(3, 5)
  c.bezierCurveTo(41, 24, 52, 87, 4, 116)
  c.bezierCurveTo(23, 82, 22, 38, 3, 5)
  const g = c.createLinearGradient(0, 0, 44, 0)
  g.addColorStop(0, '#2f9d7400')
  g.addColorStop(0.45, '#7fd8a888')
  g.addColorStop(0.85, '#c5f5d6cc')
  g.addColorStop(1, '#f4fff7')
  c.fillStyle = g
  c.fill()
  for (let i = 0; i < 4; i++) {
    c.beginPath()
    c.moveTo(4 + i * 3, 10 + i * 9)
    c.bezierCurveTo(33 + i * 3, 38, 35 + i * 3, 80, 6 + i * 2, 111 - i * 8)
    c.strokeStyle = i === 0 ? '#ffffff' : '#dcffe8cc'
    c.lineWidth = i === 0 ? 2.6 : 1.3
    c.stroke()
  }
  // 넓게 감기는 두 번째 리본과 휘말려 올라간 잎.
  c.beginPath()
  c.moveTo(2, 87)
  c.bezierCurveTo(44, 82, 35, 45, 12, 48)
  c.bezierCurveTo(34, 57, 27, 76, 2, 87)
  c.fillStyle = '#adf5d7'
  c.fill()
  shape(
    c,
    [
      [5, 29],
      [13, 25],
      [17, 17],
      [9, 20],
    ],
    '#86cf83',
    '#42806d',
  )
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
