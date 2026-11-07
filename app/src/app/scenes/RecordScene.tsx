import type { Company } from '@web/api/client'
import { pnlLabel } from '@web/features/raising/board'
import { officeName, titleOf } from '@web/features/raising/office'
import { Ledger, PHASES } from '@web/features/raising/YearEnd'
import { useState } from 'react'
import { sfx } from '../../fx/sound'

type Part = 'settlement' | 'achievements' | 'hall' | 'timeline'

/** 기록 장면 (decisions.md 263·309번): 지난 결산 · 업적 · 명예의 전당 · 연표를 칸으로 나눠 본다. */
export function RecordScene({ company }: { company: Company }) {
  const [part, setPart] = useState<Part>(company.lastSettlement ? 'settlement' : 'achievements')
  const h = company.history
  const parts: { id: Part; label: string }[] = [
    { id: 'settlement', label: '지난 결산' },
    { id: 'achievements', label: '업적' },
    { id: 'hall', label: '명예의 전당' },
    { id: 'timeline', label: '연표' },
  ]
  return (
    <div data-testid="record-scene">
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist">
        {parts.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={part === p.id}
            onClick={() => {
              sfx.tap()
              setPart(p.id)
            }}
            className={`min-h-9 shrink-0 rounded-full border-2 px-3 font-game text-[14px] shadow-[0_2px_0_var(--outline)] ${
              part === p.id
                ? 'border-(--outline) bg-(--gold-bright) text-ink'
                : 'border-(--outline) bg-white/80 text-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {part === 'settlement' &&
          (company.lastSettlement ? (
            <section data-testid="settlement">
              <h3 className="font-pen text-[22px] text-[#e08a00]">
                {company.lastSettlement.year}년 차 결산 · {PHASES[company.lastSettlement.phase]}
              </h3>
              <div className="panel mt-1 p-3">
                <Ledger company={company} settlement={company.lastSettlement} />
              </div>
              <ul className="mt-2 grid gap-0.5 text-[13px] text-ink/85">
                {company.lastSettlement.lines.map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 같은 소식이 두 번 올 수 있고 목록은 한 번 그리면 그대로다 (#338)
                  <li key={`${i}-${line}`}>· {line}</li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-[13px] text-ink/60">아직 결산한 해가 없습니다.</p>
          ))}
        {part === 'achievements' && (
          <ul className="grid grid-cols-2 gap-1.5">
            {h.achievements.map((a) => (
              <li
                key={a.code}
                className={`panel border-2 p-2 text-[12px] ${
                  a.year != null ? 'border-gold' : 'border-transparent opacity-60'
                }`}
                data-testid="achievement"
                data-open={a.year != null}
              >
                <b className="block text-[13px]">
                  {a.year != null ? (a.fail ? '🙃 ' : '🏆 ') : ''}
                  {a.name}
                  {a.fail && (
                    // 실패 업적 (decisions.md 351번): 망한 판도 즐겁게, 위로 보상 1장.
                    <span className="ml-1 rounded-full bg-[#f3eadb] px-1.5 text-[10px] font-normal text-ink/60">
                      실패 · 위로 1장
                    </span>
                  )}
                </b>
                {a.description}
                {a.year != null && <span className="block text-gold">{a.year}년 차</span>}
              </li>
            ))}
          </ul>
        )}
        {part === 'hall' &&
          (h.hall.length === 0 ? (
            <p className="text-[13px] text-ink/60">아직 아무도 없습니다.</p>
          ) : (
            <>
              <p className="mb-1 text-[11px] text-ink/60">
                데스크 운용과 종목 회의로 번 돈을 모두 더한 누적
              </p>
              <ol className="grid gap-1" data-testid="hall">
                {h.hall.map((x, i) => (
                  <li
                    key={`${x.name}-${x.from}`}
                    className="panel flex items-center justify-between gap-2 px-3 py-2 text-[13px]"
                  >
                    <span>
                      <b className="mr-1 font-mono-num">{i + 1}</b>
                      {x.name} {titleOf(x.grade)}{' '}
                      <span className="text-muted">
                        {x.from > 0 ? `${x.from}년 차` : ''}
                        {x.to != null ? ` ~ ${x.to}년 차 · 퇴사` : ' ~ 지금'}
                      </span>
                    </span>
                    <b className={x.totalPnl >= 0 ? 'text-up' : 'text-down'}>
                      {pnlLabel(x.totalPnl)}
                    </b>
                  </li>
                ))}
              </ol>
            </>
          ))}
        {part === 'timeline' && (
          <ol className="grid gap-1 text-[13px]" data-testid="timeline">
            {h.timeline
              // 같은 해에 같은 일이 여럿일 수 있고 연표는 쌓이기만 하므로 자리 번호가 곧 열쇠다.
              .map((e, at) => ({ ...e, at }))
              .reverse()
              .map((e) => (
                <li key={e.at} className="panel flex gap-2 px-3 py-2">
                  <span className="shrink-0 font-mono-num text-muted">{e.year}년 차</span>
                  <span>{eventText(e)}</span>
                </li>
              ))}
          </ol>
        )}
      </div>
    </div>
  )
}

/** 연표의 한 줄: 등급이 바뀐 해는 건물로 말한다 (238번). */
function eventText(e: Company['history']['timeline'][number]): string {
  if ((e.kind === 'grow' || e.kind === 'shrink') && e.grade) {
    return e.kind === 'grow'
      ? `회사가 커졌다 · ${officeName(e.grade)}`
      : `회사가 줄었다 · ${officeName(e.grade)}`
  }
  return e.text ?? ''
}
