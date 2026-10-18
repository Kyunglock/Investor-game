import type { Game } from '../../api/client'
import { Card } from './Card'
import { signedWon, won } from './labels'

/** 가계부: 이번 달 수입·지출·저축과 가족 (경제 개편 설계 11.3절). 금액은 서버 값이다. */
export function HouseholdCard({ game }: { game: Game }) {
  const h = game.household
  const working = game.job !== null && game.job !== undefined
  // 자녀 비용은 생활비에 합쳐져 온다. 은퇴 뒤에는 월급 대신 연금 (decisions.md 27번).
  const saving = h.monthlyIncome + h.spouseIncome + h.pension - h.monthlyExpense
  const monthLabel = `${Math.floor(game.market.month % 12) + 1}월`
  const childrenText =
    h.children.length === 0
      ? null
      : `자녀 ${h.children.length} (${h.children.map((c) => `${c.age}세`).join(', ')})`

  return (
    <Card title="가계부" aside={monthLabel} testId="household-card">
      {!working ? (
        <p className="text-xs text-faint">
          {game.phase === 'CHILDHOOD' ? '아직 부모님 집이다.' : '직업이 생기면 가계부가 시작된다.'}
        </p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <tbody>
            {h.retired ? (
              <Row label="연금" value={h.pension} />
            ) : (
              <Row label="월급" value={h.monthlyIncome} />
            )}
            {h.married && <Row label="배우자 소득" value={h.spouseIncome} />}
            <Row
              label={
                <>
                  생활비{' '}
                  <span className="text-[10px] text-faint">
                    {h.married ? '부부' : '1인'}
                    {childrenText ? ` · ${childrenText}` : ''}
                  </span>
                </>
              }
              value={-h.monthlyExpense}
            />
            {game.debt > 0 && (
              <tr>
                <td className="border-b border-line-soft py-1">
                  빚 <span className="text-[10px] text-faint">월 1% 이자</span>
                </td>
                <td className="border-b border-line-soft py-1 text-right font-mono-num text-up">
                  {won(game.debt)}
                </td>
              </tr>
            )}
            <tr className="font-bold">
              <td className="border-t-2 border-line pt-1.5">이번 달 저축</td>
              <td
                className={`border-t-2 border-line pt-1.5 text-right font-mono-num ${saving < 0 ? 'text-up' : ''}`}
                data-testid="monthly-saving"
              >
                {signedWon(saving)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <p className="mt-2 text-xs text-muted" data-testid="family">
        가족 ·{' '}
        {h.married ? (
          <>
            <b className="text-ink">배우자</b>
            {childrenText && (
              <>
                , <b className="text-ink">{childrenText}</b>
              </>
            )}
            {h.marriedAge != null && <span className="text-faint"> ({h.marriedAge}세 결혼)</span>}
          </>
        ) : (
          '혼자'
        )}
        {h.retired && <span className="text-faint"> · 은퇴</span>}
      </p>
    </Card>
  )
}

function Row({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <tr>
      <td className="border-b border-line-soft py-1">{label}</td>
      <td
        className={`border-b border-line-soft py-1 text-right font-mono-num ${value > 0 ? 'text-up' : value < 0 ? 'text-down' : ''}`}
      >
        {signedWon(value)}
      </td>
    </tr>
  )
}
