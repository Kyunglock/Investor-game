import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const output = resolve(
  import.meta.dirname,
  '../../docs/mockups/2026-11-14-cat-poses/game-poses.png',
)
mkdirSync(dirname(output), { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: 1610, height: 1200 },
    deviceScaleFactor: 1,
  })
  page.on('pageerror', (e) => console.log(e.message))
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5319/app/')
  await page.evaluate(async () => {
    const [
      { STAGE_ASSETS },
      { drawCatPose },
      { drawBattleGun },
      { catGunPose, CAT_GUN },
      { CAT_SCALE, mateModel },
      { catPoseAngle },
      { MATE_LOOKS },
    ] = await Promise.all([
      import('/app/src/mental/assets.ts'),
      import('/app/src/mental/catPoseArt.ts'),
      import('/app/src/mental/battleWeaponArt.ts'),
      import('/app/src/mental/catGun.ts'),
      import('/app/src/mental/catModels.ts'),
      import('/app/src/mental/catPose.ts'),
      import('/app/src/mental/mates.ts'),
    ])
    const load = (src) =>
      new Promise((resolve) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.src = src
      })
    const weapons = await load(STAGE_ASSETS.battleWeapons)
    const cats = [{ name: '사장냥', poses: 'heroPoses' }, ...MATE_LOOKS]
    const host = document.createElement('div')
    host.style.cssText =
      'position:absolute;inset:0;z-index:99999;background:#fff3df;min-height:1200px;'
    document.body.append(host)
    const cv = document.createElement('canvas')
    cv.width = 1610
    cv.height = 1200
    host.append(cv)
    const c = cv.getContext('2d')
    c.fillStyle = '#fff3df'
    c.fillRect(0, 0, 1610, 1200)
    c.textAlign = 'center'
    c.font = 'bold 16px sans-serif'
    c.fillStyle = '#56371f'
    for (let i = 0; i < 9; i++)
      c.fillText(
        ['좌60', '좌45', '좌30', '좌15', '정면', '우15', '우30', '우45', '우60'][i],
        i * 170 + 125,
        24,
      )
    for (let r = 0; r < cats.length; r++) {
      const source = await load(STAGE_ASSETS[cats[r].poses])
      c.font = 'bold 13px sans-serif'
      c.fillStyle = '#56371f'
      c.textAlign = 'left'
      c.fillText(cats[r].name, 8, 52 + r * 160)
      for (let i = 0; i < 9; i++) {
        c.save()
        c.translate(i * 170 + 64, 55 + r * 160)
        c.scale(1.15, 1.15)
        const p = catGunPose(r ? mateModel(r - 1) : 'hero', 0, 0, catPoseAngle(i))
        c.save()
        c.translate(50 + p.x / CAT_SCALE, 55 + p.y / CAT_SCALE)
        c.rotate(p.angle)
        c.translate(-CAT_GUN.pivotX, -CAT_GUN.pivotY)
        drawBattleGun(c, weapons, 'A')
        c.restore()
        drawCatPose(c, source, i)
        c.restore()
      }
    }
  })
  await page.screenshot({ path: output, fullPage: true })
} finally {
  await browser.close()
}
