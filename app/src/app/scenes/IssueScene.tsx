import type { Company } from '@web/api/client'
import { MeetingCard } from './MeetingCard'

/**
 * 이슈 장면 (6.1절, decisions.md 309번, #803): 맨 위에 종목회의, 그 아래 이번 시대에 뜨는 섹터. 폭락 조짐·경보·선견·시대의 끝은 분기와 함께 없어졌다.
 * 이직 제안 카드는 385번에서 뺐다.
 */
export function IssueScene({ company }: { company: Company }) {
  const hot = company.meeting?.hot
  return (
    <div className="grid gap-2" data-testid="issue-scene">
      <section className="panel grid gap-1.5 p-3" data-testid="issue-meeting">
        <p className="text-[15px] font-bold text-ink">종목회의</p>
        <p className="text-[12px] text-ink/60">
          기사를 읽고 매수·매도를 골라요. 맞히면 벌고, 틀려도 손실은 없어요. 기회는 한 시간에 하나씩
          생겨요.
        </p>
        <MeetingCard company={company} />
      </section>
      {hot && (
        <p
          className="panel border-2 border-gold p-3 text-[14px] font-semibold text-gold"
          data-testid="hot-sector"
        >
          <span className="mr-1.5 rounded bg-gold px-1.5 py-0.5 text-[11px] text-white">
            ★ 뜨는 섹터
          </span>
          {hot}
        </p>
      )}
    </div>
  )
}
