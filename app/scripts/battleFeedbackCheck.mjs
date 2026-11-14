import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const out = resolve(import.meta.dirname, 'shots/battle-feedback')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
try {
  for (const mode of ['defense', 'assault']) {
    for (const reduced of [true, false]) {
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: reduced ? 'reduce' : 'no-preference',
      })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5319/app/')
      const result = await page.evaluate(async (mode) => {
        const [{ startBattle }, cards, { DEFAULT_WEAPON }, { CAT_GUN }] = await Promise.all([
          import('/app/src/mental/battle.ts'),
          import('/app/src/mental/cards.ts'),
          import('/app/src/mental/hero.ts'),
          import('/app/src/mental/catGun.ts'),
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
          scene.fire(scene.time.now + i, { x: body.x, y: 0 }, i ? scene.mates[i - 1] : undefined)
          const gun = i ? scene.mates[i - 1].gun : scene.heroGun
          const expected = gun
            .getWorldTransformMatrix()
            .transformPoint(
              gun.width * ((CAT_GUN.pivotX + CAT_GUN.barrel) / CAT_GUN.w) - gun.displayOriginX,
              gun.height * 0.5 - gun.displayOriginY,
            )
          const bullet = scene.bullets
            .getChildren()
            .find(
              (b) =>
                b.active &&
                Math.abs(b.fromX - expected.x) < 0.01 &&
                Math.abs(b.fromY - expected.y) < 0.01,
            )
          const canvas = scene.textures.get(body.texture.key).getSourceImage()
          const local = body.getWorldTransformMatrix().applyInverse(expected.x, expected.y)
          const bx = Math.round(local.x + body.displayOriginX)
          const by = Math.round(local.y + body.displayOriginY)
          const muzzleClear =
            bx < 0 ||
            by < 0 ||
            bx >= canvas.width ||
            by >= canvas.height ||
            canvas.getContext('2d').getImageData(bx, by, 1, 1).data[3] < 128
          shots.push({
            gunBehindBody: gun.depth < body.depth,
            muzzleClear,
            exists: Boolean(bullet),
            damage: bullet?.damage,
            vy: bullet?.body.velocity.y,
          })
        })
        const textures = actors.map((body) =>
          scene.textures.get(body.texture.key).getSourceImage().toDataURL(),
        )
        const bounds = actors.map((body) => {
          const canvas = scene.textures.get(body.texture.key).getSourceImage()
          const pixels = canvas
            .getContext('2d')
            .getImageData(0, 0, canvas.width, canvas.height).data
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
        window.feedbackScene = scene
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
          separateGuns: scene.heroGun.active && scene.mates.every((m) => m.gun.active),
          bodiesUpright: actors.every((body) => body.rotation === 0),
        }
      }, mode)
      assert.deepEqual(result.counts, [0, 1, 2, 3, 3])
      assert.notEqual(result.textures[0], result.textures[1])
      assert.notEqual(result.textures[1], result.textures[2])

      assert(result.separateGuns)
      assert(result.bodiesUpright)
      for (const shot of result.shots) {
        assert(shot.exists)
        assert(shot.gunBehindBody)
        assert(shot.muzzleClear, '몸 뒤에 그린 총의 총구는 머리 밖에 노출')
        assert.equal(shot.damage, result.damage * 2)
        assert(shot.vy < 0)
      }
      await page.evaluate(() => window.catHandle.setPaused(false))
      await page.waitForTimeout(1800)
      await page.evaluate(() => window.catHandle.setPaused(true))
      await page.screenshot({ path: `${out}/${mode}-${reduced}-390.png` })
      await page.setViewportSize({ width: 320, height: 640 })
      await page.evaluate(() => window.catHandle.setPaused(false))
      await page.waitForTimeout(1800)
      await page.evaluate(() => window.catHandle.setPaused(true))
      for (const position of await page.evaluate(() => window.catPositions())) {
        assert(position.x > 0 && position.x < 320)
        assert(position.y > 0 && position.y < 640)
      }
      await page.screenshot({ path: `${out}/${mode}-${reduced}-320.png` })
      if (!reduced) {
        for (const targetX of [20, 160, 300]) {
          const aligned = await page.evaluate((x) => {
            const scene = window.feedbackScene
            const actors = [scene.player, ...scene.mates.map((m) => m.body)]
            for (const [i, body] of actors.entries()) {
              scene.fire(
                scene.time.now + i,
                { x, y: body.y - 120 },
                i ? scene.mates[i - 1] : undefined,
              )
            }
            return actors.every((body) => body.rotation === 0)
          }, targetX)
          assert(aligned)
          await page.screenshot({ path: `${out}/${mode}-aim-${targetX}.png` })
        }
      }
      const circle = await page.evaluate(() => {
        const scene = window.feedbackScene
        const actors = [scene.player, ...scene.mates.map((m) => m.body)]
        const fixed = actors.map((body) => ({ x: body.x, y: body.y }))
        const seen = actors.map(() => new Set())
        let upright = true,
          limited = true,
          unchanged = true,
          aimed = true
        for (let step = 0; step < 24; step++) {
          const angle = (step * Math.PI) / 12
          for (const [i, body] of actors.entries()) {
            for (const b of scene.bullets.getChildren()) b.disableBody(true, true)
            const target = { x: body.x + Math.cos(angle) * 220, y: body.y + Math.sin(angle) * 220 }
            scene.fire(scene.time.now + step * 4 + i, target, i ? scene.mates[i - 1] : undefined)
            const gun = i ? scene.mates[i - 1].gun : scene.heroGun
            const bullet = scene.bullets.getChildren().find((b) => b.active)
            const dx = target.x - bullet.fromX,
              dy = target.y - bullet.fromY
            upright &&= body.rotation === 0
            limited &&=
              gun.rotation >= (-150 * Math.PI) / 180 - 0.001 &&
              gun.rotation <= (-30 * Math.PI) / 180 + 0.001
            aimed &&=
              Math.abs(dx * Math.sin(bullet.rotation) - dy * Math.cos(bullet.rotation)) < 0.001
            unchanged &&= body.x === fixed[i].x && body.y === fixed[i].y
            seen[i].add(body.texture.key)
          }
        }
        return { upright, limited, unchanged, aimed, poses: seen.map((keys) => keys.size) }
      })
      assert(circle.upright, '표적이 360도 이동해도 사장냥과 동료 몸은 회전하지 않음')
      assert(circle.limited, '총과 견착 자세는 좌우 60도까지만 표현')
      assert(circle.aimed, '방향 그림이 바뀌어도 탄은 실제 총구에서 표적을 향함')
      assert(circle.unchanged, '조준 중 충돌 기준 위치 유지')
      assert(
        circle.poses.every((count) => count === 9),
        '사장냥과 모든 동료가 9방향 자세 전환',
      )
      const allCats = await page.evaluate(async () => {
        const scene = window.feedbackScene
        const { bakeCatBody } = await import('/app/src/mental/art.ts')
        const { CAT_POSE_DEGREES, catPoseAngle } = await import('/app/src/mental/catPose.ts')
        const { WEAPON_GRADES } = await import('/app/src/mental/weaponVisuals.ts')
        window.catHandle.applyLoadout({ ...scene.loadout, mates: 6 })
        const actors = [scene.player, ...scene.mates.map((m) => m.body)]
        const identities = new Set()
        let intact = true,
          upright = true,
          guns = true
        for (const [i, body] of actors.entries()) {
          for (const index of CAT_POSE_DEGREES.keys()) {
            scene.poseGun(body, catPoseAngle(index), 0, i ? scene.mates[i - 1] : undefined)
            upright &&= body.rotation === 0 && body.texture.key.includes(`pose-${index}`)
            identities.add(body.texture.key)
            const source = scene.textures.get(body.texture.key).getSourceImage()
            const upper = source.getContext('2d').getImageData(0, 0, source.width, 70).data
            for (let frame = 0; frame < 8; frame++) {
              const key = bakeCatBody(scene, index, i ? i - 1 : undefined, frame)
              const cv = scene.textures.get(key).getSourceImage()
              const moved = cv.getContext('2d').getImageData(0, 0, cv.width, 70).data
              intact &&= upper.every((value, pixel) => value === moved[pixel])
            }
            for (const grade of WEAPON_GRADES) {
              scene.opts.hero.weapon = { ...scene.opts.hero.weapon, grade }
              scene.poseGun(body, catPoseAngle(index), 0, i ? scene.mates[i - 1] : undefined)
              const gun = i ? scene.mates[i - 1].gun : scene.heroGun
              guns &&= gun.texture.key === `cat-gun-${grade}` && gun.depth < body.depth
            }
          }
        }
        const running = scene.textures.getTextureKeys().filter((key) => key.endsWith('-running'))
        return {
          actors: actors.length,
          poses: identities.size,
          intact,
          upright,
          guns,
          running: running.length,
        }
      })
      assert.equal(allCats.actors, 7)
      assert.equal(allCats.poses, 63, '고양이 7종 × 고유 자세 9개')
      assert.equal(allCats.running, 7, '달리기는 고양이마다 캔버스 하나만 재사용')
      assert(allCats.intact, '보행 중에도 견착한 머리·팔은 총에 맞는 같은 위치를 유지')
      assert(allCats.upright)
      assert(allCats.guns, '12등급 무기가 63개 자세 뒤에서 교체됨')
      if (mode === 'assault') {
        const broken = await page.evaluate(() => {
          const scene = window.feedbackScene
          const wall = scene.walls.find((w) => !w.broken)
          const layers = [...wall.cells]
          for (const cell of layers) scene.kill(cell, true)
          return {
            broken: wall.broken,
            left: wall.left,
            layers: layers.length,
            fragments: scene.children.list.filter((o) => o.name === 'wall-fragment').length,
          }
        })
        assert(broken.broken)
        assert.equal(broken.left, 0)
        assert.equal(broken.fragments, reduced ? 0 : broken.layers * 6)
        await page.evaluate(() => {
          window.catHandle.applyLoadout(window.feedbackScene.loadout)
          window.catHandle.setPaused(false)
        })
        await page.waitForTimeout(90)
        await page.screenshot({ path: `${out}/burst-${reduced}.png` })
        await page.waitForFunction(
          () => window.feedbackScene.children.list.every((o) => o.name !== 'wall-fragment'),
          null,
          { timeout: 3000 },
        )
      }
      assert.deepEqual(errors, [])
      console.log(
        `PASS: ${mode}: original join count/cap, distinct models, nine shoulder poses, upright bodies through 360-degree target changes, all four rendered muzzle origins/damage, 7 cats × 9 poses × 12 grades, bounded running textures`,
      )
      const cleaned = await page.evaluate(() => {
        const scene = window.feedbackScene
        const guns = scene.mates.map((m) => m.gun)
        window.catHandle.applyLoadout({ ...scene.loadout, mates: 0 })
        return guns.every((gun) => !gun.scene)
      })
      assert(cleaned, '동료 해제 시 분리된 총 이미지도 제거')
      await page.evaluate(() => window.catHandle.stop())
      await page.close()
    }
  }
} finally {
  await browser.close()
}
