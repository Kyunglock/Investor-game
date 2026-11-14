import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox'] })
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    for (const mode of ['assault', 'defense']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion })
      if (process.env.WALL_SHOTS) {
        await page.exposeFunction('captureWallBreak', () =>
          page.screenshot({ path: `/tmp/wall-break-${mode}-${reducedMotion}.png` }),
        )
      }
      await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5319/app/')
      const result = await page.evaluate(async (mode) => {
        const [{ startBattle }, cards, { DEFAULT_WEAPON }, { catMuzzle }] = await Promise.all([
          import('/app/src/mental/battle.ts'),
          import('/app/src/mental/cards.ts'),
          import('/app/src/mental/hero.ts'),
          import('/app/src/mental/catModels.ts'),
        ])
        const manager = window.Phaser.Scenes.SceneManager.prototype
        const original = manager.create
        let scene
        manager.create = function (value) {
          scene = value
          return original.call(this, value)
        }
        const host = document.createElement('div')
        host.style.cssText = 'position:fixed;inset:0;z-index:99999'
        document.body.append(host)
        let ready
        const loaded = new Promise((resolve) => {
          ready = resolve
        })
        let loadout = cards.loadoutOf(DEFAULT_WEAPON)
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
        loadout = cards.applyCard(loadout, cards.mateCard(loadout.mates))
        handle.applyLoadout(loadout)
        manager.create = original
        const mate = scene.mates[0]
        scene.tweens.killTweensOf(mate.body)
        mate.drop = 0
        mate.kick = 0
        scene.updateMates(0, 0.016, [])
        const mateY = mate.body.y
        const wallY = scene.buyWallY()
        const size = { width: scene.player.displayWidth, height: scene.player.displayHeight }
        const muzzle = catMuzzle('hero', scene.player.x, scene.player.y)
        scene.fire(1000, { x: muzzle.x, y: 0 })
        const shot = scene.bullets.getChildren().find((b) => b.active)
        const originMatches = shot.fromX === muzzle.x && shot.fromY === muzzle.y
        // Newly set recoil must not pull the other cat upward before the next frame.
        scene.updateMates(1000, 0.016, [])
        const mateIndependent = mate.body.y === mateY
        scene.player.y += 2
        const wallIndependent = scene.buyWallY() === wallY
        scene.player.y -= 2
        let fixedPose = true
        let maxRecoil = 0
        scene.lastFire = 1e9
        mate.lastFire = 1e9
        scene.paused = false
        for (let i = 0; i < 24; i++) {
          scene.update(i * 16, 16)
          fixedPose &&=
            scene.player.rotation === 0 &&
            mate.body.rotation === 0 &&
            scene.player.displayWidth === size.width &&
            scene.player.displayHeight === size.height &&
            mate.body.displayWidth === size.width &&
            mate.body.displayHeight === size.height
          maxRecoil = Math.max(maxRecoil, Math.abs(scene.player.y - scene.playerY()))
        }
        scene.paused = true
        let wallStable = true
        if (scene.buyWallFx) {
          scene.drawBuyWall()
          const surface = scene.buyWallFx.surface
          const position = { x: surface.x, y: surface.y }
          scene.buyWallFx.impact(surface.x + 40, false)
          for (let i = 0; i < 20; i++) {
            scene.buyWallFx.step(0.016, () => 0)
            scene.drawBuyWall()
            wallStable &&= surface.x === position.x && surface.y === position.y
          }
        }
        let shatter = null
        if (mode === 'assault') {
          scene.setSimSpeed(1)
          const wall = scene.walls.find((wall) => !wall.broken)
          wall.y = scene.stopY()
          wall.arrived = true
          scene.placeWall(wall)
          const cells = [...wall.cells]
          const source = cells[0]
          const texture = source.texture.key
          for (const cell of cells) scene.kill(cell, false)
          const pieces = scene.sellWallFx.pieces
          const initial = pieces.map((piece) => ({ x: piece.x, y: piece.y }))
          const textured = pieces.every((piece) => piece.texture.key === texture && piece.isCropped)
          const hidden = cells.every((cell) => !cell.active && !cell.body.enable)
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (window.captureWallBreak) await window.captureWallBreak()
          const moving = pieces.some(
            (piece, i) => piece.x !== initial[i].x || piece.y !== initial[i].y,
          )
          await new Promise((resolve) => setTimeout(resolve, 700))
          const cleared = pieces.every((piece) => !piece.visible)
          for (let i = 0; i < 10; i++) scene.sellWallFx.shatter(source, scene.reducedMotion)
          shatter = { textured, hidden, moving, cleared, pool: scene.sellWallFx.pieces.length }
        }
        handle.stop()
        return {
          originMatches,
          mateIndependent,
          wallIndependent,
          fixedPose,
          maxRecoil,
          wallStable,
          shatter,
        }
      }, mode)
      for (const key of [
        'originMatches',
        'mateIndependent',
        'wallIndependent',
        'fixedPose',
        'wallStable',
      ]) {
        assert.equal(result[key], true, `${mode}/${reducedMotion}: ${key}`)
      }
      assert(result.maxRecoil <= 1.8, 'small recoil only')
      if (reducedMotion === 'reduce') assert.equal(result.maxRecoil, 0)
      if (result.shatter) {
        assert.equal(result.shatter.textured, true)
        assert.equal(result.shatter.hidden, true)
        assert.equal(result.shatter.moving, reducedMotion !== 'reduce')
        assert.equal(result.shatter.cleared, true)
        assert.equal(result.shatter.pool, 48)
      }
      console.log(`PASS ${mode}/${reducedMotion}`, result)
      await page.close()
    }
  }
} finally {
  await browser.close()
}
