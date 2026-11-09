/// <reference lib="dom" />
/**
 * 멘탈 스테이지 난이도 재기 (#565): 실제 앱 + Phaser를 띄우고 API만 가짜 응답으로, 고른 스테이지를 손대지 않고(자동 조준·카드 자동 선택 #566) 끝까지
 * 돌려 깼는지·별·남은 멘탈·처치 수를 적는다. 개발 서버(`pnpm dev --port 5182`)를 띄운 뒤
 * `node scripts/balanceCheck.ts`. 바꿀 것: STAGES(예 "1,3,5,10"), RUNS(스테이지마다 판 수), WEAPON(kind:damagePercent:fireMs:power),
 * UPGRADE(공격%:연사%, 자본 전투 강화의 누적 효과). APP_URL/BROWSER_CHANNEL/CHROMIUM_PATH 지원.
 */
import { chromium } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const stages = (process.env.STAGES ?? '1,2,3,5,7,10').split(',').map(Number)
const runs = Number(process.env.RUNS ?? 2)
const [kind, damagePercent, fireMs, power] = (process.env.WEAPON ?? 'pistol:100:260:0').split(':')
const [atk, fire] = (process.env.UPGRADE ?? '0:0').split(':').map(Number)
const base = process.env.APP_URL ?? 'http://127.0.0.1:5182/app/'

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.CHROMIUM_PATH || undefined,
})
const rows: string[] = []
try {
  for (const stage of stages) {
    for (let run = 0; run < runs; run++) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
      await page.clock.install()
      await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
      const company = {
        ...structuredClone(fixture),
        invest: null,
        lastSettlement: null,
        mental: { genre: 'DEFENSE', headline: '', done: false },
        stages: {
          best: stage - 1,
          last: 10,
          perChapter: 10,
          stars: Array.from({ length: stage - 1 }, () => 3),
          bonusPercent: 0,
          exAvailable: false,
          lastResult: null,
        },
        armory: { tickets: 0, mergeCount: 2, lastDraw: null },
        weapons: [
          {
            kind,
            name: kind,
            grade: 'N',
            gradeName: '일반',
            damagePercent: Number(damagePercent),
            fireMs: Number(fireMs),
            power: Number(power),
            bulletSpeed: 720,
            equipped: true,
            count: 1,
          },
        ],
        battleUpgrades: [
          { kind: 'damage', level: atk, price: 0, bonusPercent: atk, nextBonusPercent: atk + 1 },
          { kind: 'fire', level: fire, price: 0, bonusPercent: fire, nextBonusPercent: fire + 1 },
        ],
      }
      await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
        route.fulfill({ json: company }),
      )
      await page.goto(base)
      await page.getByTestId('stage-open').click()
      await page.locator(`[data-testid=stage][data-stage="${stage}"]`).click()
      await page.getByTestId('mental-start').click()
      await page.getByTestId('battle-timer').waitFor({ timeout: 30000 })
      const result = page.getByTestId('mental-result')
      for (let s = 0; s < 400 && !(await result.count()); s++) await page.clock.runFor(1000)
      const stars = Number(await page.getByTestId('mental-stars').getAttribute('data-stars'))
      const text = ((await result.textContent()) ?? '').replace(/\s+/g, ' ')
      const left = text.match(/남은 멘탈\s*(\d+)/)?.[1]
      const kills = text.match(/물리친 적\s*(\d+)/)?.[1]
      const row = `stage ${stage} run ${run + 1}: ${stars > 0 ? '깸' : '실패'} ★${stars} 멘탈 ${left} 처치 ${kills}`
      console.log(row)
      rows.push(row)
      await page.close()
    }
  }
} finally {
  await browser.close()
}
