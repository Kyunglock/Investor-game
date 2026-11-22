import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion,
    })
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (r) => r.fulfill({ json: company }))
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')
    const result = await page.evaluate(async () => {
      const base = '/app/src/mental/'
      const [{ startBattle }, cards, { DEFAULT_WEAPON }, { assaultSpec }, { auroraNightStats }] =
        await Promise.all([
          import(`${base}battle.ts`),
          import(`${base}cards.ts`),
          import(`${base}hero.ts`),
          import(`${base}assault.ts`),
          import(`${base}magic.ts`),
        ])
      const manager = window.Phaser.Scenes.SceneManager.prototype
      const create = manager.create
      let scene
      manager.create = function (value) {
        if (value.opts?.hero?.name === 'test') scene = value
        return create.call(this, value)
      }
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;inset:0;z-index:99999'
      document.body.append(host)
      let ready
      const loaded = new Promise((resolve) => {
        ready = resolve
      })
      const loadout = { ...cards.loadoutOf(DEFAULT_WEAPON), damage: 1, fireMs: 100000 }
      const handle = startBattle(host, {
        mode: 'assault',
        assault: assaultSpec(1),
        genre: 'DEFENSE',
        hero: { name: 'test', weapon: DEFAULT_WEAPON, upgrades: [] },
        loadout,
        onReady: () => setTimeout(ready, 0),
        onLevelUp() {},
        onHud() {},
        onHurt() {},
        onBanner() {},
        onDone() {},
      })
      await loaded
      scene.paused = true
      scene.addWall(0, 300)
      const wall = scene.walls.at(-1)
      wall.arrived = true
      // Three layers, one representative each. Keep enemies out of the shared pool reuse path.
      for (const e of wall.cells) {
        e.hp = e.maxHp = 10000
      }
      if (wall.cells.length < 3) {
        for (let row = wall.cells.length; row < 3; row++) {
          const e = scene.spawnCell(wall, row, 0, 10000, false)
          wall.cells.push(e)
        }
        wall.left = wall.cells.length
        scene.layoutWall(wall)
        scene.placeWall(wall)
      }
      const enemies = [
        [20, 40],
        [350, 510],
        [200, 350],
        [160, -60],
      ].map(([x, y]) => {
        const existing = new Set(scene.enemies.getChildren().filter((e) => e.active))
        scene.spawn('panic')
        const target = scene.enemies.getChildren().find((e) => e.active && !existing.has(e))
        target.setPosition(x, y)
        target.hp = 100
        return target
      })
      enemies[2].boss = true
      const wallHp = () => wall.cells.reduce((sum, cell) => sum + cell.hp, 0)
      const before = wallHp()
      handle.applyLoadout({
        ...loadout,
        mates: 1,
        mateMagic: [['auroraNight']],
        mateMagicLevels: [1],
      })
      // 합류 애니메이션이 끝난 시점부터 시전·명중 시계를 직접 진행한다.
      scene.mates[0].drop = 0
      scene.elapsed += 1
      scene.castMagic()
      const curtain = scene.children.list.some((item) => item.texture?.key === 'aurora-curtain')
      const casts = scene.damageStats.casts.auroraNight
      scene.updateMagic(0)
      const charging = enemies.every((enemy) => enemy.hp === 100)
      scene.elapsed += 0.5
      scene.updateMagic(0)
      scene.updateMagic(0)
      const losses = enemies.map((enemy) => 100 - enemy.hp)
      const wallLoss = before - wallHp()

      return { casts, charging, curtain, losses, wallLoss, damage: auroraNightStats(1).damage }
    })
    assert.equal(result.casts, 1)
    assert.equal(result.curtain, reducedMotion === 'no-preference')
    assert(result.charging)
    assert.deepEqual(result.losses, [result.damage, result.damage, result.damage, 0])
    assert.equal(result.wallLoss, result.damage)
    console.log('극광의 밤: 벽 뒤 적·보스·매도벽 한 묶음에 한 번씩 명중, 화면 밖 적 제외')
    await page.close()
  }
} finally {
  await browser.close()
}
