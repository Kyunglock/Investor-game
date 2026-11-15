import { CAT_RUN_FRAMES } from './catRun'

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

/** 발목을 자르지 않는다. 골반 아래에서 시작해 발끝으로 갈수록 부드럽게 발을 든다. */
export function catRunSourceY(x: number, y: number, frame: number) {
  const step = Math.sin((frame / CAT_RUN_FRAMES) * Math.PI * 2)
  const right = smooth((x - 35) / 30)
  const lift = 3.2 * (Math.max(0, step) * (1 - right) + Math.max(0, -step) * right)
  // 목적지에서 원본으로 역매핑하므로 발을 들어도 빈 행이나 겹친 절단면이 생기지 않는다.
  let source = y
  for (let i = 0; i < 5; i++) source = y + lift * smooth((source - 74) / 29)
  return source
}

// 같은 해상도·프레임의 변형 좌표는 모든 고양이가 공유한다.
const mappings = new Map<string, Float32Array>()
function mapping(width: number, height: number, frame: number) {
  const key = `${width}-${height}-${frame}`
  let values = mappings.get(key)
  if (!values) {
    values = new Float32Array(width * height)
    const scaleY = height / 110
    for (let y = Math.floor(74 * scaleY); y < height; y++)
      for (let x = 0; x < width; x++)
        values[y * width + x] =
          catRunSourceY(((x + 0.5) * 100) / width, (y + 0.5) / scaleY, frame) * scaleY - 0.5
    mappings.set(key, values)
  }
  return values
}

/** 알파를 포함해 보간한다. 투명한 다리 사이의 RGB가 윤곽에 번지지 않게 premultiplied alpha를 쓴다. */
export function warpCatRun(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  frame: number,
) {
  const output = new Uint8ClampedArray(pixels)
  const coordinates = mapping(width, height, frame)
  const scaleY = height / 110
  for (let y = Math.floor(74 * scaleY); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceY = coordinates[y * width + x]
      const top = Math.floor(sourceY)
      const mix = sourceY - top
      const dest = (y * width + x) * 4
      const a = (top * width + x) * 4
      const b = ((top + 1) * width + x) * 4
      const alphaA = top >= 0 && top < height ? pixels[a + 3] * (1 - mix) : 0
      const alphaB = top + 1 >= 0 && top + 1 < height ? pixels[b + 3] * mix : 0
      const alpha = alphaA + alphaB
      output[dest + 3] = alpha
      for (let channel = 0; channel < 3; channel++) {
        output[dest + channel] =
          alpha > 0
            ? ((alphaA ? pixels[a + channel] * alphaA : 0) +
                (alphaB ? pixels[b + channel] * alphaB : 0)) /
              alpha
            : 0
      }
    }
  }
  return output
}

// 원본 한 장당 현재 자세의 8프레임만 보관한다. 자세가 바뀌어 원본이 교체되면 함께 회수된다.
const frames = new WeakMap<HTMLCanvasElement, Map<number, HTMLCanvasElement>>()
export function drawCatRun(c: CanvasRenderingContext2D, source: HTMLCanvasElement, frame: number) {
  const index = ((frame % CAT_RUN_FRAMES) + CAT_RUN_FRAMES) % CAT_RUN_FRAMES
  if (index === 0) {
    c.drawImage(source, 0, 0, 100, 110)
    return
  }
  let cache = frames.get(source)
  if (!cache) {
    cache = new Map()
    frames.set(source, cache)
  }
  let canvas = cache.get(index)
  if (!canvas) {
    const pixels = source
      .getContext('2d', { willReadFrequently: true })
      ?.getImageData(0, 0, source.width, source.height)
    if (!pixels) return
    canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext('2d')
    if (!context) return
    pixels.data.set(warpCatRun(pixels.data, source.width, source.height, index))
    context.putImageData(pixels, 0, 0)
    cache.set(index, canvas)
  }
  c.drawImage(canvas, 0, 0, 100, 110)
}
