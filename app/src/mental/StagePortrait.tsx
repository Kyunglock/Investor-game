import { useEffect, useRef } from 'react'
import { STAGE_ASSETS } from './assets'
import { drawBattleGun } from './battleWeaponArt'
import { CAT_GUN, catGunPose } from './catGun'
import { CAT_SCALE } from './catModels'
import type { Weapon } from './hero'
import { drawSprite } from './stageArt'

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
      const pose = catGunPose('hero', 0, 0, -Math.PI / 4)
      ctx.save()
      ctx.translate(50 + pose.x / CAT_SCALE, 55 + pose.y / CAT_SCALE)
      ctx.rotate(pose.angle)
      ctx.translate(-CAT_GUN.pivotX, -CAT_GUN.pivotY)
      drawBattleGun(ctx, weapons, weapon.grade)
      ctx.restore()
      drawSprite(
        ctx,
        source,
        { x: 0, y: 0, w: source.width / 3, h: source.height },
        { x: 14, y: 3, w: 75, h: 100 },
        'height',
      )
    }
    source.onload = paint
    weapons.onload = paint
    source.src = STAGE_ASSETS.rigBodies
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
