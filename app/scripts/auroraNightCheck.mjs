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
        target.hp = target.maxHp = 10000
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
      const casts = scene.damageStats.casts.auroraNight
      const damage = auroraNightStats(1).damage
      const ticks = Array.from({ length: 5 }, () => [])
      const hit = scene.hit.bind(scene)
      scene.hit = (enemy, amount, angle, kind, area) => {
        if (kind === 'auroraNight') {
          const index = enemy.cell?.wall === wall ? 4 : enemies.indexOf(enemy)
          if (index >= 0) ticks[index].push(scene.auroraSweep.step)
        }
        return hit(enemy, amount, angle, kind, area)
      }
      scene.elapsed += 0.25
      scene.updateMagic(0)
      const charging = !scene.auroraSweep.released && enemies.every((enemy) => enemy.hp === 10000)
      scene.elapsed += 0.01
      scene.updateMagic(0)
      const released = scene.auroraSweep.released
      const speeds = []
      for (let i = 0; i < 1200 && scene.auroraSweep; i++) {
        const sweep = scene.auroraSweep
        const previousStep = sweep.step
        const previousDistance = sweep.distance
        // 가끔 한 프레임이 여러 타격 주기만큼 길어져도 경과 시간을 처리한다.
        scene.elapsed += i === 42 ? 0.52 : 1 / 60
        scene.updateMagic(0)
        if (sweep.step > previousStep)
          speeds.push((sweep.distance - previousDistance) / (sweep.step - previousStep))
      }
      scene.updateMagic(0)
      return {
        casts,
        charging,
        released,
        ticks,
        speeds,
        finished: !scene.auroraSweep,
        damage,
        losses: enemies.map((enemy) => 10000 - enemy.hp),
        wallLoss: before - wallHp(),
      }
    })
    assert.equal(result.casts, 1)
    assert(result.charging && result.released && result.finished)
    const [far, near, boss, outside, wall] = result.ticks
    assert(near[0] < boss[0] && boss[0] < far[0])
    assert.equal(outside.length, 0)
    for (const times of [far, near, boss, wall]) {
      assert(times.length >= 2)
      for (let i = 1; i < times.length; i++) assert.equal((times[i] - times[i - 1]) / 120, 0.125)
    }
    assert.deepEqual(
      result.losses,
      result.ticks.slice(0, 4).map((times) => times.length * result.damage),
    )
    assert.equal(result.wallLoss, wall.length * result.damage)
    const ratio = Math.min(...result.speeds) / Math.max(...result.speeds)
    assert(Math.abs(ratio - 0.16) < 1e-6)
    assert(result.speeds.at(-1) > Math.min(...result.speeds) * 5)
    console.log(
      '극광의 밤: 접촉 감속·이탈 가속, 몹과 장벽별 0.125초 연타 확인',
      result.ticks.map((times) => times.length),
    )
    await page.close()
  }
} finally {
  await browser.close()
}
