import type { GunGrade, GunKind } from '@web/features/game/cat/draw'
import { useEffect, useRef } from 'react'
import { STAGE_ASSETS } from './assets'
import { drawInventoryGun } from './weaponArt'

/** 인벤토리는 무기만 중앙에 배치한다. 전투의 손·자세와 분리된 그림 영역. */
const BOX_W = 96
const BOX_H = 72

/** 목록·장착 정보·뽑기 카드에서 쓰는 손 없는 무기 아이콘. */
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
    let cancelled = false
    const source = new Image()
    source.onload = () => {
      if (cancelled) return
      c.setTransform(scale, 0, 0, scale, 0, 0)
      c.clearRect(0, 0, BOX_W, BOX_H)
      drawInventoryGun(c, source, grade)
    }
    source.src = STAGE_ASSETS.weapons
    return () => {
      cancelled = true
    }
  }, [grade, width])
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
