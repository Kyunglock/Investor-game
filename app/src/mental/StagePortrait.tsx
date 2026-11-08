import { BOSS_LOOK } from '@web/features/game/cat/look'
import { useEffect, useRef } from 'react'
import { STAGE_ASSETS } from './assets'
import { drawStageGun } from './drawStageGun'
import type { Weapon } from './hero'
import { drawSprite } from './stageArt'

/** 준비 화면도 실제 전투에 쓰는 몸과 장착 무기를 조합한다. */
export function StagePortrait({ weapon }: { weapon: Weapon }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    let cancelled = false
    const source = new Image()
    source.onload = () => {
      if (cancelled) return
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      cv.width = 180 * dpr
      cv.height = 180 * dpr
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#628e6c33'
      ctx.beginPath()
      ctx.ellipse(90, 166, 40, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      drawSprite(
        ctx,
        source,
        { x: 0, y: 0, w: source.width, h: source.height },
        { x: 35, y: 10, w: 115, h: 155 },
      )
      ctx.translate(108, 116)
      ctx.rotate(-0.85)
      ctx.scale(1.7, 1.7)
      drawStageGun(ctx, BOSS_LOOK.fur, weapon.kind, weapon.grade)
    }
    source.src = STAGE_ASSETS.hero
    return () => {
      cancelled = true
    }
  }, [weapon.kind, weapon.grade])
  return (
    <canvas
      ref={ref}
      width="180"
      height="180"
      className="stage-portrait"
      role="img"
      aria-label={`사장냥 · ${weapon.gradeName} ${weapon.name}`}
    />
  )
}
