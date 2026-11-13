import { useEffect, useRef } from 'react'
import { STAGE_ASSETS } from './assets'
import type { Weapon } from './hero'
import { drawEquippedHero } from './weaponArt'

/** 준비 화면과 전투 모두 같은 장착 무기를 손 위치에 합성한다. */
export function StagePortrait({ weapon }: { weapon: Weapon }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    let cancelled = false
    const source = new Image()
    const weapons = new Image()
    const paint = () => {
      if (!source.complete || !source.naturalWidth || !weapons.complete || !weapons.naturalWidth)
        return
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
      drawEquippedHero(ctx, source, weapons, weapon.grade)
    }
    source.onload = paint
    weapons.onload = paint
    source.src = STAGE_ASSETS.hero
    weapons.src = STAGE_ASSETS.weapons
    return () => {
      cancelled = true
    }
  }, [weapon.grade])
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
