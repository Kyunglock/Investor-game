import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const browser = await chromium.launch()
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (r) => r.fulfill({ json: company }))
  await page.goto('http://127.0.0.1:5182/app/')
  const result = await page.evaluate(async () => {
    const base = '/app/src/mental/'
    const [{ startBattle }, cards, { DEFAULT_WEAPON }, { assaultSpec }, { meteorStats }] =
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
      scene = value
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
    const front = wall.cells[0]
    const before = wall.cells.map((e) => e.hp)
    const shot = scene.meteors[0]
    Object.assign(shot, { tx: front.x, ty: front.y, level: 1 })
    scene.meteorImpact(shot)
    const losses = wall.cells.map((e, i) => before[i] - e.hp)
    scene.spawn('panic')
    const behind = scene.enemies.getChildren().find((e) => e.active && !e.cell)
    behind.setPosition(front.x, wall.y - scene.wallHeight(wall) - 10)
    behind.hp = 100
    const excluded = !scene.magicTargets().includes(behind)
    Object.assign(shot, { tx: behind.x, ty: behind.y, level: 5 })
    scene.meteorImpact(shot)
    const untouched = behind.hp === 100
    behind.boss = true
    scene.meteorImpact(shot)
    const bossHit = behind.hp < 100 && behind.stunUntil > scene.elapsed
    handle.applyLoadout({ ...loadout, mates: 3, awakenedMates: 3, meteor: 3 })
    scene.elapsed += 1
    scene.castMagic()
    const matesCast = scene.damageStats.mateCasts.every((n) => n > 0)
    return {
      losses,
      expected: meteorStats(1).damage,
      excluded,
      untouched,
      bossHit,
      matesCast,
      reduced: scene.reducedMotion,
    }
  })
  console.log(result)
  assert(Math.abs(result.losses[0] - result.expected) < 1e-8)
  assert(result.losses.slice(1).every((n) => n === 0))
  assert(
    result.excluded && result.untouched && result.bossHit && result.matesCast && result.reduced,
  )
  console.log('메테오 벽 1회 피해·벽 뒤 제외·보스 예외·기절·동료 시전·움직임 줄이기:', result)
} finally {
  await browser.close()
}
