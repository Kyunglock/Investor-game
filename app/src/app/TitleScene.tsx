import { BuildingArt } from '@web/features/raising/BuildingArt'
import { useTutorial } from '@web/features/raising/tutorial'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'

/**
 * 제목 화면 (decisions.md 302·309·310번): 어두운 바탕에 반지하 사무실과 제목이 줄줄이 떠오른다. "터치해서 시작"을 누르면 튜토리얼과 함께 시작·바로 시작이
 * 나온다. 처음 온 사람에게는 튜토리얼을 먼저 권한다.
 */
export function TitleScene({
  onOpen,
  busy,
  error,
}: {
  onOpen: (tutorial: boolean) => void
  busy: boolean
  error: string | null
}) {
  const fresh = useTutorial((s) => s.fresh)
  const [ready, setReady] = useState(false)
  const start = (tutorial: boolean) => {
    sfx.stamp()
    haptic.medium()
    onOpen(tutorial)
  }
  const withTutorial = (
    <button
      type="button"
      disabled={busy}
      className={`btn min-h-14 w-full text-[16px] ${fresh ? 'btn-primary' : 'btn-ghost'}`}
      onClick={() => start(true)}
      data-testid="start-tutorial"
    >
      튜토리얼과 함께 시작
    </button>
  )
  const plain = (
    <button
      type="button"
      disabled={busy}
      className={`btn min-h-14 w-full text-[16px] ${fresh ? 'btn-ghost' : 'btn-primary'}`}
      onClick={() => start(false)}
      data-testid="start-plain"
    >
      바로 시작
    </button>
  )
  const delay = (ms: number) => ({ animationDelay: `${ms}ms` })
  return (
    <div
      className="safe-bottom flex h-dvh flex-col items-center justify-between overflow-hidden app-bg px-6 pt-[max(env(safe-area-inset-top),24px)] pb-6 text-ink"
      data-testid="title-scene"
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <p
          className="title-in rounded-full border-2 border-(--outline) bg-white px-3 py-0.5 font-game text-[13px] tracking-[0.2em] text-ink"
          style={delay(0)}
        >
          증권사 육성 게임
        </p>
        <h1
          className="title-in mt-2 font-game text-[56px] leading-none text-[#ffd23f] [-webkit-text-stroke:4px_var(--outline)] [paint-order:stroke] [text-shadow:0_5px_0_var(--outline)]"
          style={delay(120)}
          data-testid="title"
        >
          증권사 사장
        </h1>
        <p className="title-in mt-3 text-center text-[14px] text-ink/75" style={delay(240)}>
          직원을 뽑고, 회의를 열고,
          <br />
          여의도 랜드마크 타워까지.
        </p>
        <div className="title-in panel mt-6 w-full max-w-[320px] p-2" style={delay(360)}>
          <BuildingArt grade="F" />
        </div>
        <p
          className="title-in mt-4 max-w-[320px] text-center text-[13px] leading-relaxed text-ink/70"
          style={delay(480)}
          data-testid="start-story"
        >
          사표를 던지고 나온 날, 통장에는 100b가 있었다. 반지하 사무실에 작은 간판을 걸었다.
        </p>
      </div>
      <div className="title-in w-full max-w-[360px]" style={delay(640)}>
        {ready ? (
          <div className="scene-in grid gap-2">
            {fresh ? withTutorial : plain}
            {fresh ? plain : withTutorial}
            <p className="text-center text-[11px] text-ink/50">
              튜토리얼은 다섯 걸음(뽑기 → 앉히기 → 회의 → 결산 → 키우기)을 알려 주고 언제든 건너뛸
              수 있습니다.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              sfx.tap()
              setReady(true)
            }}
            className="animate-pulse-soft min-h-14 w-full rounded-xl font-game text-[22px] tracking-wide text-ink"
            data-testid="touch-to-start"
          >
            터치해서 시작
          </button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-center text-[13px] text-red-pen">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
