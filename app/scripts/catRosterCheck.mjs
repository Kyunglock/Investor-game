import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const output = resolve('../docs/mockups/2026-11-15-cat-roster-40')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5319/app/')
  const result = await page.evaluate(async () => {
    const [
      { STAGE_ASSETS },
      { drawCatPose },
      { drawBattleGun },
      { catGunPose, CAT_GUN },
      { CAT_SCALE, mateModel },
      { catPoseAngle },
      { MATE_LOOKS },
      { NEW_CATS, rosterCell },
      { spriteBounds },
    ] = await Promise.all([
      import('/app/src/mental/assets.ts'),
      import('/app/src/mental/catPoseArt.ts'),
      import('/app/src/mental/battleWeaponArt.ts'),
      import('/app/src/mental/catGun.ts'),
      import('/app/src/mental/catModels.ts'),
      import('/app/src/mental/catPose.ts'),
      import('/app/src/mental/mates.ts'),
      import('/app/src/mental/catRoster.ts'),
      import('/app/src/mental/stageArt.ts'),
    ])
    const load = (src) =>
      new Promise((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = () => reject(new Error(src))
        im.src = src
      })
    const weapons = await load(STAGE_ASSETS.battleWeapons)
    const portraits = await load((await import('/app/src/idle/assets/cat-portraits.png')).default)
    const cats = [{ name: '사장냥', poses: 'heroPoses' }, ...MATE_LOOKS]
    document.body.replaceChildren()
    document.body.style.cssText = 'margin:0;background:#fff3df'
    const frames = []
    for (let page = 0; page < 4; page++) {
      const cv = document.createElement('canvas')
      cv.width = 1600
      cv.height = 1400
      cv.id = `roster-${page}`
      cv.style.display = 'block'
      document.body.append(cv)
      const c = cv.getContext('2d')
      c.fillStyle = '#fff3df'
      c.fillRect(0, 0, cv.width, cv.height)
      for (let row = 0; row < 10; row++) {
        const index = page * 10 + row,
          cat = cats[index],
          source = await load(STAGE_ASSETS[cat.poses])
        c.fillStyle = '#56371f'
        c.font = 'bold 16px sans-serif'
        c.fillText(`${String(index + 1).padStart(2, '0')} ${cat.name}`, 12, row * 140 + 20)
        const portraitSource = index < 7 ? portraits : source
        const portraitCell =
          index < 7
            ? {
                x: ((index % 4) * portraits.width) / 4,
                y: (Math.floor(index / 4) * portraits.height) / 2,
                w: portraits.width / 4,
                h: portraits.height / 2,
              }
            : rosterCell(source, cat.atlas, cat.slot)
        const b = spriteBounds(portraitSource, portraitCell)
        const scale = Math.min(100 / b.w, 100 / b.h)
        c.drawImage(
          portraitSource,
          b.x,
          b.y,
          b.w,
          b.h,
          20 + (100 - b.w * scale) / 2,
          row * 140 + 30,
          b.w * scale,
          b.h * scale,
        )
        for (let pose = 0; pose < 9; pose++) {
          c.save()
          c.translate(150 + pose * 155, row * 140 + 25)
          const p = catGunPose(index ? mateModel(index - 1) : 'hero', 0, 0, catPoseAngle(pose))
          c.save()
          c.translate(50 + p.x / CAT_SCALE, 55 + p.y / CAT_SCALE)
          c.rotate(p.angle)
          c.translate(-CAT_GUN.pivotX, -CAT_GUN.pivotY)
          drawBattleGun(c, weapons, 'A')
          c.restore()
          drawCatPose(c, source, pose, index >= 7 ? cat : undefined)
          c.restore()
          if (index >= 7) {
            const bounds = spriteBounds(source, rosterCell(source, cat.atlas, cat.slot, pose))
            frames.push({ index, pose, width: bounds.w, height: bounds.h })
          }
        }
      }
    }
    return { count: cats.length, newCount: NEW_CATS.length, frames }
  })
  assert.equal(result.count, 40)
  assert.equal(result.newCount, 33)
  assert.equal(result.frames.length, 297)
  assert.ok(
    result.frames.every((f) => f.width > 20 && f.height > 20),
    'Every new combat cell contains a sprite',
  )
  for (let i = 0; i < 4; i++)
    await page
      .locator(`#roster-${i}`)
      .screenshot({ path: resolve(output, `in-game-${i * 10 + 1}-${i * 10 + 10}.png`) })
  console.log('PASS: 40 portraits, 360 composed aiming poses; all 297 new combat cells contain art')
} finally {
  await browser.close()
}
