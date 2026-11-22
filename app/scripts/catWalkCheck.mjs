import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const output = resolve('../docs/mockups/2026-11-15-cat-walk')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 1,
  })
  await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5321/app/')
  const report = await page.evaluate(async () => {
    const [{ STAGE_ASSETS }, { MATE_LOOKS }, { drawCatPose }, { drawCatRun }] = await Promise.all([
      import('/app/src/mental/assets.ts'),
      import('/app/src/mental/mates.ts'),
      import('/app/src/mental/catPoseArt.ts'),
      import('/app/src/mental/catRunArt.ts'),
    ])
    const load = (src) =>
      new Promise((resolve, reject) => {
        const im = new Image()
        im.onload = () => resolve(im)
        im.onerror = reject
        im.src = src
      })
    const cats = [{ name: '사장냥', poses: 'heroPoses' }, ...MATE_LOOKS]
    const selected = [0, 1, 2, 19, 33, 39]
    document.body.replaceChildren()
    const cv = document.createElement('canvas')
    cv.width = 1440
    cv.height = 980
    cv.id = 'walk-preview'
    document.body.append(cv)
    document.body.style.cssText = 'margin:0;background:#fff3df'
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#fff3df'
    ctx.fillRect(0, 0, 1440, 980)
    const times = [],
      cached = []
    let count = 0,
      upperStable = true,
      shadowStable = true
    for (let catIndex = 0; catIndex < cats.length; catIndex++) {
      const cat = cats[catIndex],
        im = await load(STAGE_ASSETS[cat.poses])
      for (const aim of [0, 4, 8]) {
        const source = document.createElement('canvas')
        source.width = 300
        source.height = 330
        const paint = source.getContext('2d', { willReadFrequently: true })
        paint.scale(3, 3)
        drawCatPose(paint, im, aim, 'slot' in cat ? cat : undefined)
        const probe = document.createElement('canvas')
        probe.width = 100
        probe.height = 110
        const c = probe.getContext('2d', { willReadFrequently: true })
        let reference
        for (let frame = 0; frame < 8; frame++) {
          c.clearRect(0, 0, 100, 110)
          c.fillStyle = '#98633633'
          c.beginPath()
          c.ellipse(50, 102, 26, 5, 0, 0, Math.PI * 2)
          c.fill()
          const start = performance.now()
          drawCatRun(c, source, frame)
          times.push(performance.now() - start)
          const pixels = c.getImageData(0, 0, 100, 110).data
          if (frame === 0) reference = new Uint8ClampedArray(pixels)
          // Hands/head and the ground below the feet must be identical in every frame.
          for (let p = 0; p < 73 * 100 * 4; p++) if (pixels[p] !== reference[p]) upperStable = false
          for (let p = 105 * 100 * 4; p < 110 * 100 * 4; p++)
            if (pixels[p] !== reference[p]) shadowStable = false
          if (aim === 4 && selected.includes(catIndex)) {
            const row = selected.indexOf(catIndex)
            ctx.fillStyle = '#56371f'
            ctx.font = 'bold 16px sans-serif'
            ctx.fillText(cat.name, 8, row * 160 + 25)
            ctx.drawImage(probe, 130 + frame * 160, row * 160 + 25, 130, 143)
          }
          const reuse = performance.now()
          drawCatRun(c, source, frame)
          cached.push(performance.now() - reuse)
          count++
        }
      }
    }
    return {
      count,
      upperStable,
      shadowStable,
      maxColdMs: Math.max(...times),
      meanColdMs: times.reduce((a, b) => a + b, 0) / times.length,
      maxCachedMs: Math.max(...cached),
    }
  })
  assert.equal(report.count, 46 * 3 * 8)
  assert.equal(report.upperStable, true, 'Head and gun-gripping hands remain stationary')
  assert.equal(report.shadowStable, true, 'Ground shadow remains intact and stationary')
  await page.locator('#walk-preview').screenshot({ path: resolve(output, 'walk-frames.png') })
  console.log(JSON.stringify(report))
} finally {
  await browser.close()
}
