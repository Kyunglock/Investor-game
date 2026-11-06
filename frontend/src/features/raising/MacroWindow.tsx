import type { Company } from '../../api/client'
import { withParticle } from '../game/labels'
import { Overlay } from '../game/Overlay'
import { groupRemarks, spokesperson } from './investShow'
import { type Stance, useRaisingStore } from './store'

type Macro = NonNullable<Company['macro']>

/** 거시경제 회의의 의견 칸: 공격 쪽·방어 쪽·모르겠다 (decisions.md 266번). */
const MACRO_OPINIONS: Record<string, { label: string; tone: string }> = {
  UP: { label: '공격하자', tone: 'border-up text-up' },
  DOWN: { label: '지키자', tone: 'border-down text-down' },
  NEUTRAL: { label: '모르겠다', tone: 'border-line text-muted' },
}

/**
 * 거시경제 회의 (decisions.md 266·267번, #329). 결산을 누르면 먼저 뜬다: 기준금리·환율 같은 큰 흐름 하나를 놓고 직원들과 고민하고, 사장이 올해 회사의
 * 태도(공격·중립·방어)를 고른다. 태도는 그해 결산의 판돈 전체에 걸린다. 고르면 회의가 끝나고 직원이 종목을 물어 올 수 있다: 물어 오면 종목 회의로, 아무도
 * 안 오면 그대로 결산으로 간다.
 */
export function MacroWindow({
  macro,
  year,
  quarter,
  employees,
  stockMeeting,
  onClose,
  onNext,
}: {
  macro: Macro
  year: number
  quarter: number
  employees: Company['employees']
  /** 물어 온 종목이 있어 종목 회의가 열린다. */
  stockMeeting: boolean
  onClose: () => void
  /** 다음으로: 종목 회의를 열거나 결산한다. */
  onNext: () => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { decideMacro } = useRaisingStore.getState()
  const outcome = macro.outcome
  const chosen = outcome ? macro.stances.find((s) => s.code === outcome.stance) : undefined
  return (
    <Overlay>
      <section
        className="animate-pop rounded bg-card p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="거시경제 회의"
        data-testid="macro"
      >
        <header className="flex items-baseline justify-between">
          <h3 className="font-pen text-[24px]">
            {year}년 차 {quarter}분기 거시경제 회의
          </h3>
          {!outcome && (
            <button type="button" onClick={onClose} className="text-[12px] text-muted underline">
              배치 다시 보기
            </button>
          )}
        </header>
        <article className="mt-2 rounded border border-line bg-card p-3">
          <p className="text-[12px] text-muted">이번 분기의 큰 흐름 · {macro.topic}</p>
          <h4 className="mt-0.5 font-semibold text-[16px]">{macro.title}</h4>
          <p className="mt-2 text-[14px] leading-relaxed" data-testid="macro-article">
            {macro.sentences.map((s, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: 문장 순서는 회의 내내 그대로다
                key={i}
                className={`${s.highlighted ? 'highlighter' : ''} ${s.omen ? 'font-bold text-red-pen' : ''}`}
                data-highlighted={s.highlighted}
                data-omen={s.omen}
              >
                {s.text}{' '}
              </span>
            ))}
          </p>
          {macro.highlightBy && (
            <p className="mt-1 text-[12px] text-muted">형광펜: 리서치 팀 {macro.highlightBy}</p>
          )}
        </article>

        {macro.remarks.length > 0 && !outcome && (
          <div className="mt-2 grid gap-2" data-testid="macro-remarks">
            {groupRemarks(macro.remarks).map((g) => {
              const voice = spokesperson(g.remarks, employees)
              const others = g.remarks.length - 1
              return (
                <section
                  key={g.read}
                  className={`rounded border-l-4 bg-line-soft/40 py-1.5 pr-2 pl-2.5 ${MACRO_OPINIONS[g.read].tone}`}
                  aria-label={`${MACRO_OPINIONS[g.read].label} ${g.remarks.length}명`}
                  data-testid="macro-opinion"
                  data-read={g.read}
                >
                  <h4 className="font-bold text-[14px]">
                    {MACRO_OPINIONS[g.read].label}{' '}
                    <span className="font-mono-num text-[13px]">· {g.remarks.length}명</span>{' '}
                    <span className="font-normal text-[13px] text-ink">
                      {g.remarks.map((r) => r.name).join(' · ')}
                    </span>
                  </h4>
                  <p className="mt-1 text-[14px] text-ink">
                    “{voice.text}”{' '}
                    <span className="whitespace-nowrap text-[12px] text-muted">
                      — {voice.name}
                      {others > 0 && ` 외 ${others}명`}
                    </span>
                  </p>
                </section>
              )
            })}
          </div>
        )}

        {!outcome && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {macro.stances.map((s) => (
              <button
                key={s.code}
                type="button"
                disabled={busy || !macro.ready}
                onClick={() => void decideMacro(s.code as Stance)}
                className="min-h-12 rounded border border-pen px-1 font-semibold transition-transform hover:bg-pen hover:text-white active:scale-95 disabled:opacity-50"
              >
                {s.label}
                <span className="block text-[11px] font-normal">판돈 ×{s.stakePercent / 100}</span>
              </button>
            ))}
            <ul className="col-span-3 grid gap-0.5 text-[12px] text-muted">
              {macro.stances.map((s) => (
                <li key={s.code}>
                  <b className="text-ink">{s.label}</b> — {s.note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {outcome && (
          <div className="mt-3" data-testid="macro-outcome">
            <p className="flex items-center gap-2 text-[14px]">
              이번 분기 회사의 태도
              <span
                className="animate-stamp pen-circle inline-block px-3 py-0.5 font-pen text-[22px] text-red-pen"
                data-testid="macro-stance"
              >
                {chosen?.label ?? outcome.stance}
              </span>
            </p>
            <p className="mt-1 text-[12px] text-muted">
              이번 분기 판돈 ×{(chosen?.stakePercent ?? 100) / 100}. 시장이 어땠는지는 분기 실적에서
              드러납니다.
            </p>
            {outcome.finder ? (
              // 종목 발굴 (267번): 회의가 끝나자 누가 종목을 들고 찾아왔다.
              <div
                className="animate-reveal mt-3 rounded border border-gold px-3 py-2"
                data-testid="macro-finder"
              >
                <p className="text-[13px] text-muted">
                  회의가 끝나자{' '}
                  <b className="text-ink">
                    {withParticle(
                      outcome.finder.role
                        ? `${outcome.finder.name} ${outcome.finder.role}`
                        : outcome.finder.name,
                      '이',
                      '가',
                    )}
                  </b>{' '}
                  종목을 들고 찾아왔다.
                </p>
                <p className="mt-1 text-[15px]">“{outcome.finder.pitch}”</p>
              </div>
            ) : (
              <p
                className="animate-reveal mt-3 rounded bg-line-soft px-3 py-2 text-[13px]"
                data-testid="macro-none"
              >
                {outcome.none}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onNext}
              className="animate-reveal mt-3 min-h-12 w-full rounded bg-wine font-semibold text-white disabled:opacity-50"
            >
              {stockMeeting ? '종목 회의 열기 →' : `${year}년 차 ${quarter}분기 넘기기 →`}
            </button>
          </div>
        )}
      </section>
    </Overlay>
  )
}
