import type { Company } from '../../api/client'
import { shortWon, withParticle } from '../game/labels'
import { Overlay } from '../game/Overlay'

/**
 * 라이벌을 앞질렀다는 알림 (decisions.md 274번). 연말 결산에서 라이벌 증권사(261번)를 앞지르면 연말 결산서를 닫은 뒤 따로 뜬다: 누구를 앞질렀는지, 지금 업계
 * 몇 위인지, 다음에 앞지를 회사가 누구인지. 소식 줄과 연표에만 남던 순간을 놓치지 않게 한다.
 */
export function OvertakeAlert({ company, onClose }: { company: Company; onClose: () => void }) {
  const names = company.lastSettlement?.overtook ?? []
  const industry = company.industry
  if (names.length === 0) {
    return null
  }
  const who = names.join('·')
  return (
    <Overlay>
      <section
        className="animate-pop rounded border-2 border-wine bg-card p-5 text-center shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-label="라이벌을 앞질렀다"
        data-testid="overtake-alert"
      >
        <p className="text-[40px] leading-none" aria-hidden="true">
          🏁
        </p>
        <h2 className="mt-2 font-pen text-[26px] leading-tight" data-testid="overtake-names">
          {withParticle(who, '을', '를')} 앞질렀다!
        </h2>
        {industry && (
          <p className="mt-2 text-[16px]" data-testid="overtake-rank">
            업계 <b className="text-wine">{industry.rank}위</b> / {industry.total}곳
          </p>
        )}
        <p className="mt-1 text-[13px] text-muted">
          {industry?.aboveName && industry.aboveCapital != null
            ? `다음 목표: ${industry.aboveName} (자본 ${shortWon(industry.aboveCapital)})`
            : '이제 우리보다 큰 증권사는 없다. 업계 1위!'}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-12 w-full rounded bg-wine font-semibold text-white"
        >
          확인
        </button>
      </section>
    </Overlay>
  )
}
