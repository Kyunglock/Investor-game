import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const out = '/tmp/claude-0/-home-user-Investor-game/4ca1151a-fe21-52a5-a0ab-54146801bf0f/scratchpad/app790'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })
const KINDS = [['pistol','권총'],['revolver','리볼버'],['smg','기관단총'],['shotgun','산탄총'],['rifle','소총']]
const GR = ['F','E','D','F','C','F','E','B','F','A','D']
try {
  for (const width of [390, 320]) {
   for (const poor of [false, true]) {
    const company = {
      ...structuredClone(fixture),
      armory: { mergeCount: 2, lastDraw: null, lastDraws: [] },
      battleUpgrades: [
        {
          kind: 'damage',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 10,
          maxLevel: 0,
        },
        {
          kind: 'fire',
          level: 100,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 100,
          nextBonusPercent: 100,
          maxLevel: 100,
        },
        {
          kind: 'hp',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 10,
          maxLevel: 0,
        },
        {
          kind: 'buy',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 10,
          maxLevel: 0,
        },
        {
          kind: 'crit',
          level: 0,
          price: 1000000,
          priceGrowthPercent: 10,
          bonusPercent: 0,
          nextBonusPercent: 20,
          maxLevel: 0,
        },
      ],
      idle: {
        wall: 1,
        hp: 120,
        maxHp: 120,
        dps: 12,
        earned: 0,
        boss: false,
        circuitSeconds: 0,
        upcoming: [] as { wall: number; hp: number; maxHp: number }[],
        skills: [
          { code: 'water', name: '물 스킬', owned: false, level: 0 },
          { code: 'meteor', name: '메테오 스킬', owned: false, level: 0 },
          { code: 'bolt', name: '번개 스킬', owned: false, level: 0 },
          { code: 'ram', name: '충차 스킬', owned: false, level: 0 },
        ],
        fieldSlots: 4,
        wallDps: 0,
        // Real-time income (#803): the HUD shows it under the capital. No offline payout yet.
        income: { perSecond: 48_500, staffPerSecond: 12_500, bonusPercent: 0 },
        offline: null as { at: number; seconds: number; earned: number; capped: boolean } | null,
        cats: [
          // Each cat has a skill of its own (decisions.md 501).
          ['sky', '하늘냥', 125, 100, 'meteor', '메테오 스킬'],
          ['mint', '민트냥', 100, 100, 'water', '물 스킬'],
          ['lilac', '라일락냥', 100, 150, 'bolt', '번개 스킬'],
          ['sunset', '노을냥', 110, 100, 'ram', '충차 스킬'],
          ['night', '밤냥', 100, 125, 'meteor', '메테오 스킬'],
          ['snow', '눈꽃냥', 140, 100, 'water', '물 스킬'],
        ].map(([code, name, firePercent, criticalPercent, skill, skillName]) => ({
          code,
          name,
          level: 0,
          damagePercent: 50,
          firePercent,
          criticalPercent,
          fielded: false,
          skill,
          skillName,
          // A skill gains a level with every two cat levels (decisions.md 515).
          skillLevel: 1,
          skillNextLevel: 3,
          weapon: null as { kind: string; grade: string } | null,
        })),
      },
    }

    const c: any = company
    if (poor) c.diamonds.amount = 50
    if (poor) c.employees = c.employees.slice(0, 5)
    c.idle.cats.slice(0, 3).forEach((cat: any) => { cat.level = 1; cat.fielded = true })
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 844 } })
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
    await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const path = new URL(route.request().url()).pathname
      const sent = route.request().postDataJSON?.() ?? null
      if (path.endsWith('/cat/draw') && sent?.count === 10) {
        c.diamonds.amount -= c.diamonds.tenDraw
        c.idle.lastDraws = Array.from({ length: 11 }, (_, i) => {
          const cat = c.idle.cats[i % 6]
          cat.level++
          return { code: cat.code, level: cat.level, isNew: cat.level === 1 }
        })
      } else if (path.endsWith('/weapon/draw') && sent?.count === 10) {
        c.diamonds.amount -= c.diamonds.tenDraw
        c.armory.lastDraws = GR.map((grade, i) => ({ kind: KINDS[i % 5][0], name: KINDS[i % 5][1], grade, gradeName: grade, isNew: i < 3 }))
      }
      return route.fulfill({ json: c })
    })
    const tag = `${width}${poor ? '-poor' : ''}`
    const shot = async (name: string) => {
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${out}/${tag}-${name}.png` })
      const sw = await page.evaluate(() => document.documentElement.scrollWidth)
      console.log(tag, name, 'scrollWidth', sw)
    }
    await page.goto(process.env.APP_URL!)
    await page.getByTestId('idle-diamonds').waitFor()
    await page.waitForTimeout(1500)
    await shot('idle-hud')
    await page.getByRole('button', { name: '고양이' }).click()
    await shot('cat-draw')
    if (!poor) {
      await page.getByTestId('cat-draw-ten').click()
      await page.getByTestId('cat-ten-card').first().waitFor()
      await page.waitForTimeout(1600)
      await shot('cat-ten')
      console.log(tag, 'cat cards', await page.getByTestId('cat-ten-card').count())
      await page.getByTestId('cat-ten-close').click()
    }
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    await page.getByRole('button', { name: '성장' }).click()
    await page.getByRole('tab', { name: /인벤토리/ }).click()
    await page.getByTestId('weapon-draw').scrollIntoViewIfNeeded()
    await shot('weapon-draw')
    if (!poor) {
      c.diamonds.amount = 2100
      await page.reload()
      await page.getByRole('button', { name: '성장' }).click()
      await page.getByRole('tab', { name: /인벤토리/ }).click()
      await page.getByTestId('weapon-draw-ten').click()
      await page.getByTestId('weapon-ten-card').first().waitFor()
      await page.waitForTimeout(1600)
      await shot('weapon-ten')
      const boxes = await page.getByTestId('weapon-ten-card').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }))
      console.log(tag, 'weapon cards', JSON.stringify(boxes))
      const again = await page.getByTestId('weapon-ten-again').boundingBox()
      console.log(tag, 'again', JSON.stringify(again))
      await page.getByTestId('weapon-ten-close').click()
    }
    await page.getByRole('button', { name: '닫기 ✕' }).click()
    await page.getByRole('button', { name: '회사 메뉴' }).click()
    await shot('company-wallets')
    await page.getByTestId('tab-issue').click()
    await shot('issue-hud')
    await page.getByTestId('tab-market').click()
    await page.getByTestId('gacha-scene').waitFor()
    await shot('gacha-scene')
    await page.close()
   }
  }
} finally {
  await browser.close()
}
