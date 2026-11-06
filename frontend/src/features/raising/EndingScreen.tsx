import type { Company } from '../../api/client'
import { shortWon } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { BuildingArt } from './BuildingArt'
import { useRaisingStore } from './store'

/**
 * 엔딩 (decisions.md 276번). 랜드마크 타워에 오르면 연말 결산서와 건물 알림 뒤에 뜬다. 몇 년 만에 올랐는지, 마지막 자본, 업적, 명예의 전당. 회사는 여기서
 * 멈추고, 사장의 사재로 다음 회사를 차린다(직원은 쉬는 채로 따라온다, 265번).
 */
export function EndingScreen({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { restart } = useRaisingStore.getState()
  const ending = company.ending
  if (!ending) {
    return null
  }
  const achieved = company.history.achievements.filter((a) => a.year != null)
  return (
    <Overlay>
      <section
        className="animate-pop rounded border-2 border-gold bg-card p-5 text-center shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="엔딩"
        data-testid="ending"
      >
        <BuildingArt grade={ending.grade} />
        <h2 className="mt-2 font-pen text-[30px] leading-tight">랜드마크 타워에 올랐다!</h2>
        <p className="mt-1 text-[15px]" data-testid="ending-years">
          반지하 원룸에서 <b>{ending.year}년</b> 만에
        </p>
        <p className="mt-1 font-mono-num text-[18px] font-bold" data-testid="ending-capital">
          자본 {shortWon(ending.capital)}
        </p>
        <p className="mt-2 text-[13px] text-muted">
          업적 {achieved.length} / {company.history.achievements.length}
        </p>
        {company.history.hall.length > 0 && (
          <div className="mt-3 text-left">
            <p className="text-[14px] font-semibold">명예의 전당</p>
            <ol className="mt-1 list-decimal pl-5 text-[13px]">
              {company.history.hall.slice(0, 3).map((h) => (
                <li key={`${h.name}-${h.from}`}>
                  {h.name} · {shortWon(h.totalPnl)}
                </li>
              ))}
            </ol>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-wine">
            {error}
          </p>
        )}
        <p className="mt-3 text-[13px] text-muted">
          {company.number}호 회사는 여기서 끝납니다. 키운 직원은 다음 회사로 따라옵니다.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void restart()}
          className="mt-2 min-h-12 w-full rounded bg-wine font-semibold text-white disabled:opacity-50"
        >
          사재 1억 원으로 {company.number + 1}호 회사 차리기
        </button>
      </section>
    </Overlay>
  )
}
