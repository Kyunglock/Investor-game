import type { EnemyKind } from './enemies'

/**
 * 전진 모드 (decisions.md 364번, #487): 주 콘텐츠. 사장냥이 위로 올라가는 길을 따라 구간을 하나씩 넘는다. 구간마다 길을 막는 적 무리가 나오고, 다 잡아야
 * 화면이 올라가 다음 구간이 열린다. 마지막 구간을 넘기면 클리어(보스는 다음 PR). 제한 시간(BATTLE_SECONDS)은 상한이라, 강하면 빨리 깬다. 이 파일은
 * Phaser 없이 규칙만 갖는다.
 */

export type BattleMode = 'advance' | 'defense'

/** 한 구간에서 길을 막는 적: 종류와 수. */
export interface Segment {
  blockers: ReadonlyArray<{ kind: EnemyKind; count: number }>
}

/** 다섯 구간: 뒤로 갈수록 단단한 적(투매·손절)이 늘고, 셋째부터 투기가 섞인다. */
export const SEGMENTS: readonly Segment[] = [
  { blockers: [{ kind: 'dump', count: 6 }] },
  {
    blockers: [
      { kind: 'dump', count: 6 },
      { kind: 'stop', count: 2 },
    ],
  },
  {
    blockers: [
      { kind: 'dump', count: 8 },
      { kind: 'stop', count: 2 },
      { kind: 'spec', count: 1 },
    ],
  },
  {
    blockers: [
      { kind: 'dump', count: 8 },
      { kind: 'stop', count: 4 },
      { kind: 'spec', count: 1 },
    ],
  },
  {
    blockers: [
      { kind: 'dump', count: 10 },
      { kind: 'stop', count: 4 },
      { kind: 'spec', count: 2 },
    ],
  },
]

/**
 * 마지막 보스 (364번, #487): 다섯 구간을 넘으면 '패닉셀 대장'이 나온다. 패닉셀 그림을 크게 키워 쓴다. 화면 위쪽에서 좌우로 오가며 졸개 패닉셀을 사장냥
 * 쪽으로 내려보내고, 체력이 반 아래로 떨어지면 더 자주 부른다. 잡으면 클리어다.
 */
export const BOSS = {
  name: '패닉셀 대장',
  kind: 'panic' as EnemyKind,
  hp: 60,
  /** 보통 적 크기에 곱하는 배율. */
  scale: 2.6,
  /** 부딪히면 깎는 멘탈. */
  dmg: 15,
  /** 졸개를 부르는 간격(초)과 한 번에 부르는 수. 체력이 반 아래면 간격이 이만큼 줄어든다. */
  summonSeconds: 2.4,
  summonCount: 3,
  enragedFactor: 0.6,
}

/** 보스가 졸개를 부르는 간격(초): 체력이 반 아래면 더 잦다. */
export function bossSummonSeconds(hpLeft: number): number {
  return hpLeft <= BOSS.hp / 2 ? BOSS.summonSeconds * BOSS.enragedFactor : BOSS.summonSeconds
}

/** 한 구간을 넘겨 화면이 올라가는 시간(초). */
export const SCROLL_SECONDS = 1.2

/** 구간 사이사이 길을 막지 않고 달려드는 패닉셀의 간격(초). */
export const TRICKLE_SECONDS = 1.6

/** 한 줄에 서는 길막 적의 수. */
const PER_ROW = 4

/** 구간의 길막 적을 줄 세운 자리: 화면 위 바깥에서 줄지어 들어온다. 단단한 적이 앞줄이다. */
export function formation(
  segment: Segment,
  width: number,
): Array<{ kind: EnemyKind; x: number; y: number }> {
  const order: EnemyKind[] = ['stop', 'dump', 'spec']
  const kinds = order.flatMap((kind) =>
    segment.blockers
      .filter((b) => b.kind === kind)
      .flatMap((b) => Array<EnemyKind>(b.count).fill(kind)),
  )
  return kinds.map((kind, i) => {
    const row = Math.floor(i / PER_ROW)
    const inRow = Math.min(PER_ROW, kinds.length - row * PER_ROW)
    const col = i % PER_ROW
    const span = width * 0.7
    const x = width * 0.15 + ((col + 0.5) * span) / inRow
    return { kind, x, y: -40 - row * 56 }
  })
}

/** 별을 매기는 데 쓰는 한 판의 결과 (364번). */
export interface AdvanceResult {
  win: boolean
  seconds: number
  mentalLeft: number
  maxMental: number
}

/**
 * 별 (decisions.md 364번, #493): 깨면 ★1, 제한 시간의 절반 안에 깨면 ★ 하나 더, 멘탈을 반 넘게 남기면 ★ 하나 더. 못 깨면 0.
 */
export function stars(r: AdvanceResult, limitSeconds: number): number {
  if (!r.win) {
    return 0
  }
  return 1 + (r.seconds <= limitSeconds / 2 ? 1 : 0) + (r.mentalLeft > r.maxMental / 2 ? 1 : 0)
}
