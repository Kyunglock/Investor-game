/** 막대 한쪽: 행동과 그 행동을 미는 성질 */
export interface Side {
  action: string
  trait: string
}

export interface Matchup {
  /** 내 쪽(고른 행동)을 지키는 능력치 코드 */
  stat: string
  mine: Side
  rival: Side
  /** 맞붙기 시작할 때 내 쪽이 차지한 몫(%). 능력치가 높을수록 크다 */
  start: number
  /** 내 쪽이 이겼는가 = 고른 대로 됐는가 */
  won: boolean
}

/** 엎치락뒤치락 간격(ms)과 흔들림 폭(%p). 점점 세게 밀고 당긴다. */
const STEP_MS = 210
const SWINGS = [9, 13, 11, 17, 14, 21]

/**
 * 막대가 움직이는 순서(내 쪽 몫 %, 시각 ms). 처음 몫에서 시작해 양쪽으로 점점 크게 밀고 당기다가, 마지막 흔들림은 지는 쪽이 거의
 * 이길 듯이 밀어붙이고, 그다음 이긴 쪽이 끝까지 쭉 민다.
 */
export function tugSteps(m: Matchup): { share: number; at: number }[] {
  // 마지막 흔들림이 지는 쪽으로 가도록 방향을 맞춘다.
  const toLoser = m.won ? -1 : 1
  const first = SWINGS.length % 2 === 0 ? -toLoser : toLoser
  const steps = [{ share: m.start, at: 0 }]
  SWINGS.forEach((swing, i) => {
    const dir = i % 2 === 0 ? first : -first
    steps.push({ share: clamp(m.start + dir * swing), at: (i + 1) * STEP_MS })
  })
  steps.push({ share: m.won ? 100 : 0, at: (SWINGS.length + 1) * STEP_MS + 120 })
  return steps
}

const clamp = (v: number) => Math.min(92, Math.max(8, v))
