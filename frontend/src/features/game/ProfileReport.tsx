import { useMemo } from 'react'
import type { Game } from '../../api/client'
import { Document } from './Document'
import { yearOf } from './labels'
import { type Axis, profileReport } from './profile'

const LEVEL_CLASS: Record<Axis['level'], string> = {
  낮음: 'text-down',
  보통: 'text-muted',
  높음: 'text-up',
}

/** 투자 성향 진단 보고서 (decisions.md 61번). 진행 중엔 수첩에서 열어 보고, 끝난 판은 인생 기록부에 붙는다. */
export function ProfileReport({ game, onClose }: { game: Game; onClose?: () => void }) {
  const report = useMemo(() => profileReport(game), [game])
  const s = report.stats
  return (
    <Document
      title="투자 성향 진단 보고서"
      number={`${yearOf(report.ageYears)} · ${report.ageYears}세`}
      testId="profile-report"
    >
      <section>
        <h2 className="text-[11px] font-bold tracking-wider text-faint uppercase">1. 기본 정보</h2>
        <dl className="mt-1.5 grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-muted">투자자</dt>
          <dd>
            {report.name} · {report.ageYears}세{report.investorType && ` · ${report.investorType}`}
          </dd>
          <dt className="text-muted">투자 기간</dt>
          <dd>{s.yearsInvesting > 0 ? `${s.yearsInvesting}년` : '투자 시작 전'}</dd>
          <dt className="text-muted">타고난 것</dt>
          <dd className="font-mono-num text-[12px]">{report.startStats}</dd>
          <dt className="text-muted">지금</dt>
          <dd className="font-mono-num text-[12px]">{report.nowStats}</dd>
        </dl>
      </section>

      <section
        className="mt-5 rounded border border-line bg-bg px-4 py-3"
        data-testid="profile-grade"
      >
        <h2 className="text-[11px] font-bold tracking-wider text-faint uppercase">2. 종합 판정</h2>
        <p className="mt-1 font-serif-kr text-2xl font-black text-wine">{report.grade.name}</p>
        <p className="text-[12px] text-muted">{report.grade.description}</p>
        <p className="mt-2 text-[13px] leading-relaxed">{report.summary}</p>
      </section>

      <section className="mt-5">
        <h2 className="text-[11px] font-bold tracking-wider text-faint uppercase">3. 세 축</h2>
        <ul className="mt-2 flex flex-col gap-3">
          {report.axes.map((axis) => (
            <li key={axis.key} data-testid={`axis-${axis.key}`}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-bold">{axis.name}</span>
                <span className="font-mono-num">
                  {axis.score}
                  <span className={`ml-1 text-[11px] ${LEVEL_CLASS[axis.level]}`}>
                    {axis.level}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
                <div className="h-full bg-teal" style={{ width: `${axis.score}%` }} />
              </div>
              <ul className="mt-1 list-disc pl-4 text-[11px] text-muted">
                {axis.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="mt-1 text-[12px] leading-relaxed">{axis.comment}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5">
        <h2 className="text-[11px] font-bold tracking-wider text-faint uppercase">4. 고른 행동</h2>
        <table className="mt-1.5 w-full text-left text-[12px]">
          <tbody>
            <Row
              label="뉴스 앞에서"
              value={`${s.newsCount}번 · 사기 ${s.newsBuy} / 팔기 ${s.newsSell} / 관망 ${s.newsHold}`}
            />
            <Row
              label="보유 종목 흔들림"
              value={`${s.shakeCount}번 · 버티기 ${s.shakeHeld} / 팔기 ${s.shakeCount - s.shakeHeld}`}
            />
            <Row
              label="자유 매매"
              value={`${s.tradeCount}건 · 사기 ${s.tradeBuy} / 팔기 ${s.tradeSell}`}
            />
            <Row
              label="빚투"
              value={
                s.leverageOffered === 0
                  ? '제안 없음'
                  : `제안 ${s.leverageOffered}번 · 빌리기 ${s.leverageChosen}번`
              }
            />
            <Row
              label="사기로 고른 종목"
              value={`${s.stocksChosen}종목 · ${s.sectorsChosen}섹터`}
            />
          </tbody>
        </table>
      </section>

      <section className="mt-5">
        <h2 className="text-[11px] font-bold tracking-wider text-faint uppercase">5. 처방</h2>
        <ol className="mt-1.5 list-decimal pl-5 text-[13px] leading-relaxed">
          {report.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>

      <p className="mt-5 text-[10px] text-faint">
        이 보고서는 게임 안에서 고른 행동만으로 만든 진단이며, 실제 투자 조언이 아니다. 능력치
        판정에 뒤집힌 결과와 주가·손익처럼 확률이 끼는 것은 넣지 않았다. 점수는 지금까지 고른 것을
        기준으로 하며 판이 진행되면 바뀐다.
      </p>
      {onClose && (
        <button
          type="button"
          className="mt-4 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
          onClick={onClose}
          data-testid="profile-close"
        >
          닫기
        </button>
      )}
    </Document>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-line-soft">
      <td className="py-1 text-muted">{label}</td>
      <td className="py-1 font-mono-num">{value}</td>
    </tr>
  )
}
