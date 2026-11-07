import { drawGun, type GunGrade, type GunKind } from '@web/features/game/cat/draw'
import { BOSS_LOOK } from '@web/features/game/cat/look'
import { useEffect, useRef } from 'react'

/** 무기 그림 상자(상자 좌표 -8..26 × -8..14, draw.ts drawGun). */
const BOX_W = 34
const BOX_H = 22

/** 무기 하나를 캔버스에 그린다 (decisions.md 346번): 무기 고르기와 떨어진 무기 카드에. 사장냥 앞발이 쥔 모습 그대로. */
export function GunSprite({
  kind,
  grade,
  width,
  className,
}: {
  kind: GunKind
  grade: GunGrade
  width: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const c = cv?.getContext('2d')
    if (!cv || !c) {
      return
    }
    const dpr = Math.min(3, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)
    const scale = (width / BOX_W) * dpr
    cv.width = Math.ceil(BOX_W * scale)
    cv.height = Math.ceil(BOX_H * scale)
    c.setTransform(scale, 0, 0, scale, 0, 0)
    c.clearRect(0, 0, BOX_W, BOX_H)
    c.translate(8, 8)
    drawGun(c, BOSS_LOOK.fur, kind, grade)
  }, [kind, grade, width])
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width, height: (width * BOX_H) / BOX_W, display: 'block' }}
      role="img"
      aria-label={`${kind} ${grade}`}
      data-testid="gun-sprite"
    />
  )
}
