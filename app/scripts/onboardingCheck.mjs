import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox'],
})
try {
  for (const width of [320, 390]) {
    const c = structuredClone(fixture)
    c.idle = {
      wall: 1,
      hp: 1200,
      maxHp: 1200,
      dps: 0,
      earned: 0,
      boss: false,
      circuitSeconds: 0,
      sequence: 0,
      cleared: 0,
      upcoming: [],
      skills: [],
      fieldSlots: 4,
      wallDps: 0,
      power: 1,
      income: { perSecond: 0, staffPerSecond: 0, bonusPercent: 0 },
      offline: null,
      activeSlots: 3,
      actives: [
        {
          code: 'barrage',
          name: '매수세례',
          equipped: true,
          ad: false,
          readyIn: 0,
          left: 0,
          cooldown: 40,
          seconds: 0,
        },
      ],
      cats: [
        {
          code: 'night',
          name: '밤냥',
          grade: 'A',
          level: 0,
          damagePercent: 100,
          firePercent: 100,
          criticalPercent: 100,
          fielded: false,
          skills: [{ code: 'meteor', name: '메테오' }],
          skillLevel: 1,
          skillNextLevel: 10,
          weapon: null,
        },
      ],
      onboarding: {
        step: 0,
        catClaimed: false,
        weaponClaimed: false,
        skillsUnlocked: false,
        skillGuideSeen: false,
      },
    }
    c.battleUpgrades = [
      {
        kind: 'damage',
        level: 0,
        price: 1,
        damagePercent: 0,
        bonusPercent: 0,
        priceGrowthPercent: 4,
        maxLevel: 0,
      },
    ]
    c.weapons = [
      {
        kind: 'pistol',
        grade: 'F',
        name: '권총',
        gradeName: 'F',
        count: 1,
        equipped: true,
        damagePercent: 100,
        fireMs: 260,
        power: 1,
        bulletSpeed: 720,
      },
    ]
    c.armory = { mergeCount: 2, lastDraw: null, lastDraws: [] }
    const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 844 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
      const url = route.request().url()
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null
      const p = c.idle.onboarding
      if (url.endsWith('/idle/tutorial')) {
        if (body.action === 'next') {
          assert.equal(body.step, p.step)
          if (p.step === 2) {
            p.catClaimed = true
            c.idle.cats[0].level = 1
          }
          if (p.step === 4) {
            p.weaponClaimed = true
            c.weapons.push({
              ...c.weapons[0],
              kind: 'smg',
              grade: 'B',
              gradeName: 'B',
              name: '기관단총',
              equipped: false,
            })
          }
          p.step++
        } else if (body.action === 'skills') p.skillGuideSeen = true
        else {
          p.step = 8
          p.catClaimed = true
          p.weaponClaimed = true
        }
      }
      if (url.includes('/battle-upgrade')) c.battleUpgrades[0].level = 1
      if (url.endsWith('/cat/field')) c.idle.cats[0].fielded = body.fielded
      if (url.endsWith('/cat/weapon')) c.idle.cats[0].weapon = c.weapons[1]
      await route.fulfill({ json: c })
    })
    const refresh = async () => {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('loading')).toHaveCount(0, { timeout: 30000 })
    }
    page.setDefaultTimeout(12000)
    page.setDefaultNavigationTimeout(15000)
    await page.goto(process.env.APP_URL ?? 'http://localhost:5187/app/', {
      waitUntil: 'domcontentloaded',
    })
    const guide = page.getByTestId('idle-tutorial')
    await expect(guide).toHaveAttribute('data-step', '0')
    await expect(page.getByRole('button', { name: '성장', exact: false }).first()).toBeDisabled()
    await expect(page.getByTestId('idle-active')).toHaveCount(0)
    await page.locator('[data-testid=idle-canvas] canvas').waitFor()
    await expect(page.getByTestId('loading')).toHaveCount(0, { timeout: 30000 })
    await page.screenshot({ path: `/tmp/tutorial-existing-${width}.png` })
    c.idle.wall = 2
    c.idle.cleared = 1
    await refresh()
    await guide.getByRole('button', { name: '다음', exact: true }).click()
    await guide.getByRole('button', { name: '성장 메뉴 열기' }).click()
    await page.locator('[data-testid=idle-stat][data-kind=damage] button').click()
    await guide.getByRole('button', { name: '다음', exact: true }).click()
    await guide.getByRole('button', { name: 'A등급 밤냥 받기' }).click()
    await guide.getByRole('button', { name: '밤냥 출전하러 가기' }).click()
    await page.getByTestId('cat-field').click()
    await guide.getByRole('button', { name: '다음', exact: true }).click()
    await guide.getByRole('button', { name: 'B등급 기관단총 받기' }).click()
    await guide.getByRole('button', { name: '밤냥 무기 목록 열기' }).click()
    await page.locator('[data-testid=cat-weapon][data-grade=B]').click()
    await page.getByTestId('gear-equip').click()
    await expect(guide.getByRole('button', { name: '다음', exact: true })).toBeVisible()
    await page.screenshot({ path: `/tmp/tutorial-equip-${width}.png` })
    await refresh()
    await expect(guide).toHaveAttribute('data-step', '5')
    await guide.getByRole('button', { name: '다음', exact: true }).click()
    await guide.getByRole('button', { name: '다음', exact: true }).click()
    await guide.getByRole('button', { name: '돌파 시작!' }).click()
    await expect(guide).toHaveCount(0)
    await expect(page.getByRole('button', { name: '스킬', exact: false }).first()).toBeDisabled()
    c.idle.wall = 101
    c.idle.onboarding.skillsUnlocked = true
    await refresh()
    await expect(guide).toContainText('스킬 해금!')
    await guide.getByRole('button', { name: '스킬 장착하러 가기' }).click()
    await guide.getByRole('button', { name: '돌파 화면에서 사용하기' }).click()
    await expect(guide).toHaveCount(0)
    await expect(page.getByTestId('idle-active')).toBeVisible()
    await page.getByTestId('idle-options').click()
    await page.getByRole('button', { name: '첫 출근 안내 다시 보기' }).click()
    await expect(guide).toContainText('다시 보기')
    await guide.getByRole('button', { name: '닫기', exact: true }).click()
    assert.equal(c.idle.onboarding.step, 8)
    assert.equal(c.weapons.length, 2)
    c.idle.onboarding = {
      step: 0,
      catClaimed: false,
      weaponClaimed: false,
      skillsUnlocked: false,
      skillGuideSeen: false,
    }
    await refresh()
    await guide.getByRole('button', { name: '건너뛰기', exact: true }).click()
    await expect(guide).toContainText('밤냥과 기관단총은 그대로 받아요')
    await guide.getByRole('button', { name: '선물 받고 건너뛰기' }).click()
    await expect(guide).toHaveCount(0)
    assert.equal(c.idle.onboarding.catClaimed, true)
    assert.equal(c.idle.onboarding.weaponClaimed, true)
    await refresh()
    await expect(guide).toHaveCount(0)
    c.idle.onboarding.catClaimed = false
    c.idle.onboarding.weaponClaimed = false
    await refresh()
    await expect(guide).toHaveCount(0)
    await page.getByTestId('idle-options').click()
    await page.getByRole('button', { name: '첫 출근 선물 받기 · 밤냥 + 기관단총' }).click()
    assert.equal(c.idle.onboarding.catClaimed, true)
    await expect(
      page.getByRole('button', { name: '첫 출근 선물 받기 · 밤냥 + 기관단총' }),
    ).toHaveCount(0)
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('기존 UI 320/390px: 출전·장착·재접속·100벽 해금·다시 보기 통과')
} finally {
  await browser.close()
}
