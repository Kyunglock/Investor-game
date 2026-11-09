/// <reference lib="dom" />
/** 실제 앱 + Phaser, API만 가짜 응답. APP_URL/BROWSER_CHANNEL/CHROMIUM_PATH 지원. */
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'
import { company as fixture } from './fixture.ts'

const out = resolve(import.meta.dirname, 'shots/stage')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || undefined,
  executablePath: process.env.CHROMIUM_PATH || undefined,
})

/**
 * 공격 판 (decisions.md 413번, #573): 매도벽을 부수고 올라가는 판을 강화 단계별로 자동으로 돌린다. 개발 서버의 전투 모듈을 바로 불러 앱 위에 띄우고
 * (회의 → 전투 흐름은 앱이 맡는다), 개발 서버에서만 내보내는 `window.__mentalAutopilot`으로 사장냥이 약한 칸 밑으로 가고 바로 위 물량을 비키게 한다.
 * 카드는 자동 선택(401번 autoPickIndex)과 같은 규칙으로 고르고 Math.random은 씨앗을 고정한다. 강할수록 빨리 깨는지(걸린 시간이 줄어드는지) 본다.
 * STAGE_CHECK=assault면 이것만 돈다. ASSAULT_SHOTS에 벽 앞·벽이 무너진 뒤·보스 장면을 찍는다(없으면 shots/stage).
 */
async function assaultCheck() {
  const shots = process.env.ASSAULT_SHOTS ?? out
  mkdirSync(shots, { recursive: true })
  type Row = {
    label: string
    level: number
    win: boolean
    reason: string
    seconds: number
    wallsBroken: number
    wallsTotal: number
    mentalLeft: number
    maxMental: number
    stars: number
    kills: number
  }
  const configs = [
    { label: '강화 없음', level: 1, bonus: 0, shoot: false },
    { label: '공격·연사 +50%', level: 1, bonus: 50, shoot: true },
    { label: '공격·연사 +200%', level: 1, bonus: 200, shoot: false },
    { label: '강화 없음 · 판 level 2', level: 2, bonus: 0, shoot: false },
    { label: '공격·연사 +200% · 판 level 3', level: 3, bonus: 200, shoot: false },
    { label: '강화 없음 · 판 level 4', level: 4, bonus: 0, shoot: false },
  ]
  // 판마다 새 페이지(찍는 판만 배율 2).
  const only = process.env.ASSAULT_ONLY
  const picked = only
    ? configs.filter((c) => only.split(',').includes(String(configs.indexOf(c))))
    : configs
  const run = async (config: (typeof configs)[number]): Promise<Row> => {
    const started = Date.now()
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: config.shoot ? 2 : 1,
    })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
    await page.route(/\/api\/(company|sessions)(\/|$|\?)/, (route) =>
      route.fulfill({ json: { ...structuredClone(fixture), invest: null, lastSettlement: null } }),
    )
    await page.goto(process.env.APP_URL ?? 'http://127.0.0.1:5182/app/')
    await page.evaluate(
      async ({ level, bonus, salt }) => {
        // 같은 판이 같게 돌도록 씨앗을 고정한 난수(mulberry32).
        let seed = 573 + level * 7 + bonus + salt * 1000
        Math.random = () => {
          seed = (seed + 0x6d2b79f5) | 0
          let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
        const base = '/app/src/mental/'
        const [{ startBattle }, cards, { autoPickIndex }, { assaultSpec }, { DEFAULT_WEAPON }] =
          await Promise.all([
            import(/* @vite-ignore */ `${base}battle.ts`),
            import(/* @vite-ignore */ `${base}cards.ts`),
            import(/* @vite-ignore */ `${base}cardReveal.ts`),
            import(/* @vite-ignore */ `${base}assault.ts`),
            import(/* @vite-ignore */ `${base}hero.ts`),
          ])
        const host = document.createElement('div')
        host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#bfe8cf'
        document.body.append(host)
        const w = window as unknown as Record<string, unknown>
        let loadout = cards.loadoutOf(DEFAULT_WEAPON, [
          { kind: 'damage', bonusPercent: bonus },
          { kind: 'fire', bonusPercent: bonus },
        ])
        w.__assaultCards = [] as string[]
        const handle = startBattle(host, {
          mode: 'assault',
          assault: assaultSpec(level),
          genre: 'DEFENSE',
          hero: { name: '사장냥', weapon: DEFAULT_WEAPON, upgrades: [] },
          loadout,
          onHud: (hud: unknown) => {
            w.__assaultHud = hud
          },
          onBanner: () => {},
          onHurt: () => {},
          onLevelUp: () => {
            // 카드 자동 선택(401번)과 같은 규칙: 가장 높은 등급, 같으면 마법 > 고양이 > 일반.
            setTimeout(() => {
              const offer = cards.pickCards({ ...loadout })
              const card = offer[autoPickIndex(offer)]
              ;(w.__assaultCards as string[]).push(card.code)
              loadout = cards.applyCard(loadout, card)
              handle.applyLoadout(loadout)
            }, 0)
          },
          onDone: (outcome: unknown) => {
            w.__assaultOutcome = outcome
          },
        })
        ;(w.__mentalAutopilot as (on: boolean) => void)(true)
      },
      { ...config, salt: Number(process.env.ASSAULT_SEED ?? 0) },
    )
    type Hud = {
      boss: { hp: number } | null
      mental: number
      secondsLeft: number
      level: number
      assault: { stuck: boolean; wallsBroken: number }
    }
    let lastLog = -1
    const state = () =>
      page.evaluate(() => {
        const w = window as unknown as Record<string, unknown>
        return {
          hud: w.__assaultHud as Hud | undefined,
          outcome: w.__assaultOutcome as Row | undefined,
        }
      })
    const seen = { wall: false, collapse: false, boss: false }
    let broken = 0
    // 실제 시간으로 돌리되 전투를 SPEED배로(개발 서버에서만 내보내는 __mentalSpeed: 물리는 같은 고정 걸음을 더 밟는다). 찍는 판은 덜 빠르게.
    const speed = config.shoot ? 1.5 : Number(process.env.ASSAULT_SPEED ?? 3)
    let sped = false
    for (let t = 0; t < 400_000 / speed; t += 100) {
      await page.waitForTimeout(100)
      const { hud, outcome } = await state()
      if (outcome) break
      if (process.env.ASSAULT_DEBUG && hud && 120 - hud.secondsLeft >= lastLog + 5) {
        lastLog = 120 - hud.secondsLeft
        console.log(
          `  ${config.label} t=${lastLog} walls=${hud.assault.wallsBroken} stuck=${hud.assault.stuck} mental=${hud.mental} lv=${hud.level} boss=${hud.boss ? hud.boss.hp.toFixed(2) : '-'}`,
        )
      }
      if (hud && !sped) {
        sped = true
        await page.evaluate(
          (k) => (window as unknown as { __mentalSpeed: (k: number) => void }).__mentalSpeed(k),
          speed,
        )
      }
      if (!config.shoot || !hud?.assault) continue
      // 화면 셋: 첫 벽 앞에 멈춰 쏘는 중, 벽이 막 무너진 뒤(치고 오르는 중), 큰손 보스.
      if (!seen.wall && hud.assault.stuck && hud.assault.wallsBroken === 0 && t > 3000) {
        seen.wall = true
        await page.screenshot({ path: resolve(shots, 'assault-wall.png') })
      }
      if (!seen.collapse && hud.assault.wallsBroken > broken && hud.assault.wallsBroken >= 2) {
        seen.collapse = true
        await page.screenshot({ path: resolve(shots, 'assault-collapse.png') })
      }
      broken = hud.assault.wallsBroken
      if (!seen.boss && hud.boss) {
        seen.boss = true
        await page.waitForTimeout(2500)
        await page.screenshot({ path: resolve(shots, 'assault-boss.png') })
      }
    }
    await page.waitForTimeout(1500)
    const { outcome } = await state()
    assert(outcome, `${config.label}: battle ends`)
    for (const key of [
      'win',
      'stars',
      'seconds',
      'mentalLeft',
      'maxMental',
      'kills',
      'wallsBroken',
      'wallsTotal',
    ])
      assert(key in outcome, `outcome has ${key}`)
    const picked = await page.evaluate(
      () => (window as unknown as { __assaultCards: string[] }).__assaultCards,
    )
    console.log(
      `assault ${config.label}: ${outcome.win ? 'clear' : outcome.reason} ${outcome.seconds}s, cards ${picked.join(',')} (${Math.round((Date.now() - started) / 1000)}s real)`,
    )
    assert.deepEqual(errors, [], `${config.label}: no page errors`)
    await page.close()
    return { ...outcome, label: config.label, level: config.level }
  }
  // 한 판씩 차례로: 여럿을 함께 돌리면 프레임이 떨어져 자동 조종이 굼떠지고 결과가 흔들렸다.
  const rows: Row[] = []
  for (const config of picked) rows.push(await run(config))
  if (only) return
  console.log('| 설정 | 판 level | 깼나 | 걸린 시간(초) | 부순 벽 | 남은 멘탈 | 별 | 처치 |')
  console.log('|---|---|---|---|---|---|---|---|')
  for (const r of rows)
    console.log(
      `| ${r.label} | ${r.level} | ${r.win ? '깼다' : `못 깸(${r.reason})`} | ${r.seconds} | ${r.wallsBroken}/${r.wallsTotal} | ${r.mentalLeft}/${r.maxMental} | ${r.stars} | ${r.kills} |`,
    )
  // 강할수록 빨리: 같은 판(level 1)에서 가장 센 강화(+200%)는 강화 없음·+50%보다 빨리, 절반 시간 안에 깬다. +50%와 강화 없음은 카드(마법·고양이) 운과
  // 프레임에 따라 몇십 초씩 흔들려 순서만 알린다.
  const [none, half, triple] = rows
  assert(triple.win, '+200% clears')
  assert(triple.seconds < half.seconds || !half.win, 'stronger clears faster (+200% < +50%)')
  assert(triple.seconds < none.seconds || !none.win, 'stronger clears faster (+200% < none)')
  assert(triple.seconds <= 60, '+200% clears within half the time')
  if (none.win && half.seconds > none.seconds)
    console.log(`note: +50% (${half.seconds}s) slower than none (${none.seconds}s) this run`)
}

if (process.env.STAGE_CHECK === 'assault') {
  try {
    await assaultCheck()
    console.log('PASS: assault (sell walls) at several upgrade levels')
  } finally {
    await browser.close()
  }
  process.exit(0)
}
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  await page.clock.install()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('investor-game.tutorial', 'done'))
  let company = {
    ...structuredClone(fixture),
    invest: null,
    lastSettlement: null,
    mental: { genre: 'DEFENSE', headline: '불안한 소문이 거리를 가득 채웠어요', done: false },
    stages: {
      best: 0,
      last: 10,
      perChapter: 10,
      stars: [] as number[],
      bonusPercent: 0,
      exAvailable: true,
      lastResult: null as null | Record<string, unknown>,
    },
    armory: { tickets: 0, mergeCount: 2, lastDraw: null },
    weapons: [
      {
        kind: 'pistol',
        name: '권총',
        grade: 'N',
        gradeName: '일반',
        damagePercent: 100,
        fireMs: 260,
        power: 1,
        bulletSpeed: 720,
        equipped: true,
        count: 1,
      },
      {
        kind: 'pistol',
        name: '권총',
        grade: 'R',
        gradeName: '희귀',
        damagePercent: 120,
        fireMs: 240,
        power: 1,
        bulletSpeed: 720,
        equipped: false,
        count: 1,
      },
    ],
    upgrade: { ...fixture.upgrade, years: 2, left: null },
  }
  let reports = 0
  await page.route(/\/api\/(company|sessions)(\/|$|\?)/, async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/weapon')) {
      const selected = route.request().postDataJSON()
      company = {
        ...company,
        weapons: company.weapons.map((w) => ({
          ...w,
          equipped: w.kind === selected.kind && w.grade === selected.grade,
        })),
      }
    }
    if (path.endsWith('/stage')) {
      reports++
      if (reports === 1)
        return route.fulfill({
          status: 400,
          json: { message: '연결을 확인하고 다시 저장해주세요.' },
        })
      const { stage, cleared, stars } = route.request().postDataJSON()
      company = {
        ...company,
        stages: {
          ...company.stages,
          lastResult: { stage, cleared, stars, firstClear: false, capital: 0, tickets: 0 },
        },
      }
    }
    await route.fulfill({ json: company })
  })
  /** 위의 흰 판 없이 조각이 제자리에 있는지 (decisions.md 390번): 레벨은 왼쪽 가장자리, 시간·일시정지는 오른쪽 위, 멘탈 게이지는 멘탈벽 그림 위. */
  const checkHud = async () => {
    const { width, height } = page.viewportSize() ?? { width: 0, height: 0 }
    const box = async (id: string) => {
      const b = await page.getByTestId(id).boundingBox()
      assert(b, id)
      return b
    }
    const level = await box('battle-level')
    assert(level.x >= 0 && level.x + level.width <= 50, 'level at left edge')
    assert(level.height > level.width * 3, 'level stands vertical')
    const timer = await box('battle-timer')
    const pause = await box('mental-quit')
    assert(timer.x > width / 2 && pause.x + pause.width <= width, 'timer and pause at top right')
    assert(timer.y + timer.height < 70 && pause.y + pause.height < 70, 'corner stays small')
    // 멘탈벽 줄은 stageArt.ts wallOffset과 같다. 벽 그림은 그 줄 위 24px ~ 아래 48px.
    const wallY = height - Math.max(150, Math.min(230, height * 0.26))
    const wall = await box('battle-wall')
    assert(wall.y >= wallY && wall.y + wall.height <= wallY + 48, 'mental gauge on the wall')
  }
  /**
   * 카드 고르기 (decisions.md 393번): 석 장이 뒤집힌 채 나와 한 장씩 펼쳐지고, 다 펼친 뒤에만 고른다. 다 펼치기 전에 누르면 남은 카드를 한 번에 펼친다.
   * 펼치는 순서는 setTimeout이라 Playwright 시계로 넘긴다.
   */
  const pickCard = async (prefer: readonly string[] = []) => {
    const panel = page.getByTestId('mental-cards')
    // 처음 누름은 남은 카드를 펼치고(이미 다 펼쳐졌으면 바로 고른다), 다음 누름이 고른다. prefer에 든 카드가 있으면 그것을 고른다.
    for (let i = 0; i < 3 && (await panel.count()); i++) {
      const wanted = panel.locator(
        prefer.map((code) => `button[data-card="${code}"]`).join(', ') || 'button',
      )
      await ((await wanted.count()) ? wanted : panel.getByRole('button')).first().click()
      await page.clock.runFor(400)
    }
    await expect(panel).toHaveCount(0)
  }
  const faces = () =>
    page
      .getByTestId('mental-cards')
      .getByRole('button')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-face')))
  /**
   * 펼치는 동안을 지켜본다: 시계를 멈추고 50ms씩 넘기며, 늘 왼쪽부터 앞면인지 보고, 카드 하나의 모습이 바뀔 때마다(떨림·누움·앞면) CSS 연출이 도는
   * 중간에 찍는다. CSS 애니메이션은 실제 시간으로 돌아 찍기 전에 잠깐 기다린다. 다 펼쳐 고를 수 있게 되면 시계를 다시 흘린다.
   */
  const watchReveal = async (name: string) => {
    // 페이지가 바쁘면 페이지의 Date.now가 시계보다 조금 늦을 수 있어, 과거라고 거절되면 조금 더 앞에서 멈춘다.
    for (const ahead of [120, 400, 900]) {
      const paused = await page.clock
        .pauseAt((await page.evaluate(() => Date.now())) + ahead)
        .then(() => true)
        .catch(() => false)
      if (paused) break
    }
    let before = (await faces()).join(' ')
    let shot = 0
    for (let t = 0; t < 7000; t += 50) {
      const now = await faces()
      const firstHidden = now.findIndex((f) => f !== 'front')
      assert(
        firstHidden === -1 || now.slice(firstHidden).every((f) => f !== 'front'),
        `reveals from the left: ${now}`,
      )
      if (now.join(' ') !== before) {
        before = now.join(' ')
        await page.waitForTimeout(now.includes('tease') ? 260 : 140)
        await page.screenshot({ path: resolve(out, `${name}-${++shot}.png`) })
      }
      if ((await page.getByTestId('mental-cards').getAttribute('data-revealed')) === 'true') break
      await page.clock.runFor(50)
    }
    await expect(page.getByTestId('mental-cards')).toHaveAttribute('data-revealed', 'true')
    assert.deepEqual(await faces(), ['front', 'front', 'front'])
    await page.clock.resume()
    return shot
  }
  const base = process.env.APP_URL ?? 'http://127.0.0.1:5182/app/'
  await page.goto(base)
  // 무기는 메인의 무기 인벤토리에서 고른다 (#564). 출전 화면에는 든 무기만 보인다.
  await page.getByTestId('open-weapons').click()
  await expect(page.getByTestId('toy-weapons-sheet')).toBeVisible()
  await page.locator('[data-testid=weapon][data-grade=R]').click()
  await expect(page.locator('[data-testid=weapon][data-grade=R]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.screenshot({ path: resolve(out, 'weapons.png') })
  await page.getByRole('button', { name: '닫기' }).first().click()
  await page.getByTestId('stage-open').click()
  await page.locator('[data-testid=stage][data-stage="1"]').click()
  await expect(page.getByTestId('mental-lobby')).toBeVisible()
  await expect(page.getByTestId('weapon-picker')).toHaveCount(0)
  await expect(page.getByTestId('stage-weapon')).toBeVisible()
  await page.screenshot({ path: resolve(out, 'lobby.png') })
  await page.setViewportSize({ width: 320, height: 640 })
  await page.getByTestId('mental-start').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(out, 'lobby-small.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByTestId('mental-start').click()
  await expect(page.getByTestId('mental-cards')).toBeVisible({ timeout: 30000 })
  await expect(page.getByTestId('battle-timer')).toHaveText('2:00')
  // 처음엔 석 장 모두 뒷면이고 아직 못 고른다. 누르지 않으면 왼쪽부터 한 장씩 펼쳐진다.
  const first = await faces()
  assert(!first.includes('front') && first[2] === 'back', `starts face down: ${first}`)
  await expect(page.getByTestId('mental-cards')).toHaveAttribute('data-revealed', 'false')
  await page.screenshot({ path: resolve(out, 'cards-back.png') })
  assert((await watchReveal('cards-reveal')) >= 2, 'cards turn over in turn')
  await page.waitForTimeout(700)
  await page.screenshot({ path: resolve(out, 'cards.png') })
  await pickCard()
  await expect(page.getByTestId('mental-cards')).toHaveCount(0)
  await page.clock.runFor(5000)
  await checkHud()
  await page.screenshot({ path: resolve(out, 'battle.png') })
  // 데미지 숫자 (decisions.md 391번): 한 방에 죽는 패닉과 죽이는 마지막 한 방에도 뜨고, 풀(36+8)을 넘지 않는다.
  type DamageStats = {
    shown: Record<string, number>
    merged: number
    killing: number
    peak: number
    casts: Record<string, number>
    mateShots: number
    mates: number
  }
  const damage = () =>
    page.evaluate(() => (window as unknown as { __mentalDamage: DamageStats }).__mentalDamage)
  const firstDamage = await damage()
  assert(firstDamage.shown.bullet > 0, 'bullet damage numbers shown')
  assert(firstDamage.killing > 0, 'killing blow shows a number')
  assert(firstDamage.peak <= 44, 'damage numbers stay within the pool')
  await page.waitForTimeout(2100)
  await page.screenshot({
    path: resolve(out, 'battle-preview.jpg'),
    type: 'jpeg',
    quality: 85,
    scale: 'css',
  })
  await page.setViewportSize({ width: 320, height: 640 })
  await page.clock.runFor(100)
  await page.screenshot({ path: resolve(out, 'battle-small.png') })
  await checkHud()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.runFor(100)
  // 첫 파도(15초, 투매 떼)가 쏟아질 때 숫자가 화면을 덮지 않는지 본다.
  for (let i = 0; i < 9; i++) {
    if (await page.getByTestId('mental-cards').count()) {
      await pickCard()
    }
    await page.clock.runFor(1500)
  }
  await page.screenshot({ path: resolve(out, 'damage-wave.png') })
  const waveDamage = await damage()
  assert(waveDamage.shown.bullet > firstDamage.shown.bullet, 'numbers keep coming in the wave')
  assert(waveDamage.peak <= 44, 'damage numbers stay within the pool in the wave')
  console.log('damage numbers', JSON.stringify(waveDamage))
  // 마법 (decisions.md 392번): 레벨 1·2·3을 바로 넣어 총알과 따로 나가는 연출을 레벨마다 찍는다. 카드를 고르면 앱의 수치로 돌아가니 다시 넣는다.
  // 끝나면 마법을 빼 아래의 벽 피격 검사가 그대로 돈다.
  const setMagic = (level: number) =>
    page.evaluate(
      (l) =>
        (
          window as unknown as { __mentalMagic: (levels: Record<string, number>) => void }
        ).__mentalMagic({ water: l, fire: l, lightning: l }),
      level,
    )
  const pickIfAsked = async (level: number) => {
    if (await page.getByTestId('mental-cards').count()) {
      // 마법 카드를 골라 앱의 마법 레벨도 올린다: 아래의 펼치기 중간 프레임에 영웅·전설 카드가 나오게.
      await pickCard(['fire', 'water', 'lightning'])
      await setMagic(level)
    }
  }
  const beforeMagic = await damage()
  for (const level of [1, 2, 3]) {
    await pickIfAsked(level)
    await setMagic(level)
    for (const [i, ms] of [140, 460, 400].entries()) {
      await page.clock.runFor(ms)
      await page.screenshot({ path: resolve(out, `magic-lv${level}-${i + 1}.png`) })
    }
    for (let i = 0; i < 4; i++) {
      await page.clock.runFor(600)
      await pickIfAsked(level)
    }
  }
  const afterMagic = await damage()
  for (const m of ['water', 'fire', 'lightning']) {
    assert(afterMagic.casts[m] >= beforeMagic.casts[m] + 3, `${m} magic casts on its own`)
    assert(afterMagic.shown[m] > beforeMagic.shown[m], `${m} magic shows its damage numbers`)
  }
  assert(afterMagic.peak <= 44, 'damage numbers stay within the pool with magic')
  console.log('magic', JSON.stringify(afterMagic.casts))
  // 카드 펼치기 중간 프레임 (393번): 마법을 2레벨로 두면 영웅·전설 카드가 잘 나온다. 다음 카드 고르기가 뜰 때까지 싸우고, 펼치는 동안을 찍는다.
  await pickIfAsked(2)
  await setMagic(2)
  for (let i = 0; i < 30 && (await page.getByTestId('mental-cards').count()) === 0; i++) {
    await page.clock.runFor(800)
    await setMagic(2)
  }
  if (await page.getByTestId('mental-cards').count()) {
    const grades = await page
      .getByTestId('mental-cards')
      .getByRole('button')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-grade')))
    console.log('reveal grades', grades.join(' '))
    await watchReveal('cards-reveal-lv')
    await pickCard()
  }
  // 함께 싸우는 고양이 (393번): 개발 서버에서만 내보내는 __mentalMates로 고양이 1·2·3마리(사장냥까지 2·3·4)를 세우고, 저마다 쏘는지 본다.
  const setMates = (n: number) =>
    page.evaluate(
      (m) => (window as unknown as { __mentalMates: (n: number) => void }).__mentalMates(m),
      n,
    )
  await setMagic(1)
  for (const mates of [1, 2, 3]) {
    let shot = false
    // 레벨이 올라 카드 고르기가 뜨면 전투가 멈춰 쏘지 않으니 고르고 다시 본다.
    for (let attempt = 0; attempt < 4 && !shot; attempt++) {
      await pickIfAsked(1)
      await setMates(mates)
      await page.clock.runFor(700)
      if (await page.getByTestId('mental-cards').count()) continue
      // 적이 다 쓸려 과녁이 없을 수 있어 위를 눌러 쏘게 한다: 고양이도 누른 곳을 제 총으로 겨눈다.
      const before = await damage()
      await page.mouse.move(195, 260)
      await page.mouse.down()
      await page.clock.runFor(600)
      await page.mouse.up()
      const after = await damage()
      assert.equal(after.mates, mates, 'mates stand in line')
      shot = after.mateShots > before.mateShots
    }
    assert(shot, `${mates} mate(s) shoot`)
    await page.clock.runFor(300)
    await page.screenshot({ path: resolve(out, `mates-${mates + 1}.png`) })
  }
  await page.setViewportSize({ width: 320, height: 640 })
  await page.clock.runFor(300)
  await page.screenshot({ path: resolve(out, 'mates-4-small.png') })
  await checkHud()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.runFor(100)
  await setMates(0)
  await pickIfAsked(0)
  await setMagic(0)
  await setMates(0)
  // 2분 판은 레벨이 빨리 올라 그사이 카드 고르기가 떠 있을 수 있다.
  if (await page.getByTestId('mental-cards').count()) {
    await pickCard()
  }
  await page.getByTestId('mental-quit').click()
  await expect(page.getByTestId('mental-quit-ask')).toBeVisible()
  const pausedTime = await page.getByTestId('battle-timer').textContent()
  await page.clock.runFor(2000)
  await expect(page.getByTestId('battle-timer')).toHaveText(pausedTime ?? '')
  await page.screenshot({ path: resolve(out, 'pause.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('mental-quit-ask')).toHaveCount(0)
  // 아래로 쏘아 멘탈벽의 피격·균열·패배 및 저장 재시도를 실제 전투로 확인한다. 깎이는 것은 벽 위의 게이지에서 보인다.
  const mentalNow = () =>
    page
      .getByRole('progressbar', { name: '멘탈벽 내구도' })
      .getAttribute('aria-valuenow')
      .then(Number)
  const fullMental = await mentalNow()
  await page.mouse.move(195, 800)
  await page.mouse.down()
  for (let i = 0; i < 16 && (await page.getByTestId('mental-result').count()) === 0; i++) {
    await page.clock.runFor(5000)
    if (await page.getByTestId('mental-cards').count()) {
      await page.mouse.up()
      await pickCard()
      // 고른 카드가 마법이어도 빼 둔다: 마법은 총알과 따로 나가 아래로 쏘아도 적을 잡는다(392번). 고양이 카드(393번)도 빼 둔다.
      await setMagic(0)
      await setMates(0)
      await page.mouse.move(195, 800)
      await page.mouse.down()
    }
    if (i === 2) {
      assert((await mentalNow()) < fullMental, 'wall gauge drops')
      await page.screenshot({ path: resolve(out, 'wall-contact.png') })
    }
  }
  await page.mouse.up()
  await expect(page.getByTestId('mental-result')).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: '멘탈 전투', exact: true }).getByRole('alert'),
  ).toContainText('연결을 확인')
  await page.screenshot({ path: resolve(out, 'result.png') })
  await page.getByTestId('mental-done').click()
  await expect(page.getByTestId('mental-reward')).toHaveText('깨면 자본과 무기 뽑기권을 받는다.')
  assert.equal(reports, 2)
  await page.getByTestId('mental-done').click()
  await expect(page.getByTestId('mental-result')).toHaveCount(0)
  // 두 장르 모두 같은 방어선·로딩 복구를 지원한다.
  company = { ...company, mental: { ...company.mental, genre: 'ASSAULT', done: false } }
  const enemyAsset = /\/assets\/enemies(?:-[\w-]+)?\.png$/
  await page.route(enemyAsset, (route) => route.fulfill({ status: 404, body: '' }))
  await page.reload()
  await page.getByTestId('stage-open').click()
  await page.locator('[data-testid=stage][data-stage="1"]').click()
  await page.getByTestId('mental-start').click()
  await expect(
    page.getByRole('dialog', { name: '멘탈 전투', exact: true }).getByRole('alert'),
  ).toContainText('전장 그림', { timeout: 30000 })
  await page.unroute(enemyAsset)
  await page.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(page.getByTestId('mental-cards')).toBeVisible({ timeout: 30000 })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('mental-quit-ask')).toBeVisible()
  await page.getByTestId('mental-quit-yes').click()
  await expect(page.getByTestId('battle-canvas')).toHaveCount(0)
  assert.deepEqual(errors, [])
  await assaultCheck()
  console.log(
    'PASS: assault sell walls by upgrade level, stage pick, lobby, equipment, real Phaser/sprites, first card pause, face-down cards revealed one by one and skip, HUD layout, damage numbers, magic Lv.1-3, mates 2-4 cats shooting, aiming, wall gauge damage, pause/resume, loss, failed save/retry, both genres, asset load retry, quit cleanup',
  )
} finally {
  await browser.close()
}
