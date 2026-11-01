import { useMemo } from 'react'
import type { Game } from '../../api/client'
import { Document } from './Document'
import { yearOf } from './labels'
import { type Axis, type Pole, profileReport } from './profile'

const LEVEL_CLASS: Record<Axis['level'], string> = {
  낮음: 'text-down',
  보통: 'text-muted',
  높음: 'text-up',
}

/**
 * 투자 성향 진단 보고서 (decisions.md 61·132번). MBTI 결과처럼 가볍게: 유형 코드·별명이 맨 위, 네 축은 양쪽 극 막대, 어울리는 투자와 조심할 것 몇 줄.
 * 숫자 근거와 긴 코멘트는 "자세히 보기"에 접어 둔다. 진행 중엔 수첩에서 열어 보고, 끝난 판은 인생 기록부에 붙는다.
 */
export function ProfileReport({ game, onClose }: { game: Game; onClose?: () => void }) {
  const report = useMemo(() => profileReport(game), [game])
  const s = report.stats
  const cautions = report.recommendations.slice(0, 3)
  return (
    <Document
      title="투자 성향 진단"
      number={`${yearOf(report.ageYears)} · ${report.ageYears}세`}
      testId="profile-report"
    >
      <section className="text-center" data-testid="profile-type">
        <p className="font-mono-num text-[44px] font-black leading-none tracking-[0.18em] text-wine">
          {report.type.code}
        </p>
        <p className="mt-2 font-serif-kr text-2xl font-black" data-testid="profile-type-name">
          {report.type.name}
        </p>
        <p className="mt-1 text-[13px] text-muted">{report.type.tagline}</p>
        <p
          className="mt-2.5 inline-block rounded-full bg-wine-soft px-3 py-1 text-xs font-bold text-wine"
          data-testid="profile-grade"
        >
          {report.grade.name} · {report.grade.description}
        </p>
        <p className="mt-1.5 text-[11px] text-faint">
          {report.name}
          {report.investorType && ` · 성장기에 자란 성향 "${report.investorType}"`}
          {s.yearsInvesting > 0 ? ` · 투자 ${s.yearsInvesting}년` : ' · 투자 시작 전'}
        </p>
      </section>

      <ul className="mt-5 flex flex-col gap-3" data-testid="profile-poles">
        {report.poles.map((pole) => (
          <PoleBar key={pole.key} pole={pole} />
        ))}
      </ul>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-line bg-bg px-3.5 py-3">
          <h2 className="text-[11px] font-bold tracking-wider text-teal uppercase">
            어울리는 투자
          </h2>
          <ul className="mt-1.5 list-disc pl-4 text-[12px] leading-relaxed">
            {report.type.fits.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-line bg-bg px-3.5 py-3">
          <h2 className="text-[11px] font-bold tracking-wider text-wine uppercase">조심할 것</h2>
          <ul className="mt-1.5 list-disc pl-4 text-[12px] leading-relaxed">
            {cautions.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </section>

      <details className="mt-5" data-testid="profile-details">
        <summary className="cursor-pointer text-[12px] text-muted">
          자세히 보기 · 근거와 숫자
        </summary>
        <p className="mt-2 text-[13px] leading-relaxed">{report.summary}</p>

        <dl className="mt-3 grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 text-[12px]">
          <dt className="text-muted">타고난 것</dt>
          <dd className="font-mono-num text-[11px]">{report.startStats}</dd>
          <dt className="text-muted">지금</dt>
          <dd className="font-mono-num text-[11px]">{report.nowStats}</dd>
        </dl>

        <ul className="mt-3 flex flex-col gap-2.5">
          {report.axes.map((axis) => (
            <li key={axis.key} data-testid={`axis-detail-${axis.key}`}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="font-bold">{axis.name}</span>
                <span className="font-mono-num">
                  {axis.score}
                  <span className={`ml-1 text-[11px] ${LEVEL_CLASS[axis.level]}`}>
                    {axis.level}
                  </span>
                </span>
              </div>
              <ul className="mt-0.5 list-disc pl-4 text-[11px] text-muted">
                {axis.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="mt-0.5 text-[12px] leading-relaxed">{axis.comment}</p>
            </li>
          ))}
        </ul>

        <table className="mt-3 w-full text-left text-[12px]">
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

        <p className="mt-3 text-[10px] text-faint">
          이 진단은 게임 안에서 고른 행동만으로 만든 것이며, 실제 투자 조언이 아니다. 능력치 판정에
          뒤집힌 결과와 주가·손익처럼 확률이 끼는 것은 넣지 않았다. 판이 진행되면 바뀐다.
        </p>
      </details>

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

/** 한 축을 양쪽 극으로. 기운 쪽의 글자와 비율이 크고, 막대는 그쪽으로 찬다. 소신 축은 성장기에 정해져 한쪽으로 꽉 차고, 모르면 비어 있다. */
function PoleBar({ pole }: { pole: Pole }) {
  const leftSide = pole.letter === pole.left.letter
  const known = pole.percent != null
  const percent = pole.percent ?? 0
  return (
    <li data-testid={`axis-${pole.key}`}>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className={leftSide && known ? 'font-bold' : 'text-faint'}>
          {pole.left.letter} {pole.left.label}
        </span>
        <span className="font-mono-num text-[13px] font-bold text-wine">
          {known ? `${pole.letter} ${percent}%` : '?'}
        </span>
        <span className={!leftSide && known ? 'font-bold' : 'text-faint'}>
          {pole.right.label} {pole.right.letter}
        </span>
      </div>
      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-line-soft">
        {known && (
          <div
            className="absolute top-0 h-full rounded-full bg-teal"
            style={
              leftSide ? { left: 0, width: `${percent}%` } : { right: 0, width: `${percent}%` }
            }
          />
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-faint">{pole.evidence}</p>
    </li>
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
