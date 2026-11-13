import type { EnemyKind, OrderKind } from './enemies'
import { SHARES_PER_HP } from './shares'

/**
 * 공격 판: 매도벽을 부수고 올라간다 (decisions.md 413번, #573). 종목 회의에서 맞혔을 때 들어가는 판이다. 길을 가로로 막는 **매도벽**(호가 칸이 줄지어
 * 쌓인 벽, 칸마다 체력과 물량)을 쏘아 부숴야 다음 구간(다음 호가)으로 오른다. 진행은 시간이 아니라 **벽을 부수는 속도**로 정해진다: 세면 빨리 녹여 빨리
 * 오르고, 약하면 벽 앞에 막혀 그동안 몰려오는 **매도 물량**(enemies.ts ORDERS)에 시달린다. 마지막 구간은 가장 두꺼운 대량 매도벽과 그 앞의 큰손 보스.
 * 이 파일은 Phaser 없이 규칙과 숫자만 갖는다. 그리는 것과 움직임은 battle.ts(mode 'assault').
 */

/** 벽 앞에서 쏟아지는 매도 물량과 고양이 몹(패닉셀·투매·손절·투기·공매도)의 종류(벽 칸·보스는 빼고). */
export type FlowKind = Exclude<OrderKind, 'cell' | 'whale'> | EnemyKind

/** 매도벽 하나. */
export interface AssaultWall {
  /** 칸이 쌓인 줄 수: 위 구간일수록 두껍다. 맨 아랫줄부터 맞는다. */
  rows: number
  /** 칸 하나의 바탕 체력: 가로 ASSAULT_COLS칸 기준이고, 좁은 화면에서 칸이 줄면 한 줄의 체력이 같게 칸 체력이 는다(cellHps). */
  cellHp: number
  /** 마지막 대량 매도벽: 벽 앞에 큰손 보스가 선다. */
  boss: boolean
  /** 중간 매도벽 (#593): 벽 앞에 중간 큰손(체력 MID_BOSS_HP배)이 선다. 잡아야 다음 구간으로 간다(판이 끝나지는 않는다). */
  mid?: boolean
  /** 벽 앞(또는 벽이 다가오는 동안)에서 매도 물량이 나오는 바탕 간격(초). 벽 앞에 오래 막힐수록 짧아진다(spawnSeconds). */
  spawnSeconds: number
  /** 나오는 물량의 비중. */
  mix: Readonly<Partial<Record<FlowKind, number>>>
}

/**
 * 열 구간 (level 1 기준, #593에서 다섯 → 열): 뒤로 갈수록 두껍고 단단하며 물량이 잦고 무겁다. 손절은 처음부터, 투기는 셋째 벽부터, 공매도는
 * 넷째 벽부터 섞여 뒤로 갈수록 잦다. 다섯째는 중간 큰손이 선 중간 매도벽, 열째는 대량
 * 매도벽 + 큰손. 판이 길어진 만큼 벽 하나는 다섯 구간 때보다 얇다(강화 없는 권총으로 3분 안에 겨우 깬다, stageCheck).
 */
export const ASSAULT_WALLS: readonly AssaultWall[] = [
  {
    rows: 1,
    cellHp: 4.7,
    boss: false,
    spawnSeconds: 1.6,
    mix: { panic: 2, dump: 1, order: 5, market: 3, stop: 0.5 },
  },
  {
    rows: 1,
    cellHp: 5.8,
    boss: false,
    spawnSeconds: 1.5,
    mix: { panic: 2, dump: 1, order: 5, market: 3, fake: 1, stop: 0.7 },
  },
  {
    rows: 1,
    cellHp: 6.8,
    boss: false,
    spawnSeconds: 1.45,
    mix: { panic: 2, dump: 1, order: 4, market: 3, fake: 1, stop: 1, spec: 0.4 },
  },
  {
    rows: 2,
    cellHp: 4.4,
    boss: false,
    spawnSeconds: 1.4,
    mix: {
      panic: 2,
      dump: 1,
      order: 4,
      market: 3,
      bulk: 1,
      fake: 1,
      stop: 1,
      spec: 0.5,
      short: 0.4,
    },
  },
  {
    rows: 2,
    cellHp: 5.2,
    boss: false,
    mid: true,
    spawnSeconds: 1.35,
    mix: {
      panic: 2,
      dump: 1,
      order: 4,
      market: 3,
      bulk: 1,
      fake: 1,
      stop: 1,
      spec: 0.6,
      short: 0.5,
    },
  },
  {
    rows: 1,
    cellHp: 8.9,
    boss: false,
    spawnSeconds: 1.3,
    mix: {
      panic: 2,
      dump: 1,
      order: 4,
      market: 4,
      bulk: 1,
      fake: 1,
      stop: 1,
      spec: 0.6,
      short: 0.6,
    },
  },
  {
    rows: 2,
    cellHp: 5.2,
    boss: false,
    spawnSeconds: 1.25,
    mix: {
      panic: 2,
      dump: 1,
      order: 4,
      market: 4,
      bulk: 1.5,
      fake: 1,
      stop: 1.2,
      spec: 0.7,
      short: 0.7,
    },
  },
  {
    rows: 2,
    cellHp: 5.8,
    boss: false,
    spawnSeconds: 1.2,
    mix: {
      panic: 2,
      dump: 1,
      order: 3,
      market: 4,
      bulk: 1.5,
      fake: 1,
      stop: 1.2,
      spec: 0.8,
      short: 0.8,
    },
  },
  {
    rows: 2,
    cellHp: 6.3,
    boss: false,
    spawnSeconds: 1.15,
    mix: {
      panic: 2,
      dump: 1,
      order: 3,
      market: 4,
      bulk: 2,
      fake: 1,
      stop: 1.2,
      spec: 0.8,
      short: 0.9,
    },
  },
  {
    rows: 3,
    cellHp: 5.2,
    boss: true,
    spawnSeconds: 1.1,
    mix: { panic: 2, dump: 1, order: 3, market: 4, bulk: 2, fake: 1, stop: 1.2, spec: 1, short: 1 },
  },
]

/** 공격 판의 제한 시간(초): 구간이 열이라 디펜스(BATTLE_SECONDS 2분)보다 길다 (#593). */
export const ASSAULT_SECONDS = 180

/**
 * 벽 사이의 잡몹 구간 (#593): 벽을 부순 뒤 다음 벽이 내려오기 전 이만큼(초) 위에서 매도 물량 떼만 몰려온다. 그동안도 천천히 오른다. 세도 판이 너무 빨리
 * 끝나지 않고, 벽만 부수지 않고 물량과도 싸운다.
 */
export const ASSAULT_RUSH = {
  seconds: 5,
  /** 이 구간에서 물량이 나오는 간격은 다음 벽의 바탕 간격에 이 비율을 곱한다(더 잦다). */
  spawnFactor: 0.55,
}

/** 중간 큰손의 이름과 체력: 큰손(ASSAULT_BOSS.hp)의 이 비율. */
export const MID_BOSS_NAME = '매도 큰손'

export const MID_BOSS_HP = 0.5

/** 매도벽을 모두 부수면(클리어) 오르는 종목 가격(%): 클리어 추가 수익 100%(453·455번)와 같다 (457번). */
export const CLEAR_PRICE_PERCENT = 100

/** 매도 물량 하나를 잡으면 가격이 오르는 몫: 벽 하나의 한 칸(tick)의 이 비율 (#593). 457번에서 한 칸이 2% → 10%로 커져 0.05 → 0.01. */
export const ORDER_PRICE_SHARE = 0.01

/** 벽 한 줄의 바탕 칸 수(넓은 화면). 좁은 화면(360px 밑)은 하나 적다. */
export const ASSAULT_COLS = 6

/** level이 1 오를 때마다 붙는 배율: 벽 칸 체력·물량 체력·수·빠르기·멘탈 피해·보스 체력. */
export const ASSAULT_STEP = {
  wallHp: 0.15,
  enemyHp: 0.1,
  count: 0.05,
  speed: 0.04,
  dmg: 0.05,
  bossHp: 0.15,
  /** 빠르기 배율의 상한 (#594). */
  speedCap: 1.6,
}

/** 큰손 보스 (365번 보스의 짜임을 그대로): 벽 앞에서 좌우로 오가며 시장가 매도를 쏟아 내고, 체력이 반 아래면 더 잦다. */
export const ASSAULT_BOSS = {
  name: '대량 매도 큰손',
  hp: 70,
  /** 졸개를 부르는 간격(초)과 한 번에 부르는 수. 체력이 반 아래면 간격이 이만큼 줄어든다. */
  summonSeconds: 2.2,
  summonCount: 4,
  enragedFactor: 0.6,
  /** 잡으면 남은 대량 매도벽 칸마다 최대 체력의 이만큼을 깎는다("큰손이 손을 뗐다"). */
  wallBreak: 0.4,
}

/** 오르는 움직임 (#573 "올라가는 모션"): 벽이 없을 때 천천히 오르는 빠르기(px/s), 벽을 뚫을 때 치고 오르는 빠르기와 그 시간(초). */
export const ASSAULT_MOTION = {
  /** 파편이 떨어지는 모습을 보여 준 뒤 다음 벽으로 전진한다. */
  breakSeconds: 1.5,
  drift: 85,
  dash: 950,
  dashSeconds: 0.75,
  /** 다음 벽이 놓이는 거리: 멈춘 벽 줄에서 화면 높이의 이만큼 위. */
  gap: 0.62,
}

export interface AssaultSpec {
  /** 난이도(1부터, 소수도 된다). */
  level: number
  walls: readonly AssaultWall[]
  /** 매도 물량의 체력·빠르기·멘탈 피해·나오는 수 배율. */
  enemyHp: number
  enemySpeed: number
  enemyDmg: number
  enemyCount: number
  bossHp: number
  /** 중간 큰손의 체력. */
  midBossHp: number
  /** 가격 눈금: 시작 가격과 벽 하나를 부술 때마다 오르는 한 칸(원). */
  startPrice: number
  tick: number
  /** 벽에 붙는 이름(종목 이름). 없으면 "매도벽". */
  name: string
}

/**
 * 공격 판 하나 (decisions.md 413번). **level**은 1부터의 난이도다(소수 가능, 1 아래는 1). 회의 쪽(부르는 곳)이 기사의 크기·"크게"(260번)·지난 분기 수(분기마다 +1, 464번)·깬 최고
 * 번호 스테이지로 정해 넘긴다. level이 1 오를 때마다 벽 칸 체력 +15%, 물량 체력 +10%, 나오는 수 +5%, 빠르기 +4%, 멘탈 피해 +5%, 보스 체력 +15%(477번, 전에는 45·30·15·4·15·45%).
 * level 1은 강화 없는 권총으로 3분(ASSAULT_SECONDS) 안에 겨우 깨는 판이다(scripts/stageCheck.ts의 공격 판 표).
 * price는 시작 가격(원, 없으면 10,000), tickPercent는 벽 하나에 오르는 비율(%). 없으면 벽을 모두 부쉈을 때 +100%가 되게 100 ÷ 벽 수(457번,
 * 클리어 추가 수익 100%와 맞춘다. 전에는 2%라 다 부숴도 +20%였다).
 */
export function assaultSpec(
  level = 1,
  opts: { name?: string; price?: number; tickPercent?: number } = {},
): AssaultSpec {
  const k = Math.max(0, (Number.isFinite(level) ? level : 1) - 1)
  const wallHp = 1 + k * ASSAULT_STEP.wallHp
  const startPrice = Math.max(1, Math.round(opts.price ?? 10000))
  return {
    level: 1 + k,
    walls: ASSAULT_WALLS.map((w) => ({ ...w, cellHp: w.cellHp * wallHp })),
    enemyHp: 1 + k * ASSAULT_STEP.enemyHp,
    // 세기가 커져도(#594) 물량이 너무 빨라 피할 수 없게 되지 않도록 빠르기는 1.6배까지.
    enemySpeed: Math.min(ASSAULT_STEP.speedCap, 1 + k * ASSAULT_STEP.speed),
    enemyDmg: 1 + k * ASSAULT_STEP.dmg,
    enemyCount: 1 + k * ASSAULT_STEP.count,
    bossHp: ASSAULT_BOSS.hp * (1 + k * ASSAULT_STEP.bossHp),
    midBossHp: ASSAULT_BOSS.hp * MID_BOSS_HP * (1 + k * ASSAULT_STEP.bossHp),
    startPrice,
    tick: Math.max(
      1,
      Math.round(
        (startPrice * (opts.tickPercent ?? CLEAR_PRICE_PERCENT / ASSAULT_WALLS.length)) / 100,
      ),
    ),
    name: opts.name ?? '매도벽',
  }
}

/**
 * 자동 전투의 wall번째 벽 앞 물량 (493번): 예전 매도벽 돌파 미션처럼 열 벽 한 바퀴 안에서는 미션의 벽 차례대로 물량 구성과 등장 간격이 무거워지고,
 * 열 벽을 넘길 때마다 미션 레벨이 하나 오른 만큼 수·빠르기·공격이 는다. 벽은 늘 한 줄이고 체력은 서버가 정한다. 물량 하나의 체력(주식 수)은
 * 그대로 둔다: 물량 그림의 주식 수가 한 번만 구워지기 때문이다.
 */
export function idleAssaultSpec(wall: number): AssaultSpec {
  const at = Math.max(0, Math.floor(wall) - 1)
  const spec = assaultSpec(1 + Math.floor(at / ASSAULT_WALLS.length))
  const template = ASSAULT_WALLS[at % ASSAULT_WALLS.length]
  return {
    ...spec,
    enemyHp: 1,
    walls: [{ ...template, rows: 1, mid: false, boss: Math.floor(wall) % 10 === 0 }],
  }
}

/** 화면 폭에 맞는 한 줄의 칸 수. */
export function wallCols(width: number): number {
  return width < 360 ? ASSAULT_COLS - 1 : ASSAULT_COLS
}

/**
 * 벽 한 줄 칸들의 체력: 바탕은 cellHp × (ASSAULT_COLS / cols)라 칸 수가 달라도 한 줄의 체력은 같다. 줄마다 칸 하나는 **약한 칸**(절반 남짓)이고
 * 그만큼을 나머지 칸이 나눠 가진다: 좌우로 움직여 약한 칸을 노리면 먼저 뚫린다. random은 약한 칸 자리와 칸마다의 들쭉날쭉(±15%)에 쓴다.
 */
export function rowHps(cellHp: number, cols: number, random: () => number = Math.random): number[] {
  const base = (cellHp * ASSAULT_COLS) / cols
  const weak = Math.floor(random() * cols)
  const raw = Array.from({ length: cols }, (_, i) => (i === weak ? 0.5 : 0.85 + random() * 0.3))
  const sum = raw.reduce((a, b) => a + b, 0)
  return raw.map((f) => (f / sum) * base * cols)
}

/** 칸 체력이 얼마면 약한 칸으로 보이나: 바탕 칸 체력의 이 비율 밑. */
export const WEAK_CELL = 0.7

/** 칸에 적힌 물량(주): 체력에 비례하고 100주 단위. 맞을수록 남은 체력만큼 깎여 보인다(0이 되기 전엔 적어도 100주). */
export function cellShares(maxHp: number, hpLeft: number): number {
  const full = Math.max(1, Math.round((maxHp * SHARES_PER_HP) / 100)) * 100
  if (hpLeft <= 0) return 0
  return Math.max(100, Math.ceil((full * Math.min(1, hpLeft / maxHp)) / 100) * 100)
}

/**
 * 벽 앞에서 물량이 나오는 간격(초): 바탕 간격을 판의 수 배율로 나누고, 벽 앞에 막힌 시간(stuck초)이 길수록 더 잦다(25초마다 한 배씩, 최소 0.3초).
 * 벽이 아직 다가오는 중이면(arrived false) 두 배 느리다.
 */
export function spawnSeconds(
  wall: AssaultWall,
  spec: AssaultSpec,
  stuck: number,
  arrived: boolean,
): number {
  const base = wall.spawnSeconds / spec.enemyCount / (1 + Math.max(0, stuck) / 25)
  return Math.max(0.3, arrived ? base : base * 2)
}

/** 비중대로 하나 고른다. r은 0~1. */
export function pickFlow(mix: AssaultWall['mix'], r: number): FlowKind {
  const entries = Object.entries(mix).filter(([, w]) => (w ?? 0) > 0) as [FlowKind, number][]
  const total = entries.reduce((a, [, w]) => a + w, 0)
  let x = Math.min(0.999999, Math.max(0, r)) * total
  for (const [kind, w] of entries) {
    if (x < w) return kind
    x -= w
  }
  return entries[entries.length - 1]?.[0] ?? 'order'
}

/** 시장가 매도는 떼로: 한 번에 나오는 수. */
export function swarmSize(spec: AssaultSpec, r: number): number {
  return Math.round((3 + Math.floor(r * 3)) * Math.min(2, spec.enemyCount))
}

/** 벽 사이 잡몹 구간에서 물량이 나오는 간격(초): 다음 벽의 바탕 간격 × spawnFactor ÷ 수 배율, 최소 0.3초. */
export function rushSpawnSeconds(next: AssaultWall, spec: AssaultSpec): number {
  return Math.max(0.3, (next.spawnSeconds * ASSAULT_RUSH.spawnFactor) / spec.enemyCount)
}

/** 매도 물량 하나를 잡으면 오르는 가격(원, 적어도 1). */
export function orderPriceStep(spec: AssaultSpec): number {
  return Math.max(1, Math.round(spec.tick * ORDER_PRICE_SHARE))
}

/** 벽을 broken개 부순 뒤의 가격과 목표가(마지막 벽까지 다 부순 가격). 잡은 물량으로 오른 몫(#593)은 부르는 쪽이 더한다. */
export function assaultPrice(spec: AssaultSpec, broken: number): number {
  return spec.startPrice + spec.tick * Math.max(0, Math.min(spec.walls.length, broken))
}
export function assaultTarget(spec: AssaultSpec): number {
  return assaultPrice(spec, spec.walls.length)
}

/** 보스가 졸개를 부르는 간격(초): 체력이 반 아래면 더 잦다. */
export function whaleSummonSeconds(hpLeft: number, maxHp: number): number {
  return hpLeft <= maxHp / 2
    ? ASSAULT_BOSS.summonSeconds * ASSAULT_BOSS.enragedFactor
    : ASSAULT_BOSS.summonSeconds
}

/**
 * 벽을 뚫은 뒤 지난 시간(초)에 따른 오르는 빠르기(px/s): 처음엔 dash로 쭉 치고 올라 dashSeconds에 걸쳐 drift까지 줄어든다. 줄인 움직임이면 치고
 * 오르기 없이 drift의 두 배로 고르게 오른다.
 */
export function climbSpeed(sinceBreak: number, reduced = false): number {
  const { drift, dash, dashSeconds } = ASSAULT_MOTION
  if (reduced) return drift * 2
  if (sinceBreak >= dashSeconds) return drift
  const t = Math.max(0, sinceBreak) / dashSeconds
  return drift + (dash - drift) * (1 - t) ** 2
}

/** 돌파 진행률로 평가한다 (455번): 제한 시간 안에 100% 돌파하면 3개, 미완료는 50% 이상 2개, 25% 이상 1개. */
export function assaultStars(win: boolean, wallsBroken: number): number {
  const total = ASSAULT_WALLS.length
  if (win && wallsBroken >= total) return 3
  if (wallsBroken * 2 >= total) return 2
  return wallsBroken * 4 >= total ? 1 : 0
}

/**
 * 매도벽 경험치 (#700): 벽 층 하나를 부수면 enemies.ts의 매도벽 reward(30), 벽 하나를 통째로 무너뜨리면 다음 레벨까지 드는 경험치의
 * WALL_BREAK_XP_SHARE만큼을 한 번 더 준다. 전에는 층 하나에 5뿐이고 무너뜨려도 따로 없어 카드 강화가 늦었다.
 */
export const WALL_BREAK_XP_SHARE = 0.4

/** 벽 하나를 무너뜨렸을 때 더 주는 경험치: 지금 레벨에서 다음 레벨까지 드는 몫(xpNeeded)의 WALL_BREAK_XP_SHARE. */
export function wallBreakXp(xpNeeded: number): number {
  return Math.max(1, Math.round(xpNeeded * WALL_BREAK_XP_SHARE))
}
