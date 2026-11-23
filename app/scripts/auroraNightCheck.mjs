import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  for (const mode of ['reduce', 'no-preference', 'idle']) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: mode === 'idle' ? 'reduce' : mode,
    })
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (r) => r.fulfill({ json: company }))
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')
    const result = await page.evaluate(async (idle) => {
      const base = '/app/src/mental/'
      const [
        { startBattle },
        cards,
        { DEFAULT_WEAPON },
        { assaultSpec, idleAssaultSpec },
        { auroraNightStats },
      ] = await Promise.all([
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
      const wallHits = []
      const handle = startBattle(host, {
        mode: 'assault',
        assault: idle ? idleAssaultSpec(49, 10000) : assaultSpec(1),
        idle: idle ? () => ({ wall: 49, hp: 10000, maxHp: 10000 }) : undefined,
        onIdleHit(wall, kind, damage, depth) {
          if (kind === 'auroraNight')
            wallHits.push({ wall, damage, depth, step: scene.auroraSweep.step })
        },
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
      if (idle) {
        scene.castAuroraNight(scene.player, 1)
        const speeds = {}
        for (let i = 0; i < 1200 && scene.auroraSweep; i++) {
          const sweep = scene.auroraSweep
          const before = sweep.distance
          const step = sweep.step
          scene.elapsed = sweep.started + 0.38 + (i + 1.01) / 120
          scene.advanceAuroraSweep()
          if (sweep.step > step) speeds[sweep.step] = sweep.distance - before
        }
        return { wallHits, speeds, finished: !scene.auroraSweep }
      }
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
      const charging = enemies.every((enemy) => enemy.hp === 10000)
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
        ticks,
        speeds,
        finished: !scene.auroraSweep,
        damage,
        losses: enemies.map((enemy) => 10000 - enemy.hp),
        wallLoss: before - wallHp(),
      }
    }, mode === 'idle')
    if (mode === 'idle') {
      assert(result.finished)
      const free = Math.max(...Object.values(result.speeds))
      let previous = 0
      for (const depth of [0, 1, 2]) {
        const hits = result.wallHits.filter((hit) => hit.depth === depth)
        assert(hits.length >= 2)
        assert(hits[0].step > previous)
        previous = hits[0].step
        for (const [i, hit] of hits.entries()) {
          assert.equal(hit.wall, 49 + depth)
          assert.equal(hit.damage, result.wallHits[0].damage)
          assert(Math.abs(result.speeds[hit.step] / free - 0.16) < 1e-6)
          if (i) assert.equal(hit.step - hits[i - 1].step, 30)
        }
      }
      console.log('자동 전투: 앞·두 번째·세 번째 매도벽에서 감속 및 연타 확인')
      await page.close()
      continue
    }
    assert.equal(result.casts, 1)
    assert(result.charging && result.finished)
    const [far, near, boss, outside, wall] = result.ticks
    assert(near[0] < boss[0] && boss[0] < far[0])
    assert.equal(outside.length, 0)
    for (const times of [far, near, boss, wall]) {
      assert(times.length >= 2)
      for (let i = 1; i < times.length; i++) assert.equal((times[i] - times[i - 1]) / 120, 0.25)
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
      '극광의 밤: 접촉 감속·이탈 가속, 몹과 장벽별 0.25초 연타 확인',
      result.ticks.map((times) => times.length),
    )
    await page.close()
  }
} finally {
  await browser.close()
}
