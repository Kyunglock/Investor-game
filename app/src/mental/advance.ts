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
