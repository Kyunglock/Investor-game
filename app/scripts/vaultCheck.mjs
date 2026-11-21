import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

/**
 * 금고 도전 (decisions.md 641번): 보스전은 피해량을 알려 금괴를 받고, 던전은 카드를 고른 뒤 들어가 깨면 금괴를 받고, 금괴로 금고 상점에서
 * 산다. 서버는 흉내 낸다. VAULT_TUNE=1이면 팀과 층마다 걸린 시간을 적는다(vaultBattle.ts FLOOR_HP를 맞출 때 쓴다).
 */
const cat = (code, name, grade, over = {}) => ({
  code,
  name,
  level: 1,
  damagePercent: 50,
  firePercent: 100,
  criticalPercent: 100,
  fielded: false,
  slot: null,
  skills: [],
  skillLevel: 1,
  skillNextLevel: 10,
  grade,
  weapon: null,
  ...over,
})
const card = (code, name, effect, over = {}) => ({
  code,
  name,
  effect,
  damagePercent: 100,
  firePercent: 100,
  skillPercent: 100,
  mentalPercent: 100,
  enemyHpPercent: 100,
  enemySpeedPercent: 100,
  wallHpPercent: 100,
  bossHpPercent: 100,
  ...over,
})
const OFFERS = [
  card('rate-cut', '금리 인하', '공격력 +25%', { damagePercent: 125 }),
  card('safe-haven', '안전 자산', '최대 멘탈 +60%', { mentalPercent: 160 }),
  card('thin-book', '얇은 호가', '매도벽 체력 -20%', { wallHpPercent: 80 }),
]
const TIER_BASE = 30
const tierOf = (score) =>
  score < TIER_BASE ? 0 : 1 + Math.floor(Math.log(score / TIER_BASE) / Math.log(1.5) + 1e-9)

/** 팀: 처음(권총뿐), 고양이 넷(스킬 둘). */
const TEAMS = {
  fresh: { weapons: [], cats: [cat('sky', '하늘냥', 'C')] },
  team: {
    weapons: [
      {
        kind: 'rifle',
        name: '소총',
        grade: 'S',
        gradeName: 'S',
        damagePercent: 450,
        fireMs: 160,
        power: 1,
        bulletSpeed: 900,
        equipped: true,
        count: 1,
      },
    ],
    cats: [
      cat('sky', '하늘냥', 'C', { fielded: true, slot: 0, level: 30, damagePercent: 270 }),
      cat('mocha', '모카냥', 'B', { fielded: true, slot: 1, level: 20, damagePercent: 390 }),
      cat('night', '밤냥', 'A', {
        fielded: true,
        slot: 2,
        level: 20,
        damagePercent: 490,
        skills: [{ code: 'meteor', name: '메테오 스킬' }],
        skillLevel: 3,
      }),
      cat('silver', '은빛냥', 'S', {
        fielded: true,
        slot: 3,
        level: 10,
        damagePercent: 470,
        skills: [
          { code: 'bolt', name: '번개 스킬' },
          { code: 'bomb', name: '폭탄 스킬' },
        ],
        skillLevel: 2,
      }),
    ],
  },
}

function companyOf(team) {
  return {
    ...structuredClone(fixture),
    weapons: structuredClone(team.weapons),
    idle: {
      wall: 51,
      hp: 1000000,
      maxHp: 1000000,
      dps: 0,
      earned: 0,
      boss: false,
      circuitSeconds: 0,
      sequence: 0,
      upcoming: [],
      skills: [],
      cats: structuredClone(team.cats),
      fieldSlots: 4,
      wallDps: 0,
      power: 1,
      income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
      offline: null,
    },
    vault: {
      gold: 0,
      week: 2970,
      resetsAt: Date.now() + 3 * 86_400_000 + 4 * 3_600_000 + 30_000,
      trainingPercent: 0,
      lastNote: null,
      boss: {
        seconds: 60,
        weakSkills: [
          { code: 'bolt', name: '번개' },
          { code: 'fire', name: '불' },
          { code: 'ice', name: '얼음' },
          { code: 'wind', name: '바람' },
        ],
        resistSkills: [
          { code: 'meteor', name: '메테오' },
          { code: 'water', name: '물' },
          { code: 'dark', name: '어둠' },
          { code: 'sand', name: '모래' },
        ],
        weakPercent: 200,
        resistPercent: 50,
        rivals: [
          { code: 'sky', name: '하늘냥', grade: 'C' },
          { code: 'mint', name: '민트냥', grade: 'C' },
          { code: 'mocha', name: '모카냥', grade: 'B' },
          { code: 'peach', name: '복숭아냥', grade: 'B' },
        ],
        rivalPercent: 300,
        best: 0,
        record: 0,
        tier: 0,
        tierName: '등급 없음',
        nextScore: TIER_BASE,
        nextTierName: '브론즈 1',
        tierGold: 3,
      },
      dungeon: { floors: 3, cleared: 0, cards: [], offers: structuredClone(OFFERS), floorGold: [30, 50, 80] },
      shop: [
        { code: 'diamonds', name: '다이아 300개', description: '뽑기에 쓰는 다이아', price: 30, weeklyLimit: 5, left: 5, level: null },
        { code: 'training', name: '금고 훈련', description: '금고 전투의 공격력 +3%', price: 40, weeklyLimit: 0, left: 1, level: 0 },
      ],
    },
  }
}

/** 서버 흉내: 금고의 네 요청을 받아 회사를 고친다. */
function serve(company, calls) {
  return (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const vault = company.vault
    if (request.method() === 'POST' && path.includes('/vault/')) {
      const body = request.postData() ? request.postDataJSON() : {}
      calls.push({ path, body })
      if (path.endsWith('/vault/boss')) {
        vault.boss.best = Math.max(vault.boss.best, body.damage)
        vault.boss.record = Math.max(vault.boss.record, body.damage)
        const tier = tierOf(vault.boss.best)
        vault.gold += Math.max(0, tier - vault.boss.tier) * vault.boss.tierGold
        vault.boss.tier = Math.max(vault.boss.tier, tier)
        vault.boss.tierName = `브론즈 ${vault.boss.tier}`
        vault.boss.nextScore = TIER_BASE * 1.5 ** vault.boss.tier
      } else if (path.endsWith('/vault/card')) {
        vault.dungeon.cards.push(vault.dungeon.offers.find((c) => c.code === body.code))
        vault.dungeon.offers = []
      } else if (path.endsWith('/vault/floor')) {
        vault.dungeon.cleared = body.floor
        vault.gold += vault.dungeon.floorGold[body.floor - 1]
        vault.dungeon.offers = body.floor < 3 ? structuredClone(OFFERS) : []
      } else {
        const item = vault.shop.find((i) => path.endsWith(`/vault/shop/${i.code}`))
        vault.gold -= item.price
        item.left--
        vault.lastNote = '다이아 +300'
      }
    }
    return route.fulfill({ json: company })
  }
}

/** 전장이 열리면 빨리 돌리고, 끝나 시트로 돌아올 때까지 기다린다. 남은 시간(초)의 마지막 값을 돌려준다. */
async function fight(page, speed = 6) {
  const field = page.getByTestId('vault-field')
  await expect(field).toBeVisible()
  await expect(field.locator('.vault-health')).toBeVisible({ timeout: 60000 })
  await page.evaluate((k) => window.__mentalSpeed(k), speed)
  let left = 0
  while (await field.isVisible()) {
    const text = await field.locator('header small').textContent({ timeout: 1000 }).catch(() => null)
    const seconds = text?.match(/(\d+)초/)
    if (seconds) left = Number(seconds[1])
    await page.waitForTimeout(100)
  }
  return left
}

async function openVault(browser, company, calls, tune) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  if (tune) await page.addInitScript((t) => { window.__vaultTune = t }, tune)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, serve(company, calls))
  await page.goto(process.env.APP_URL ?? 'http://localhost:5182/app/', { timeout: 90000 })
  await expect(page.getByTestId('idle-canvas-loading')).toHaveCount(0, { timeout: 30000 })
  await page.getByTestId('vault-entry').click()
  await expect(page.getByTestId('vault-sheet')).toBeVisible()
  return { page, errors }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  if (process.env.VAULT_TUNE) {
    // 팀마다: 보스전의 피해량, 카드 없이 층마다 걸린 시간(실제 초, 240초가 끝).
    const tunes = JSON.parse(process.env.VAULT_TUNE)
    for (const tune of tunes) for (const [name, team] of Object.entries(TEAMS)) {
      console.log(JSON.stringify(tune))
      const company = companyOf(team)
      company.vault.dungeon.offers = []
      const calls = []
      const { page } = await openVault(browser, company, calls, tune)
      await page.getByRole('button', { name: '보스 도전' }).click()
      await fight(page)
      console.log(name, 'boss', calls.at(-1)?.body, await page.getByTestId('vault-note').textContent())
      if (process.env.VAULT_SHOT) await page.screenshot({ path: `${process.env.VAULT_SHOT}/${name}-boss.png` })
      await page.getByRole('button', { name: '주간 던전' }).click()
      for (const floor of [1, 2, 3]) {
        company.vault.dungeon.cleared = floor - 1
        company.vault.dungeon.offers = []
        await page.getByRole('button', { name: '보스전', exact: true }).click()
        await page.getByRole('button', { name: '주간 던전' }).click()
        await page.getByRole('button', { name: `${floor}층 입장` }).click()
        const left = await fight(page)
        console.log(name, 'floor', floor, 'left', left, await page.getByTestId('vault-note').textContent())
      }
      await page.close()
    }
  } else {
    const company = companyOf(TEAMS.team)
    const calls = []
    const { page, errors } = await openVault(browser, company, calls)
    // 보스전: 약점·내성·천적과 그것을 가진 내 고양이가 보인다.
    const traits = page.getByTestId('vault-traits')
    await expect(traits).toContainText('약점 스킬 ×2')
    await expect(traits).toContainText('내성 스킬 ×0.5')
    await expect(traits).toContainText('총 피해 ×3')
    await expect(traits.locator('[data-state="출전 중"]')).toHaveCount(4)
    await expect(traits).toContainText('은빛냥 · 출전 중')
    await expect(page.getByTestId('vault-sheet')).toContainText('새 금고까지 3일 4시간')
    await page.getByRole('button', { name: '보스 도전' }).click()
    const score = page.getByTestId('vault-score')
    await expect(score).toContainText('피해량')
    await fight(page)
    const boss = calls.find((call) => call.path.endsWith('/vault/boss'))
    assert.ok(boss.body.damage > 1000, `피해량 ${boss.body.damage}`)
    await expect(page.getByTestId('vault-note')).toContainText('금괴 +')
    assert.ok(company.vault.gold > 0)
    const afterBoss = company.vault.gold
    await expect(page.getByTestId('vault-gold')).toContainText(String(afterBoss))
    // 던전: 카드를 골라야 들어갈 수 있다.
    await page.getByRole('button', { name: '주간 던전' }).click()
    await expect(page.getByRole('button', { name: /층 입장/ })).toHaveCount(0)
    await expect(page.getByTestId('vault-offers').getByRole('button')).toHaveCount(3)
    await page.getByRole('button', { name: /금리 인하/ }).click()
    await expect(page.getByTestId('vault-picked')).toContainText('공격력 +25%')
    assert.deepEqual(calls.at(-1), { path: '/api/company/vault/card', body: { code: 'rate-cut' } })
    await page.getByRole('button', { name: '1층 입장 · 금괴 +30' }).click()
    await fight(page)
    assert.deepEqual(calls.at(-1), { path: '/api/company/vault/floor', body: { floor: 1 } })
    await expect(page.getByTestId('vault-note')).toContainText('1층 돌파 · 금괴 +30')
    await expect(page.getByTestId('vault-sheet')).toContainText('2층에 들고 갈 카드를 고르세요')
    // 금고 상점: 금괴로 산다. 모자라면 누를 수 없다.
    await page.getByRole('button', { name: '금고 상점' }).click()
    const items = page.getByTestId('vault-shop').locator('li')
    await expect(items).toHaveCount(2)
    await items.nth(0).getByRole('button').click()
    await expect(page.getByTestId('vault-note')).toContainText('다이아 +300')
    await expect(page.getByTestId('vault-gold')).toContainText(String(afterBoss))
    await expect(items.nth(0)).toContainText('이번 주 4/5')
    company.vault.gold = 0
    await items.nth(0).getByRole('button').click()
    await expect(items.nth(0).getByRole('button')).toBeDisabled()
    // 좁은 화면에서도 시트가 가로로 넘치지 않는다.
    await page.setViewportSize({ width: 320, height: 568 })
    await page.getByRole('button', { name: '보스전', exact: true }).click()
    const overflow = await page.evaluate(() => {
      const room = document.querySelector('.vault-room')
      return room.scrollWidth - room.clientWidth
    })
    assert.ok(overflow <= 1, `가로 넘침 ${overflow}px`)
    assert.deepEqual(errors, [])
    await page.close()
  }
} finally {
  await browser.close()
}
console.log('vault check passed')
