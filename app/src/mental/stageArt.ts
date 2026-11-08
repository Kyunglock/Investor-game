type Rect = { x: number; y: number; w: number; h: number }
const bounds = new WeakMap<HTMLImageElement, Map<string, Rect>>()

/** 원본의 투명 여백만 제외해 기존 충돌 원 안에 맞춘다. 파일은 원본 그대로 보관한다. */
export function drawSprite(
  c: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cell: Rect,
  target: Rect,
) {
  let cache = bounds.get(image)
  if (!cache) {
    cache = new Map()
    bounds.set(image, cache)
  }
  const key = `${cell.x},${cell.y},${cell.w},${cell.h}`
  let crop = cache.get(key)
  if (!crop) {
    const cv = document.createElement('canvas')
    cv.width = cell.w
    cv.height = cell.h
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(image, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h)
    const rgba = ctx.getImageData(0, 0, cell.w, cell.h).data
    let left = cell.w,
      right = 0,
      top = cell.h,
      bottom = 0
    for (let y = 0; y < cell.h; y++)
      for (let x = 0; x < cell.w; x++) {
        if (rgba[(y * cell.w + x) * 4 + 3] > 24) {
          left = Math.min(left, x)
          right = Math.max(right, x)
          top = Math.min(top, y)
          bottom = Math.max(bottom, y)
        }
      }
    crop =
      right >= left && bottom >= top
        ? { x: cell.x + left, y: cell.y + top, w: right - left + 1, h: bottom - top + 1 }
        : cell
    cache.set(key, crop)
  }
  const scale = Math.min(target.w / crop.w, target.h / crop.h)
  const w = crop.w * scale,
    h = crop.h * scale
  c.drawImage(
    image,
    crop.x,
    crop.y,
    crop.w,
    crop.h,
    target.x + (target.w - w) / 2,
    target.y + (target.h - h) / 2,
    w,
    h,
  )
}

/** 화면이 작아져도 사장냥과 아래 조작 안내가 겹치지 않는 방어선. */
export const wallOffset = (height: number) => Math.max(150, Math.min(230, height * 0.26))

/** 전투용 반투명 멘탈벽. 앞쪽 방어선이 기존 충돌 영역(전체 폭 × 48px)에 맞고, 뒤쪽 유리 면은 장식이다. */
export function drawMentalWall(c: CanvasRenderingContext2D, cracked: boolean) {
  c.lineJoin = 'round'
  c.beginPath()
  c.moveTo(20, 18)
  c.quadraticCurveTo(256, -7, 492, 18)
  c.lineTo(492, 82)
  c.quadraticCurveTo(256, 57, 20, 82)
  c.closePath()
  c.fillStyle = cracked ? '#81d9d277' : '#69ded599'
  c.fill()
  c.lineWidth = 5
  c.strokeStyle = '#79eaf0'
  c.stroke()
  c.lineWidth = 2
  c.strokeStyle = '#f1ffff'
  c.stroke()
  for (const x of [4, 484]) {
    c.fillStyle = '#638ead'
    c.fillRect(x, 83, 24, 9)
    c.fillStyle = '#fff0d6'
    c.strokeStyle = '#aa9479'
    c.lineWidth = 2
    c.beginPath()
    c.roundRect(x, 15, 24, 70, 5)
    c.fill()
    c.stroke()
    c.beginPath()
    c.arc(x + 12, 10, 9, 0, Math.PI * 2)
    c.fill()
    c.stroke()
    c.fillStyle = '#719bb5'
    c.fillRect(x + 6, 39, 12, 22)
  }
  c.strokeStyle = '#f3ffff'
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(256, 23)
  c.lineTo(272, 29)
  c.lineTo(270, 44)
  c.quadraticCurveTo(266, 54, 256, 60)
  c.quadraticCurveTo(246, 54, 242, 44)
  c.lineTo(240, 29)
  c.closePath()
  c.stroke()
  c.fillStyle = '#f3ffff'
  c.beginPath()
  c.moveTo(256, 48)
  c.bezierCurveTo(235, 35, 251, 29, 256, 36)
  c.bezierCurveTo(261, 29, 277, 35, 256, 48)
  c.fill()
  if (cracked) {
    c.strokeStyle = '#fff8e4'
    c.lineWidth = 4
    for (const x of [118, 378]) {
      c.beginPath()
      c.moveTo(x, 12)
      c.lineTo(x - 6, 29)
      c.lineTo(x + 5, 42)
      c.lineTo(x - 8, 66)
      c.moveTo(x + 5, 42)
      c.lineTo(x + 21, 52)
      c.stroke()
      c.strokeStyle = '#559aa5'
      c.lineWidth = 1.5
      c.stroke()
    }
  }
}
