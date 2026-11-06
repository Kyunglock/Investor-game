import type { Company } from '../../api/client'
import { shortWon, withParticle } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { usePixelArt } from '../game/pixelArt'
import { RivalSmash } from './RivalSmash'

/**
 * 연말의 라이벌 알림 (decisions.md 274·275번). 연말 결산서를 닫은 뒤 따로 뜬다.
 * - 올해의 라이벌(275번)을 이겼거나 업계 라이벌(261번)을 앞지르면 **우리 건물이 상대 건물을 들이받아 무너뜨리는 장면**(243번)을 보인다.
 * - 올해의 라이벌에게 졌으면 얼마 모자랐는지 보인다.
 * - 지금 업계 몇 위인지, 다음에 앞지를 회사가 누구인지.
 */
export function OvertakeAlert({ company, onClose }: { company: Company; onClose: () => void }) {
  const shown = usePixelArt((s) => s.shown)
  const s = company.lastSettlement
  const names = s?.overtook ?? []
  const target = s?.target ?? null
  const industry = company.industry
  if (!s || (names.length === 0 && !target)) {
    return null
  }
  const won = target?.won ?? false
  // 무너뜨릴 건물: 이긴 올해의 라이벌이 먼저, 아니면 앞지른 업계 라이벌(오른 뒤 우리 건물을 잿빛으로).
  const smash = won && target ? target.name : (names[0] ?? null)
  const title = target
    ? won
      ? `올해의 라이벌 ${withParticle(target.name, '을', '를')} 이겼다!`
      : `올해의 라이벌 ${target.name}에게 졌다`
    : `${withParticle(names.join('·'), '을', '를')} 앞질렀다!`
  return (
    <Overlay>
      <section
        className={`animate-pop rounded border-2 bg-card p-5 text-center shadow-xl ${
          smash ? 'border-wine' : 'border-line'
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-label="라이벌 결과"
        data-testid="overtake-alert"
        data-won={smash ? 'true' : 'false'}
      >
        {smash && shown && (
          <RivalSmash
            before={s.gradeBefore}
            after={s.gradeAfter}
            rival={smash}
            rivalGrade={won && target ? target.theirGrade : undefined}
          />
        )}
        {!(smash && shown) && (
          <p className="text-[40px] leading-none" aria-hidden="true">
            {smash ? '🏁' : '😤'}
          </p>
        )}
        <h2 className="mt-2 font-pen text-[26px] leading-tight" data-testid="overtake-names">
          {title}
        </h2>
        {target && (
          <p className="mt-1 text-[14px]" data-testid="target-result">
            {target.difficultyName} · {target.real ? '실제 사장의 회사' : '지어낸 회사'} · 상대 자본{' '}
            {shortWon(target.theirCapital)}
            <br />
            {won
              ? `라이벌의 고객이 넘어와 자본이 ${shortWon(target.bonus)} 늘었다.`
              : `${shortWon(target.theirCapital - target.ourCapital)} 모자랐다. 내년에 다시.`}
          </p>
        )}
        {target && names.length > 0 && (
          <p className="mt-1 text-[14px]" data-testid="overtake-also">
            업계에서도 {withParticle(names.join('·'), '을', '를')} 앞질렀다!
          </p>
        )}
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
