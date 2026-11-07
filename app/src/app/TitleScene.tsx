import { BuildingArt } from '@web/features/raising/BuildingArt'
import { useTutorial } from '@web/features/raising/tutorial'
import { useState } from 'react'

/**
 * 제목 화면 (decisions.md 302·309번): 어두운 바탕에 반지하 사무실과 제목. "터치해서 시작"을 누르면 튜토리얼과 함께 시작·바로 시작이 나온다. 처음 온 사람에게는
 * 튜토리얼을 먼저 권한다.
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
  const primary =
    'min-h-13 w-full rounded-xl bg-wine text-[16px] font-bold text-white disabled:opacity-50'
  const secondary =
    'min-h-12 w-full rounded-xl border border-white/40 text-[14px] font-semibold text-white disabled:opacity-50'
  const withTutorial = (
    <button
      type="button"
      disabled={busy}
      className={fresh ? primary : secondary}
      onClick={() => onOpen(true)}
      data-testid="start-tutorial"
    >
      튜토리얼과 함께 시작
    </button>
  )
  const plain = (
    <button
      type="button"
      disabled={busy}
      className={fresh ? secondary : primary}
      onClick={() => onOpen(false)}
      data-testid="start-plain"
    >
      바로 시작
    </button>
  )
  return (
    <div
      className="safe-bottom flex h-dvh flex-col items-center justify-between bg-[--hud] px-6 pt-[max(env(safe-area-inset-top),24px)] pb-6 text-white"
      data-testid="title-scene"
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <p className="text-[12px] font-semibold tracking-[0.3em] text-white/60">증권사 육성 게임</p>
        <h1 className="mt-2 font-serif-kr text-[46px] font-black leading-none" data-testid="title">
          증권사 사장
        </h1>
        <p className="mt-3 text-center text-[14px] text-white/75">
          직원을 뽑고, 회의를 열고,
          <br />
          여의도 랜드마크 타워까지.
        </p>
        <div className="mt-6 w-full max-w-[320px] rounded-xl bg-white/90 p-2">
          <BuildingArt grade="F" />
        </div>
        <p
          className="mt-4 max-w-[320px] text-center text-[13px] leading-relaxed text-white/70"
          data-testid="start-story"
        >
          사표를 던지고 나온 날, 통장에는 1억 원이 있었다. 반지하 사무실에 작은 간판을 걸었다.
        </p>
      </div>
      <div className="w-full max-w-[360px]">
        {ready ? (
          <div className="scene-in grid gap-2">
            {fresh ? withTutorial : plain}
            {fresh ? plain : withTutorial}
            <p className="text-center text-[11px] text-white/50">
              튜토리얼은 다섯 걸음(뽑기 → 앉히기 → 회의 → 결산 → 키우기)을 알려 주고 언제든 건너뛸
              수 있습니다.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReady(true)}
            className="animate-pulse-soft min-h-14 w-full rounded-xl text-[18px] font-bold tracking-wide text-white"
            data-testid="touch-to-start"
          >
            터치해서 시작
          </button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-center text-[13px] text-[#ff8a7a]">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
