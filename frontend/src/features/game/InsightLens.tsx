import { GradeBadge } from './GradeBadge'

/** 안목 구간. 서버의 힌트 구체성(Hint.Detail)과 같은 경계다: 30 · 60 · 80 (decisions.md 53번). */
export type LensTier = 'low' | 'mid' | 'high' | 'expert'

export function lensTier(insight: number): LensTier {
  if (insight < 30) {
    return 'low'
  }
  if (insight < 60) {
    return 'mid'
  }
  return insight < 80 ? 'high' : 'expert'
}

const LENS: Record<LensTier, { level: number; label: string; text: string }> = {
  low: { level: 1, label: '흐릿하게 읽힌다', text: 'animate-lens-low italic opacity-80' },
  mid: { level: 2, label: '대강 읽힌다', text: 'animate-lens-mid' },
  high: { level: 3, label: '또렷하게 읽힌다', text: 'animate-lens-high' },
  expert: { level: 4, label: '꿰뚫어 본다', text: 'animate-lens-expert font-semibold' },
}

/**
 * 뉴스·빚투 카드의 힌트를 "내 안목으로 읽은" 것처럼 보여 준다 (decisions.md 161번). 안목 등급·점수와 네 칸 눈금, 읽히는 정도를 적고,
 * 힌트 글은 흐릿한 데서 초점이 맞으며 나타난다. 안목이 높을수록 빨리 또렷해지고, 낮으면 끝까지 조금 흐리다. 움직임을 줄이는 설정이면 바로 보인다.
 */
export function InsightLens({
  insight,
  hint,
  subject,
  accuracy,
}: {
  insight: number
  hint: string
  /** 빚투처럼 종목에 대한 해석이면 그 종목 이름 */
  subject?: string
  /**
   * 힌트가 맞을 확률(퍼센트, 서버가 안목으로 계산). 뉴스 힌트는 방향이 맞을 확률, 빚투는 그 종목 해석이 맞을 확률이다. null이면 힌트가 방향을 못 읽었다.
   * 없으면 읽히는 정도를 글로 적는다.
   */
  accuracy?: number | null
}) {
  const tier = lensTier(insight)
  const lens = LENS[tier]
  const reading =
    accuracy === undefined
      ? lens.label
      : accuracy === null
        ? '방향은 못 읽었다'
        : `맞출 확률 ${accuracy}%`
  return (
    <div
      className="mt-3 border-l-[3px] border-teal bg-teal-soft px-2.5 py-2"
      data-testid="insight-lens"
      data-tier={tier}
    >
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-[#3b5a52]">
        <span aria-hidden="true">🔍</span>
        <span>내 안목{subject ? `으로 본 ${subject}` : ''}</span>
        <GradeBadge score={insight} />
        <span className="font-mono-num">{insight}</span>
        <span
          className="ml-0.5 inline-flex gap-[3px]"
          role="img"
          aria-label={`안목 ${lens.level}/4단계`}
        >
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={`inline-block h-1.5 w-3 rounded-full ${n <= lens.level ? 'bg-teal' : 'bg-[#c9ddd5]'}`}
            />
          ))}
        </span>
        <span className="font-semibold" data-testid="insight-lens-label">
          {reading}
        </span>
      </p>
      <p
        // 등장할 때마다 초점 맞추기를 다시 하도록 글이 바뀌면 새로 그린다.
        key={hint}
        className={`mt-1 font-mono-num text-xs text-[#3b5a52] ${lens.text}`}
        data-testid="hint"
      >
        {hint}
      </p>
    </div>
  )
}
