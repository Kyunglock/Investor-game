import type { Grade, Run } from '../../api/client'
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

/** 입사 심사 결과 (증권사 육성 설계 3.1·2.3절). 회사는 다음 단계에서 열린다. */
export function RunResult({ run, onRestart }: { run: Run; onRestart: () => void }) {
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
        <p className="mt-4 text-[13px] text-muted">
          번 돈은 회사 자본이 됩니다. 회사는 곧 열립니다.
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-5 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
        >
          다음 사람 키우기
        </button>
      </div>
    </Document>
  )
}
