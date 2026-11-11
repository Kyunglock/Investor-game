import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const out = resolve(import.meta.dirname, 'shots/cat-poses')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
try {
  for (const mode of ['defense', 'assault']) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5319/app/')
    const result = await page.evaluate(async (mode) => {
      const [{ startBattle }, cards, { DEFAULT_WEAPON }, { catMuzzle, mateModel }] =
        await Promise.all([
          import('/app/src/mental/battle.ts'),
          import('/app/src/mental/cards.ts'),
          import('/app/src/mental/hero.ts'),
          import('/app/src/mental/catModels.ts'),
        ])
      // 테스트에서만 생성된 씬을 관찰한다.
      const manager = window.Phaser.Scenes.SceneManager.prototype
      const create = manager.create
      let scene
      manager.create = function (value) {
        scene = value
        return create.call(this, value)
      }
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;inset:0;z-index:99999'
      document.body.append(host)
      let loadout = cards.loadoutOf(DEFAULT_WEAPON)
      let ready
      const loaded = new Promise((resolve) => {
        ready = resolve
      })
      const handle = startBattle(host, {
        mode,
        genre: 'DEFENSE',
        hero: { name: 'test', weapon: DEFAULT_WEAPON, upgrades: [] },
        loadout,
        onReady: () => setTimeout(ready, 0),
        onHud() {},
        onBanner() {},
        onHurt() {},
        onDone() {},
        onLevelUp() {},
      })
      await loaded
      handle.setPaused(true)
      const counts = [scene.mates.length]
      for (let i = 0; i < 4; i++) {
        loadout = cards.applyCard(loadout, cards.mateCard(loadout.mates))
        handle.applyLoadout(loadout)
        counts.push(scene.mates.length)
      }
      // 기존 업데이트로 합류 위치를 정렬한 뒤 정지한다.
      scene.paused = false
      scene.update(scene.time.now, 16)
      scene.paused = true
      const actors = [scene.player, ...scene.mates.map((mate) => mate.body)]
      const shots = []
      actors.forEach((body, i) => {
        scene.fire(scene.time.now + i, -Math.PI / 2, i ? scene.mates[i - 1] : undefined)
        const expected = catMuzzle(i ? mateModel(i - 1) : 'hero', body.x, body.y)
        const bullet = scene.bullets
          .getChildren()
          .find(
            (b) =>
              b.active &&
              Math.abs(b.fromX - expected.x) < 0.01 &&
              Math.abs(b.fromY - expected.y) < 0.01,
          )
        shots.push({ exists: Boolean(bullet), damage: bullet?.damage, vy: bullet?.body.velocity.y })
      })
      const textures = actors.map((body) =>
        scene.textures.get(body.texture.key).getSourceImage().toDataURL(),
      )
      const bounds = actors.map((body) => {
        const canvas = scene.textures.get(body.texture.key).getSourceImage()
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        let top = canvas.height,
          bottom = 0
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] > 128) {
              top = Math.min(top, y)
              bottom = Math.max(bottom, y)
            }
          }
        }
        return { height: bottom - top + 1, bottom }
      })
      window.catHandle = handle
      window.catPositions = () =>
        [scene.player, ...scene.mates.map((mate) => mate.body)].map((body) => ({
          x: body.x,
          y: body.y,
        }))
      manager.create = create
      return {
        counts,
        textures,
        bounds,
        shots,
        damage: cards.bulletStats(loadout).damage,
        noOverlay: !scene.textures.exists('gun') && !scene.textures.exists('mate-0-gun'),
      }
    }, mode)
    assert.deepEqual(result.counts, [0, 1, 2, 3, 3])
    assert.notEqual(result.textures[0], result.textures[1])
    assert.notEqual(result.textures[1], result.textures[2])
    assert.equal(result.textures[1], result.textures[3])
    assert(result.noOverlay)
    for (const field of ['height', 'bottom']) {
      const values = result.bounds.map((bound) => bound[field])
      assert(Math.max(...values) - Math.min(...values) <= 2, `고양이 ${field} 정렬`)
    }
    for (const shot of result.shots) {
      assert(shot.exists)
      assert.equal(shot.damage, result.damage)
      assert(shot.vy < 0)
    }
    await page.evaluate(() => window.catHandle.setPaused(false))
    await page.waitForTimeout(1800)
    await page.evaluate(() => window.catHandle.setPaused(true))
    await page.screenshot({ path: `${out}/${mode}-390.png` })
    await page.setViewportSize({ width: 320, height: 640 })
    await page.evaluate(() => window.catHandle.setPaused(false))
    await page.waitForTimeout(1800)
    await page.evaluate(() => window.catHandle.setPaused(true))
    for (const position of await page.evaluate(() => window.catPositions())) {
      assert(position.x > 0 && position.x < 320)
      assert(position.y > 0 && position.y < 640)
    }
    await page.screenshot({ path: `${out}/${mode}-320.png` })
    assert.deepEqual(errors, [])
    console.log(
      `PASS: ${mode}: original join count/cap, distinct models, no gun overlay, all four muzzle origins/damage`,
    )
    await page.evaluate(() => window.catHandle.stop())
    await page.close()
  }
} finally {
  await browser.close()
}
