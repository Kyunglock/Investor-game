import { useEffect, useRef } from 'react'
import { STAGE_ASSETS } from './assets'
import { drawStageGun } from './drawStageGun'
import type { Weapon } from './hero'
import { drawSprite, STAGE_HERO } from './stageArt'

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
      ctx.translate(15, 4)
      ctx.scale(1.5, 1.5)
      ctx.fillStyle = '#98633633'
      ctx.beginPath()
      ctx.ellipse(50, 102, 26, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      drawSprite(
        ctx,
        source,
        { x: 0, y: 0, w: source.width, h: source.height },
        { x: 14, y: 3, w: 75, h: 100 },
      )
      ctx.translate(STAGE_HERO.gunX, STAGE_HERO.gunY)
      ctx.rotate(-Math.PI / 2)
      ctx.scale(STAGE_HERO.gunScale, STAGE_HERO.gunScale)
      drawStageGun(ctx, STAGE_HERO.fur, weapon.kind, weapon.grade)
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
