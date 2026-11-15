// Real Phaser contacts on the idle sell wall. The screen breaks the wall first and the server
// follows (decisions.md 532): time alone never creates damage, only pierced bullets reach the walls
// behind, a wall breaks at the hit whatever the heartbeat's delay, what is left of the breaking hit
// is on the next wall, and a server that credits less never brings a wall back.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const APP = process.env.APP_URL ?? 'http://localhost:5173/app/'
// The predictor the app uses, loaded in the page for the hand-driven fights below.
const PREDICT = `${new URL(APP).pathname}@fs${fileURLToPath(
  new URL('../../frontend/src/features/raising/idlePredict.ts', import.meta.url),
)}`
/**
 * A wall counts as bottomed out while its cells hold nothing but their guard against zero health:
 * 0.000001 each, so real health left by a hit (a third of a share is common) is never taken for it.
 * The screen before #781 kept 0.01 a cell.
 */
const BOTTOM = process.env.IDLE_LEGACY ? 0.07 : 0.0001

// IdleEngine.maxHp, written out again: the mock server must not lean on the code it checks.
const maxHp = (wall) => (20 + 12 * (wall - 1) + 0.2 * (wall - 1) ** 2) * (wall % 10 === 0 ? 3 : 1)

/**
 * The server's rule (IdleEngine.tick, decisions.md 532) without the anti-cheat budgets: `credit`
 * stands for them (1 = everything the screen sent is credited).
 */
function mockServer(wall, credit = 1) {
  const s = {
    wall,
    damage: 0,
    queued: [0, 0, 0, 0, 0, 0],
    circuitSeconds: 0,
    sequence: 0,
    lastBeat: 0,
    /** Direct damage credited, and where all of it is now: nothing may be lost on a break. */
    direct: 0,
    broken: 0,
    beats: 0,
  }
  const tick = (seconds, hits) => {
    const stopped = Math.min(seconds, s.circuitSeconds)
    s.circuitSeconds -= stopped
    if (seconds - stopped > 0) {
      const front = s.wall
      let direct = 0
      for (const hit of hits) {
        if (!(hit.count > 0) || !(hit.damage > 0)) continue
        // An old screen sends no depth: the distance from the front wall stands for it.
        const depth = hit.depth ?? hit.wall - front
        if (depth === 0) {
          if (Math.abs(hit.wall - front) <= 20) direct += hit.damage * credit
        } else if (hit.kind === 'bullet' && (depth === 1 || depth === 2)) {
          const at = hit.wall - front - 1
          if (at < 0 || at >= s.queued.length) continue
          const before = s.queued[at]
          s.queued[at] = Math.min(maxHp(hit.wall) - 1, before + hit.damage * credit)
          s.direct += s.queued[at] - before
        }
      }
      s.damage += direct
      s.direct += direct
    }
    while (s.circuitSeconds === 0 && s.damage + 1e-7 >= maxHp(s.wall)) {
      const left = Math.max(0, s.damage - maxHp(s.wall))
      s.broken += maxHp(s.wall)
      s.wall++
      s.damage = s.queued.shift() + left
      s.queued.push(0)
    }
  }
  return {
    state: s,
    beat(body) {
      const now = Date.now()
      if (body.action === 'start') {
        s.sequence = body.sequence
        s.lastBeat = now
      } else if (body.sequence > s.sequence) {
        s.sequence = body.sequence
        if (body.action === 'stop') s.lastBeat = 0
        else {
          if (s.lastBeat > 0) tick(((now - s.lastBeat) / 1000) * 2, body.hits ?? [])
          s.lastBeat = now
          s.beats++
        }
      }
    },
    view: () => ({
      wall: s.wall,
      hp: Math.max(0, maxHp(s.wall) - s.damage),
      maxHp: maxHp(s.wall),
      circuitSeconds: s.circuitSeconds,
      sequence: s.sequence,
      boss: s.wall % 10 === 0,
      upcoming: [0, 1].map((i) => ({
        wall: s.wall + 1 + i,
        hp: maxHp(s.wall + 1 + i) - s.queued[i],
        maxHp: maxHp(s.wall + 1 + i),
      })),
    }),
  }
}

const idleFixture = {
  dps: 12,
  earned: 0,
  skills: ['water', 'meteor', 'bolt', 'ram'].map((code) => ({
    code,
    name: code,
    owned: false,
    level: 0,
  })),
  cats: [],
  fieldSlots: 4,
  wallDps: 0,
  power: 1038,
  income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
  offline: null,
}

/**
 * The real screen (IdleCanvas, the heartbeat loop, the HUD) against the mock server, with every
 * heartbeat answer held back by `delay` ms. Samples every frame until the HUD reaches `until`.
 */
async function realRun(browser, { delay, wall = 1, until, credit = 1, legacy = false }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const server = mockServer(wall, credit)
  const body = () => ({ ...company, idle: { ...idleFixture, ...server.view() } })
  let ahead = 0
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (route.request().url().endsWith('/idle')) {
      // Half the delay on the way up, half on the way back.
      await new Promise((done) => setTimeout(done, delay / 2))
      server.beat(route.request().postDataJSON())
      const json = body()
      await new Promise((done) => setTimeout(done, delay / 2))
      return route.fulfill({ json }).catch(() => {})
    }
    return route.fulfill({ json: body() })
  })
  await page.goto(APP)
  await page.locator('[data-testid=idle-canvas] canvas').waitFor({ timeout: 30000 })
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.evaluate(() => {
    const frames = []
    window.idleFrames = frames
    const sample = () => {
      const hud = document.querySelector('[data-testid=idle-wall-number]')
      const front = window.__mentalWalls?.()[0]
      frames.push({
        t: performance.now(),
        hud: hud?.textContent ?? '',
        halt: hud?.getAttribute('data-state') === 'halt',
        // The wall the renderer stands at: one before the first wall drawn behind it.
        wall: front ? front.upcoming[0].wall - 1 : 0,
        hp: front?.arrived ? front.hp : null,
        wide: document.documentElement.scrollWidth > innerWidth,
      })
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  const hudWall = async () =>
    Number((await page.getByTestId('idle-wall-number').textContent())?.match(/\d+/)?.[0] ?? 0)
  const started = Date.now()
  while ((await hudWall()) < until) {
    assert(Date.now() - started < 120000, `stuck at wall ${await hudWall()} (delay ${delay})`)
    ahead = Math.max(ahead, (await hudWall()) - server.state.wall)
    await page.waitForTimeout(50)
  }
  const frames = await page.evaluate(() => window.idleFrames)
  await page.close()
  assert.deepEqual(errors, [])
  // The longest time a wall stood bottomed out and unbroken, hits wasted on it.
  let stall = 0
  let since = null
  for (const frame of frames) {
    const bottom = frame.hp !== null && frame.hp <= BOTTOM && !frame.halt
    if (bottom && since === null) since = frame.t
    if (since !== null) stall = Math.max(stall, frame.t - since)
    if (!bottom) since = null
  }
  if (!legacy) {
    const walls = frames.map((frame) => Number(frame.hud.match(/\d+/)?.[0] ?? 0)).filter(Boolean)
    assert(
      walls.every((n, i) => i === 0 || n >= walls[i - 1]),
      'the HUD wall number went back',
    )
    // The wall drawn never goes back, and a wall's health never goes up.
    let last = { wall: 0, hp: Number.POSITIVE_INFINITY }
    for (const frame of frames) {
      if (!frame.wall || frame.hp === null) continue
      assert(frame.wall >= last.wall, `wall ${last.wall} came back as ${frame.wall}`)
      if (frame.wall === last.wall)
        assert(frame.hp <= last.hp + 1e-6, `wall ${frame.wall} health rose to ${frame.hp}`)
      last = frame
    }
    // The HUD number changes with the break: the frame the renderer drops the broken wall's
    // cells, the HUD already names the next one (React commits within a few frames).
    const hudAt = (n) => frames.find((f) => f.halt || Number(f.hud.match(/\d+/)?.[0] ?? 0) >= n)
    let drawn = 0
    let checked = 0
    for (const frame of frames) {
      if (frame.wall === drawn) continue
      if (frame.wall) drawn = frame.wall
      else if (drawn > checked) {
        // The renderer just dropped wall `drawn`: it draws none while the next one comes up.
        const hud = hudAt(drawn + 1)
        assert(hud && hud.t - frame.t < 400, `the HUD was late for wall ${drawn + 1}`)
        checked = drawn
      }
    }
    assert(!frames.some((frame) => frame.wide), 'the screen scrolls sideways')
    // Nothing the screen sent was lost on a break: the leftover went on to the next wall.
    const s = server.state
    const held = s.broken + s.damage + s.queued.reduce((a, b) => a + b, 0)
    assert(Math.abs(held - s.direct) < 1e-6, `damage lost at a break: ${s.direct} sent, ${held}`)
  }
  // How long the HUD said trading was halted.
  const halts = frames.filter((frame) => frame.halt)
  const halted = halts.length ? halts[halts.length - 1].t - halts[0].t : 0
  const run = { delay, credit, stall, ahead, halted, beats: server.state.beats }
  if (process.env.IDLE_VERBOSE) console.log(run, Date.now() - started, 'ms')
  return run
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  // The old screen against the same mock, to measure what it was like: IDLE_LEGACY=1.
  if (process.env.IDLE_LEGACY) {
    for (const delay of [0, 700, 2000]) {
      const run = await realRun(browser, { delay, until: 3, legacy: true })
      console.log(`delay ${delay} ms: longest stall ${Math.round(run.stall)} ms`)
    }
    process.exit(0)
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
    route.fulfill({ json: company }),
  )
  await page.goto(APP)
  await page.locator('[data-testid=idle-canvas] canvas').waitFor({ timeout: 30000 })
  await page.waitForFunction(() => window.__mentalWalls?.().length > 0)
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('idle-app-active', { detail: false })),
  )
  // A fight driven by hand: `server` is what the server last said, the predictor puts the hits
  // on top of it as the app does (useIdleBattle), and nothing answers unless the check says so.
  await page.evaluate(async (predict) => {
    const base = '/app/src/mental/'
    const [{ startBattle }, { loadoutOf }, { assaultSpec }, { DEFAULT_WEAPON }, { IdlePredictor }] =
      await Promise.all([
        import(`${base}battle.ts`),
        import(`${base}cards.ts`),
        import(`${base}assault.ts`),
        import(`${base}hero.ts`),
        import(predict),
      ])
    window.startIdleTest = (first, damage) => {
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;inset:0;z-index:99999'
      document.body.append(host)
      const spec = assaultSpec(1)
      spec.walls = [{ ...spec.walls[0], rows: 1, spawnSeconds: 10000 }]
      const loadout = { ...loadoutOf(DEFAULT_WEAPON), fireMs: 100000, damage }
      const predictor = new IdlePredictor()
      let server = first
      const test = {
        hits: [],
        frames: [],
        predictor,
        view: () => predictor.view(server),
        /** The server's answer: a new state, as a heartbeat response brings. */
        answer: (next) => {
          server = { ...server, ...next }
        },
        fire: (fireMs, meteor = 0) => handle.applyLoadout({ ...loadout, fireMs, meteor }),
        pause: (paused) => handle.setPaused(paused),
        stop: () => {
          handle.stop()
          host.remove()
        },
        /** Called after each reported hit: the check stops the fire at the hit it wants. */
        after: null,
      }
      const handle = startBattle(host, {
        mode: 'assault',
        speed: 2,
        assault: spec,
        genre: 'DEFENSE',
        hero: { name: '명중검증', weapon: DEFAULT_WEAPON, upgrades: [] },
        loadout,
        idle: test.view,
        onIdleHit: (wall, kind, hitDamage, depth) => {
          test.hits.push({ wall, kind, damage: hitDamage, depth })
          predictor.add({ wall, kind, depth, damage: hitDamage })
          test.after?.()
        },
        onHud: () => {},
        onBanner: () => {},
        onHurt: () => {},
        onDone: () => {},
        onLevelUp: () => handle.applyLoadout(loadout),
      })
      const sample = () => {
        const front = window.__mentalWalls?.()[0]
        test.frames.push({
          t: performance.now(),
          wall: front ? front.upcoming[0].wall - 1 : 0,
          hp: front?.arrived ? front.hp : null,
          shown: test.view().wall,
        })
        if (window.idleTest === test) requestAnimationFrame(sample)
      }
      window.idleTest = test
      requestAnimationFrame(sample)
    }
    window.startIdleTest(
      {
        wall: 16,
        hp: 5000,
        maxHp: 5000,
        upcoming: [
          { wall: 17, hp: 5000, maxHp: 5000 },
          { wall: 18, hp: 5000, maxHp: 5000 },
        ],
        sequence: 0,
      },
      0.5,
    )
  }, PREDICT)
  const hitLog = () => page.evaluate(() => window.idleTest.hits)
  await page.waitForFunction(() => window.__mentalWalls?.()[0]?.arrived)
  await page.waitForFunction(() => window.__mentalMarket().battleSeconds > 3)
  assert.deepEqual(await hitLog(), [])
  await page.evaluate(() => window.idleTest.fire(100))
  await page.waitForFunction(() =>
    window.idleTest.hits.some((h) => h.wall === 16 && h.kind === 'bullet'),
  )
  // Bullet pierce (decisions.md 520): the bullet that hit the front wall goes on through the two
  // walls behind it, at 50% and 25%.
  await page.waitForFunction(() =>
    window.idleTest.hits.some((h) => h.wall === 17 && h.kind === 'bullet'),
  )
  await page.waitForFunction(() =>
    window.idleTest.hits.some((h) => h.wall === 18 && h.kind === 'bullet'),
  )
  await page.evaluate(() => window.idleTest.fire(100, 5))
  await page.waitForFunction(() =>
    window.idleTest.hits.some((h) => h.wall === 16 && h.kind === 'meteor'),
  )
  await page.waitForTimeout(1500)
  const hits = await hitLog()
  // Skills and explosions stop at the front wall: only bullets reach the walls behind.
  assert(hits.every((hit) => hit.wall === 16 || hit.kind === 'bullet'))
  assert(hits.every((hit) => hit.wall >= 16 && hit.wall <= 18))
  // The depth sent to the server is the number of walls the bullet had gone through (532).
  assert(hits.every((hit) => hit.depth === hit.wall - 16))
  // A bullet is twice the weapon's damage (decisions.md 495), or twice that again on a pistol
  // critical (487); each wall it goes through halves it.
  const share = { 16: 1, 17: 0.5, 18: 0.25 }
  assert(
    hits
      .filter((hit) => hit.kind === 'bullet')
      .every((hit) => hit.damage === share[hit.wall] || hit.damage === 2 * share[hit.wall]),
  )
  // One bullet reports each wall once: as many pierced hits as front hits (give or take one in flight).
  const bullets = (wall) => hits.filter((hit) => hit.kind === 'bullet' && hit.wall === wall).length
  assert(bullets(17) <= bullets(16) && bullets(18) <= bullets(17), 'pierce without a front hit')
  assert(
    hits.filter((hit) => hit.kind === 'meteor').every((hit) => hit.damage > 0 && hit.damage <= 2.4),
  )
  // The renderer draws the predicted health: the hits so far are off the wall before any answer.
  const wallHp = async () => (await page.evaluate(() => window.__mentalWalls()))[0].hp
  const shown = await wallHp()
  assert(shown > 4900 && shown < 5000, `predicted health ${shown}`)
  await page.evaluate(() => window.idleTest.pause(true))
  const pausedCount = (await hitLog()).length
  await page.waitForTimeout(500)
  assert.equal((await hitLog()).length, pausedCount)
  await page.evaluate(() => window.idleTest.pause(false))
  await page.evaluate(() => window.idleTest.fire(100000))
  await page.waitForTimeout(1000)
  const predicted = await wallHp()
  assert(predicted < 5000, `predicted health ${predicted}`)
  // Beat 1 leaves with those hits. A slow answer (longer than the old 1.4 s) changes nothing:
  // they are forgotten when the server has handled that beat (496), not after a fixed time.
  await page.evaluate(() => window.idleTest.predictor.sent(1))
  await page.waitForTimeout(1800)
  assert.equal(await wallHp(), predicted, 'health rose before the server answered')
  // The answer already holds the damage: it is not taken off twice, so nothing moves.
  await page.evaluate(() => {
    const { hp, upcoming } = window.idleTest.view()
    window.idleTest.answer({ hp, upcoming, sequence: 1 })
  })
  await page.waitForTimeout(300)
  assert(Math.abs((await wallHp()) - predicted) < 1e-6, 'health moved when the server caught up')
  // A dropped batch (stop, gap) is not given back to the wall: what was shown stays shown (532).
  await page.evaluate(() => window.idleTest.fire(100))
  await page.waitForFunction((hp) => window.__mentalWalls()[0].hp < hp - 0.5, predicted)
  await page.evaluate(() => window.idleTest.fire(100000))
  await page.waitForTimeout(700)
  const beforeDrop = await wallHp()
  await page.evaluate(() => window.idleTest.predictor.clear())
  await page.waitForTimeout(100)
  assert.equal(await wallHp(), beforeDrop, 'health rose when the pending hits were dropped')
  const steady = await page.evaluate(() => window.idleTest.frames)
  assert(
    steady.every(
      (f, i) =>
        i === 0 || f.hp === null || steady[i - 1].hp === null || f.hp <= steady[i - 1].hp + 1e-9,
    ),
    'the wall health rose',
  )
  await page.evaluate(() => window.idleTest.stop())

  // The break: wall 21 has 3 left and no answer ever comes. The first bullet (20, or 40 on a
  // critical) breaks it on the spot and what is left of it is on wall 22.
  await page.evaluate(
    ([hp21, hp22, hp23]) => {
      window.startIdleTest(
        {
          wall: 21,
          hp: 3,
          maxHp: hp21,
          upcoming: [
            { wall: 22, hp: hp22, maxHp: hp22 },
            { wall: 23, hp: hp23, maxHp: hp23 },
          ],
          sequence: 0,
        },
        10,
      )
      const test = window.idleTest
      test.after = () => {
        if (test.view().wall === 21) return
        test.brokeAt ??= performance.now()
        setTimeout(() => test.fire(100000), 0)
      }
    },
    [maxHp(21), maxHp(22), maxHp(23)],
  )
  await page.waitForFunction(() => window.__mentalWalls?.()[0]?.arrived)
  await page.evaluate(() => window.idleTest.fire(100))
  await page.waitForFunction(() => window.idleTest.brokeAt)
  // The next wall stands and is hit: no heartbeat answered in between.
  await page.waitForFunction(() => {
    const front = window.__mentalWalls?.()[0]
    return front?.arrived && front.upcoming[0].wall === 23
  })
  await page.waitForTimeout(400)
  const broke = await page.evaluate(() => ({
    hits: window.idleTest.hits,
    frames: window.idleTest.frames,
    at: window.idleTest.brokeAt,
    hp: window.__mentalWalls()[0].hp,
  }))
  // Wall 21 was gone the frame after the hit: it never stood there bottomed out.
  const bottomed = broke.frames.filter((f) => f.wall === 21 && f.hp !== null && f.hp <= BOTTOM)
  assert.equal(bottomed.length, 0, 'the broken wall stood at the bottom')
  const gone = broke.frames.find((f) => f.t >= broke.at && f.wall !== 21)
  assert(gone && gone.t - broke.at < 250, `wall 21 fell ${gone && gone.t - broke.at} ms late`)
  // Leftover (532): everything that hit wall 21 beyond its 3, plus the pierced hits on wall 22.
  const sum = (list) => list.reduce((total, hit) => total + hit.damage, 0)
  const direct = sum(broke.hits.filter((hit) => hit.depth === 0))
  const pierced = sum(broke.hits.filter((hit) => hit.wall === 22 && hit.depth === 1))
  assert(direct > 3 && pierced > 0)
  const next = maxHp(22) - pierced - (direct - 3)
  assert(Math.abs(broke.hp - next) < 1e-6, `wall 22 has ${broke.hp}, expected ${next}`)

  // The debt: the server handled that beat but credited almost nothing, wall 21 still has 300
  // there. The screen does not bring wall 21 back, and wall 22 does not get its health back.
  await page.evaluate(() => {
    window.idleTest.predictor.sent(1)
    window.idleTest.answer({ hp: 300, sequence: 1 })
  })
  await page.waitForTimeout(400)
  assert.equal((await page.evaluate(() => window.__mentalWalls()))[0].upcoming[0].wall, 23)
  assert.equal(await wallHp(), broke.hp, 'the wall health moved when the server credited less')
  // New hits pay the debt first: wall 22 does not lose health until 300 more have landed…
  await page.evaluate(() => {
    const test = window.idleTest
    const from = test.hits.length
    test.after = () => {
      const paid = test.hits
        .slice(from)
        .reduce((total, hit) => total + (hit.depth === 0 ? hit.damage : 0), 0)
      if (paid < 300) test.debtHp = test.view().hp
    }
    test.fire(100)
  })
  // …and then it does.
  await page.waitForFunction((hp) => window.__mentalWalls()[0]?.hp < hp - 1, broke.hp, {
    timeout: 60000,
  })
  await page.evaluate(() => window.idleTest.fire(100000))
  const debt = await page.evaluate(() => ({
    hp: window.idleTest.debtHp,
    frames: window.idleTest.frames,
  }))
  assert.equal(debt.hp, broke.hp, 'the wall lost health before the debt was paid')
  let last = { wall: 0, hp: Number.POSITIVE_INFINITY }
  for (const frame of debt.frames) {
    if (!frame.wall || frame.hp === null) continue
    assert(frame.wall >= last.wall, `wall ${last.wall} came back as ${frame.wall}`)
    if (frame.wall === last.wall) assert(frame.hp <= last.hp + 1e-9, 'the wall health rose')
    last = frame
  }
  await page.evaluate(() => window.idleTest.pause(true))

  // Boss health must be independent from wall health, including its death effect.
  await page.evaluate(async () => {
    window.idleTest.stop()
    window.idleTest = null
    const base = '/app/src/mental/'
    const [{ startBattle }, { loadoutOf }, { assaultSpec }, { DEFAULT_WEAPON }] = await Promise.all(
      ['battle.ts', 'cards.ts', 'assault.ts', 'hero.ts'].map((file) => import(base + file)),
    )
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;inset:0;z-index:99999'
    document.body.append(host)
    const spec = assaultSpec(1)
    spec.walls = [{ ...spec.walls[0], rows: 1, boss: true, spawnSeconds: 10000 }]
    spec.bossHp = 3
    const loadout = { ...loadoutOf(DEFAULT_WEAPON), fireMs: 100, damage: 0.5 }
    window.actualIdleHits = []
    let sawBoss = false
    window.bossTestDone = false
    const handle = startBattle(host, {
      mode: 'assault',
      speed: 2,
      assault: spec,
      genre: 'DEFENSE',
      hero: { name: '큰손 검증', weapon: DEFAULT_WEAPON, upgrades: [] },
      loadout,
      idle: () => ({ wall: 10, hp: 5000, maxHp: 5000 }),
      onIdleHit: (wall, kind) => window.actualIdleHits.push({ wall, kind }),
      onHud: () => {
        const boss = window.__mentalMarket?.().boss
        if (boss) sawBoss = true
        if (sawBoss && !boss && !window.bossTestDone) {
          window.bossTestDone = true
          handle.setPaused(true)
        }
      },
      onBanner: () => {},
      onHurt: () => {},
      onDone: () => {},
      onLevelUp: () => handle.applyLoadout(loadout),
    })
  })
  await page.waitForFunction(() => window.bossTestDone)
  assert.deepEqual(await page.evaluate(() => window.actualIdleHits), [])
  assert.equal((await page.evaluate(() => window.__mentalWalls()))[0].hp, 5000)
  assert.deepEqual(errors, [])
  await page.close()

  // The real screen and heartbeat against a server that answers late. The wall still breaks at
  // the hit: it never stands bottomed out waiting for the answer (it did for up to ~1.1 s, #781).
  const stalls = []
  for (const delay of [0, 700, 2000]) {
    const run = await realRun(browser, { delay, until: 3 })
    stalls.push(`${delay} ms: ${Math.round(run.stall)} ms`)
    assert(run.stall < 100, `a wall stood bottomed out for ${run.stall} ms (delay ${delay})`)
    // With a slow answer the screen is ahead of the server when it breaks a wall.
    if (delay >= 700) assert(run.ahead > 0, `the screen waited for the server (delay ${delay})`)
  }
  // The circuit breaker is switched off: wall 6 breaks like any other and trading never halts.
  const circuit = await realRun(browser, { delay: 300, wall: 5, until: 7 })
  assert(circuit.stall < 100, `a wall stood bottomed out for ${circuit.stall} ms at wall 6`)
  assert.equal(circuit.halted, 0, `halted for ${circuit.halted} ms`)
  // A server that credits half of what it is sent: the checks in realRun (no wall comes back,
  // no health rises, the HUD never goes back) hold while the screen runs ahead on debt.
  const half = await realRun(browser, { delay: 300, until: 3, credit: 0.5 })
  assert(half.stall < 100, `a wall stood bottomed out for ${half.stall} ms on debt`)
  console.log(
    `PASS: no timer contacts, real bullet/pierce contacts, no health bounce, break at the hit with leftover, debt, independent boss, pause; longest stall by answer delay ${stalls.join(', ')}`,
  )
} finally {
  await browser.close()
}
