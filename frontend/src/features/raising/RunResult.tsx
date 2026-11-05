import type { Company, Grade, Run } from '../../api/client'
import { Document } from '../game/Document'
import { shortWon } from '../game/labels'
import { LADDER, ladderTone, STAT_NAMES, STAT_ORDER } from './grades'

/** 등급 사다리 (11.3절). 지금 위치와 다음 칸을 보인다. X와 Z가 SSS 위라는 것을 색으로 보인다. */
export function GradeLadder({ grade }: { grade: Grade }) {
  const at = LADDER.indexOf(grade)
  return (
    <ol className="mt-2 flex flex-wrap gap-1" aria-label="등급 사다리" data-testid="ladder">
      {LADDER.map((g, i) => (
        <li
          key={g}
          className={`min-w-[34px] rounded-sm px-1 text-center font-mono-num text-[11px] leading-5 ${ladderTone(g)} ${
            i === at ? 'ring-2 ring-wine' : i > at + 1 ? 'opacity-40' : ''
          }`}
          aria-current={i === at ? 'step' : undefined}
        >
          {g}
        </li>
      ))}
    </ol>
  )
}

/**
 * 입사 심사 결과 (증권사 육성 설계 3.1·2.3·6.3절). 회사가 없으면 이 사람이 1호 직원이 되며 회사가 열린다. 회사가 있으면 등록하거나, 자리가 꽉 찼으면
 * 기존 직원과 바꾸거나, 돌려보낸다. 돌려보내도 번 돈은 회사로 간다.
 */
export function RunResult({
  run,
  company,
  busy,
  error,
  onHire,
}: {
  run: Run
  company: Company | null
  busy: boolean
  error: string | null
  onHire: (register: boolean, replace?: number) => void
}) {
  const result = run.result
  if (!result) {
    return null
  }
  const rate = result.returnBp / 100
  return (
    <Document title="입사 심사 결과">
      <div data-testid="run-result">
        <p className="text-[13px] text-muted">종합 등급</p>
        <p
          className="font-serif-kr text-[48px] font-black leading-none"
          data-testid="overall-grade"
        >
          {result.overallGrade}
        </p>
        <GradeLadder grade={result.overallGrade} />
        <ul className="mt-4 grid grid-cols-5 gap-1 text-center text-[12px]">
          {STAT_ORDER.map((code) => (
            <li key={code} className="rounded border border-line py-1">
              {STAT_NAMES[code]}
              <b className="block font-mono-num text-[15px]">{run.grades[code]}</b>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[15px]">
          운용금 {shortWon(result.fund)} → <b>{shortWon(result.totalAsset)}</b>{' '}
          <span className={rate >= 0 ? 'text-up' : 'text-down'}>
            ({rate >= 0 ? '+' : ''}
            {rate.toFixed(1)}%)
          </span>
        </p>
        <p className="mt-1 text-[13px] text-muted">손이 뒤집힌 횟수 {result.flips}번</p>
        {result.highlights.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-[13px]">
            {result.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
        <HirePanel run={run} company={company} busy={busy} onHire={onHire} />
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-wine">
            {error}
          </p>
        )}
      </div>
    </Document>
  )
}

const BUTTON =
  'min-h-12 w-full rounded font-semibold disabled:opacity-50 border border-pen hover:bg-pen hover:text-white'

function HirePanel({
  run,
  company,
  busy,
  onHire,
}: {
  run: Run
  company: Company | null
  busy: boolean
  onHire: (register: boolean, replace?: number) => void
}) {
  if (!company || company.status === 'ENDED' || !run.recruit) {
    return (
      <div className="mt-5" data-testid="hire">
        <p className="text-[13px] text-muted">
          이 사람이 1호 직원이 되며 회사가 열립니다. 번 돈은 회사의 시작 자본이 됩니다.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onHire(true)}
          className="mt-3 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          1호 직원으로 등록하고 회사를 연다
        </button>
      </div>
    )
  }
  const full = company.employees.length >= company.seats
  return (
    <div className="mt-5 grid gap-2" data-testid="hire">
      <p className="text-[13px] text-muted">
        {full
          ? `자리 ${company.seats}개가 꽉 찼습니다. 기존 직원과 바꾸거나 돌려보냅니다.`
          : '자리가 남아 있습니다.'}{' '}
        돌려보내도 번 돈은 회사 자본으로 들어갑니다.
      </p>
      {full ? (
        company.employees.map((e) => (
          <button
            key={e.id}
            type="button"
            disabled={busy}
            onClick={() => onHire(true, e.id)}
            className={BUTTON}
          >
            {e.name}(종합 {e.overallGrade}) 대신 등록한다
          </button>
        ))
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onHire(true)}
          className="min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          등록한다
        </button>
      )}
      <button type="button" disabled={busy} onClick={() => onHire(false)} className={BUTTON}>
        돌려보낸다
      </button>
    </div>
  )
}
