import type { Company } from '@web/api/client'
import { shortWon } from '@web/features/game/labels'
import { useRaisingStore } from '@web/features/raising/store'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'

/** 이슈 장면 (6.1절, decisions.md 309번): 이직 제안·연봉 협상(답하는 카드), 폭락 조짐·경보·선견·뜨는 섹터·시대의 끝, 올해 필요한 인재. */
export function IssueScene({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { answerPoach, answerRaise } = useRaisingStore.getState()
  const m = company.meeting
  if (!m) {
    return <p className="text-[13px] text-white/60">끝난 회사에는 이슈가 없습니다.</p>
  }
  const quiet =
    !m.poach && !m.raise && !m.omen && !m.earlyOmen && !m.forecast && !m.hot && !m.eraEnding
  const answer = (fn: () => Promise<void>) => {
    sfx.stamp()
    haptic.medium()
    void fn()
  }
  return (
    <div className="grid gap-2" data-testid="issue-scene">
      {m.poach && (
        <section className="panel border-2 border-wine p-3" data-testid="poach">
          <p className="text-[11px] font-bold tracking-wide text-wine">이직 제안</p>
          <p className="mt-1 text-[15px] font-semibold">{m.poach.line}</p>
          <p className="mt-1 text-[12px] text-muted">
            답하지 않아도 회사에 남습니다. 보낼 때만 떠납니다.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(() => answerPoach(true))}
              className="btn btn-blue min-h-12 text-[14px]"
            >
              남긴다
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(() => answerPoach(false))}
              className="btn btn-line min-h-12 text-[13px]"
            >
              보낸다 · +{shortWon(m.poach.transferFee)}
            </button>
          </div>
        </section>
      )}
      {m.raise && (
        <section className="panel border-2 border-gold p-3" data-testid="raise">
          <p className="text-[11px] font-bold tracking-wide text-gold">연봉 협상</p>
          <p className="mt-1 text-[15px] font-semibold">{m.raise.line}</p>
          <p className="mt-1 text-[12px] text-muted">{m.raise.odds}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(() => answerRaise(true))}
              className="btn btn-blue min-h-12 text-[13px]"
            >
              올려 준다 · 연 {shortWon(m.raise.after)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => answer(() => answerRaise(false))}
              className="btn btn-line min-h-12 text-[13px]"
            >
              동결한다
            </button>
          </div>
        </section>
      )}
      {m.omen && (
        <Note
          tone="border-red-pen text-red-pen"
          tag="폭락 조짐"
          tagTone="bg-red-pen"
          testId="company-omen"
        >
          {m.omen}
        </Note>
      )}
      {m.earlyOmen && (
        <Note
          tone="border-red-pen/60 text-red-pen"
          tag="경보"
          tagTone="bg-red-pen"
          testId="early-omen"
        >
          {m.earlyOmen}
        </Note>
      )}
      {m.forecast && (
        <Note tone="border-gold text-gold" tag="선견" tagTone="bg-gold" testId="forecast">
          {m.forecast}
        </Note>
      )}
      {m.hot && (
        <Note tone="border-gold text-gold" tag="★ 뜨는 섹터" tagTone="bg-gold" testId="hot-sector">
          {m.hot}
        </Note>
      )}
      {m.eraEnding && (
        <Note tone="border-teal text-teal" tag="시대의 끝" tagTone="bg-teal" testId="era-ending">
          {m.eraEnding}
        </Note>
      )}
      <Note tone="border-transparent text-ink" tag="올해 필요한 인재" tagTone="bg-ink">
        {m.wanted}
      </Note>
      {quiet && <p className="text-center text-[12px] text-white/50">조용한 해입니다.</p>}
    </div>
  )
}

function Note({
  tone,
  tag,
  tagTone,
  children,
  testId,
}: {
  tone: string
  tag: string
  tagTone: string
  children: string
  testId?: string
}) {
  return (
    <p className={`panel border-2 p-3 text-[14px] font-semibold ${tone}`} data-testid={testId}>
      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] text-white ${tagTone}`}>
        {tag}
      </span>
      {children}
    </p>
  )
}
