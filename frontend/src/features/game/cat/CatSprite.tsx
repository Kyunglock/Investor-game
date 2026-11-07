import { useEffect, useRef } from 'react'
import { CAT_H, CAT_W, type CatLook, drawCat } from './draw'

/**
 * 고양이 한 마리를 캔버스에 그리는 컴포넌트 (decisions.md 341번). width(px)만 주면 높이는 비율대로(1.1배).
 * 화면 배율(devicePixelRatio)만큼 크게 그려 흐리지 않다. look이 바뀌면 다시 그린다.
 */
export function CatSprite({
  look,
  width,
  className,
  title,
  testId,
}: {
  look: CatLook
  width: number
  className?: string
  title?: string
  testId?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  // look의 내용을 열쇠로 쓴다: look 객체가 매번 새로 만들어져도 내용이 같으면 다시 그리지 않는다.
  const key = JSON.stringify(look)
  useEffect(() => {
    const cv = ref.current
    const c = cv?.getContext('2d')
    if (!cv || !c) {
      return
    }
    const dpr = Math.min(3, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
    const scale = (width / CAT_W) * dpr
    cv.width = Math.ceil(CAT_W * scale)
    cv.height = Math.ceil(CAT_H * scale)
    c.setTransform(scale, 0, 0, scale, 0, 0)
    c.clearRect(0, 0, CAT_W, CAT_H)
    drawCat(c, JSON.parse(key) as CatLook)
  }, [key, width])
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width, height: (width * CAT_H) / CAT_W, display: 'block' }}
      role="img"
      aria-label={title ?? '고양이'}
      data-testid={testId}
    />
  )
}
