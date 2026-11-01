import { useGameStore } from './store'

/**
 * 선택·결과 카드 안의 자동 진행 조각 (decisions.md 131·136번). 자동이 꺼져 있으면 켜는 버튼만, 켜져 있으면 "몇 초 뒤 저절로 넘어간다"는 진행
 * 막대와 끄는 버튼이다. 막대는 CSS로 durationMs 동안 차오르고, 카드가 바뀌면 key가 바뀌어 처음부터 다시 찬다.
 */
export function AutoBar({
  durationMs,
  label,
  restartKey,
}: {
  durationMs: number
  /** 막대 옆 설명. 예 "3초 뒤 성향과 안목이 대신 고릅니다" */
  label: string
  /** 바뀌면 막대가 처음부터 다시 찬다 (이벤트 ID 등) */
  restartKey: string
}) {
  const autoPlay = useGameStore((s) => s.autoPlay)
  const setAutoPlay = useGameStore((s) => s.setAutoPlay)
  if (!autoPlay) {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-faint">
        <span>직접 고르거나, 자동에게 맡길 수 있습니다.</span>
        <button
          type="button"
          className="min-h-8 shrink-0 rounded-full border border-line bg-card px-2.5 text-[11px] text-muted hover:bg-bg"
          onClick={() => setAutoPlay(true)}
          data-testid="card-auto-on"
        >
          ⟳ 자동 켜기
        </button>
      </div>
    )
  }
  return (
    <div className="mt-2 rounded bg-bg px-2.5 py-1.5" data-testid="auto-choosing">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
        <span>자동 진행 중 · {label}</span>
        <button
          type="button"
          className="min-h-7 shrink-0 rounded-full border border-line bg-card px-2 text-[11px] text-muted hover:bg-bg"
          onClick={() => setAutoPlay(false)}
          data-testid="card-auto-off"
        >
          자동 끄기
        </button>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft">
        <div
          key={restartKey}
          className="animate-auto-fill h-full rounded-full bg-teal"
          style={{ animationDuration: `${durationMs}ms` }}
          data-testid="auto-progress"
        />
      </div>
    </div>
  )
}
