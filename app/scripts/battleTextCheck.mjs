// 전투 화면의 글자와 단추가 서로 가리지 않는지 본다 (#913~#916): 매도벽의 피해 숫자는 남은 물량을 비켜 뜨고, "매수 -N주"는 하나로 합쳐
// 화면 안에 뜨고, 서킷브레이커는 매수벽 회복을 차단벽에 적고, 스킬 단추는 매수벽 위에서 끝난다.
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { company } from './fixture.ts'

const HP = 30000
const idle = {
  dps: 12,
  earned: 0,
  skills: [],
  // 숫자가 넉넉히 뜨게 네 마리가 함께 쏜다.
  cats: [
    ['sky', '하늘냥'],
    ['mint', '민트냥'],
    ['lilac', '라일락냥'],
    ['sunset', '노을냥'],
  ].map(([code, name]) => ({
    code,
    name,
    level: 1,
    damagePercent: 100,
    firePercent: 150,
    criticalPercent: 150,
    fielded: true,
    skills: [],
    skillLevel: 1,
    skillNextLevel: 10,
    grade: 'C',
    weapon: null,
  })),
  fieldSlots: 4,
  wallDps: 0,
  power: 1038,
  income: { perSecond: 1, staffPerSecond: 0, bonusPercent: 0 },
  offline: null,
  activeSlots: 3,
  actives: [
    ['barrage', '매수세례', 40, 4, false],
    ['rally', '불장', 60, 6.7, false],
    ['fortify', '방어선 구축', 60, 4, false],
    ['boostFire', '공격속도 3배', 180, 180, true],
    ['boostDamage', '공격력 3배', 180, 180, true],
    ['boostBuy', '매수공격 3배', 180, 180, true],
  ].map(([code, name, cooldown, seconds, ad], index) => ({
    code,
    name,
    cooldown,
    seconds,
    readyIn: 0,
    left: 0,
    equipped: index < 3,
    ad,
  })),
}

async function run(browser, width, height) {
  const s = { sequence: 0, circuitSeconds: 0 }
  const page = await browser.newPage({ viewport: { width, height } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    if (route.request().url().endsWith('/idle')) {
      const body = route.request().postDataJSON()
      s.sequence = Math.max(s.sequence, body.sequence)
    }
    const view = {
      wall: 1,
      hp: HP,
      maxHp: HP,
      circuitSeconds: s.circuitSeconds,
      sequence: s.sequence,
      boss: false,
      upcoming: [2, 3].map((wall) => ({ wall, hp: HP, maxHp: HP })),
    }
    return route.fulfill({ json: { ...company, idle: { ...idle, ...view } } }).catch(() => {})
  })
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/')
  await page.waitForFunction(() => window.__mentalWalls?.()[0]?.arrived, null, { timeout: 60000 })

  // #916: 양옆의 스킬 단추 열이 매수벽 위에서 끝난다.
  const layout = await page.evaluate(() => {
    const box = (selector) => document.querySelector(selector).getBoundingClientRect()
    const canvas = box('[data-testid=idle-canvas] canvas')
    const market = window.__mentalMarket()
    return {
      wallTop: canvas.top + market.buyWall.feedback.top,
      sellBottom: canvas.top + window.__mentalWalls()[0].bottom,
      columns: ['idle-actives', 'idle-ad-actives'].map((id) => {
        const rect = box(`[data-testid=${id}]`)
        return { id, top: rect.top, bottom: rect.bottom }
      }),
      center: canvas.width / 2,
      view: canvas.width,
    }
  })
  for (const column of layout.columns) {
    assert.ok(
      column.bottom <= layout.wallTop,
      `${width}x${height}: ${column.id} ends above the buy wall: ${column.bottom} > ${layout.wallTop}`,
    )
    assert.ok(
      column.top >= layout.sellBottom,
      `${width}x${height}: ${column.id} starts below the sell walls: ${column.top} < ${layout.sellBottom}`,
    )
  }

  // #914: 매도벽에 뜨는 피해 숫자는 가운데의 남은 물량 글자를 비켜 양옆에 뜬다.
  const lane = layout.view - 66
  const seen = { left: 0, right: 0 }
  // 양쪽에 다 뜬 것을 본 뒤로도 잠깐 더 본다. 느린 기계에서는 첫 총알이 늦다.
  const until = Date.now() + 30000
  let enough = 0
  while (Date.now() < until && Date.now() < (enough || until)) {
    const numbers = await page.evaluate(() => window.__mentalMarket().numbers)
    for (const n of numbers.filter((n) => n.onWall)) {
      const off = n.x - layout.center
      assert.ok(
        Math.abs(off) > lane / 4,
        `${width}px: a wall number covers the wall's label: ${off}`,
      )
      seen[off < 0 ? 'left' : 'right']++
    }
    if (!enough && seen.left > 0 && seen.right > 0) enough = Date.now() + 3000
    await page.waitForTimeout(50)
  }
  assert.ok(seen.left > 0 && seen.right > 0, `wall numbers on both sides: ${JSON.stringify(seen)}`)

  // #915: 한꺼번에 닿은 물량은 "매수 -N주" 하나로 합쳐지고, 화면 끝에 맞아도 잘리지 않는다.
  for (const x of [0, layout.view]) {
    const note = await page.evaluate((x) => {
      for (let i = 0; i < 5; i++) window.__mentalBuyWallHit(1 + i, x)
      return window.__mentalMarket().buyWall.lossNote
    }, x)
    // 다섯 번에 15(450주, 653번 전에는 2,250주)를 깎았다. 바로 앞에 닿은 매도 물량이 있으면 그것도 같은 글자에 합쳐진다.
    const shares = Number(note.text.match(/^매수 -([\d,]+)주$/)?.[1].replaceAll(',', ''))
    assert.ok(shares >= 450, `one note carries all five hits: ${note.text}`)
    assert.ok(
      note.left >= 0 && note.right <= layout.view,
      `the note stays on screen: ${note.left}~${note.right}`,
    )
    await page.waitForTimeout(400)
  }

  // #913: 서킷브레이커는 깎인 매수벽을 되채우고, 그 양을 차단벽에 적는다. 멘탈이라는 말은 없다.
  s.circuitSeconds = 8
  const hp = () => page.evaluate(() => window.__mentalMarket().buyWall.hp)
  await page.waitForFunction(() => window.__mentalMarket().circuit?.elapsed > 0.3, null, {
    timeout: 15000,
  })
  // 거래가 멈춘 동안에는 매수벽이 맞지 않는다: 그사이 늘어난 체력은 되채운 것이다.
  const halted = await hp()
  await page.waitForFunction(() => window.__mentalMarket().circuit?.elapsed > 1.5)
  const refilled = await hp()
  assert.ok(refilled > halted, `the buy wall refills while halted: ${halted} -> ${refilled}`)
  assert.match(
    await page.evaluate(() => window.__mentalMarket().circuit.caption),
    /^거래 정지 · 매수벽 회복 \+[\d,]+주$/,
  )
  await page.screenshot({ path: `/tmp/battle-text-${width}x${height}.png` })
  await page.close()
  assert.deepEqual(errors, [])
  console.log(`battle text ok: ${width}x${height}`)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  await run(browser, 390, 844)
  await run(browser, 320, 568)
} finally {
  await browser.close()
}
