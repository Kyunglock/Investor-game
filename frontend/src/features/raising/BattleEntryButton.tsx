import './battle-entry.css'

/** 회의 결과와 사무실에서 같은 전투로 이어지는 입구. */
export function BattleEntryButton({
  mode,
  onClick,
  disabled,
  compact = false,
  testId,
}: {
  mode: 'ASSAULT' | 'DEFENSE'
  onClick: () => void
  disabled?: boolean
  compact?: boolean
  testId: string
}) {
  return (
    <button
      type="button"
      className={`battle-entry${compact ? ' battle-entry-compact' : ''}`}
      data-mode={mode}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
    >
      <BattleEntryContent mode={mode} disabled={disabled} compact={compact} />
    </button>
  )
}

/** 사무실의 분기 버튼 안에서도 같은 아이콘과 문구를 쓴다. */
export function BattleEntryContent({
  mode,
  disabled,
  compact = false,
}: {
  mode: 'ASSAULT' | 'DEFENSE'
  disabled?: boolean
  compact?: boolean
}) {
  const assault = mode === 'ASSAULT'
  return (
    <>
      <span className="battle-entry-icon" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="36" height="36" fill="none" aria-hidden="true">
          {assault ? (
            <>
              <path
                d="M5 28V16h8v12M17 28V8h8v20M29 28V14h6v14"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
                opacity=".55"
              />
              <path
                d="M4 33 16 21l7 4L36 8m-10 0h10v10"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <path
              d="M20 4 34 10v12c0 7-8 12-14 15C14 34 6 29 6 22V10L20 4Zm-7 15 5 5 10-11"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </span>
      <span className="battle-entry-copy">
        <small>{disabled ? '처리 중…' : '종목회의 스테이지'}</small>
        <strong>{assault ? '매도벽 돌파!' : '멘탈 방어!'}</strong>
        {!compact && <span>{assault ? '회의 수익을 키워요' : '회의 손실을 줄여요'}</span>}
      </span>
      {!compact && (
        <span className="battle-entry-arrow" aria-hidden="true">
          ➜
        </span>
      )}
    </>
  )
}
