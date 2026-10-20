import type { Analysis } from '../../api/client'
import { insightGauge, readingLabel } from './analysis'

/**
 * 안목 해석 한 단락 (매매창 설계 4절). 안목 점수와 눈금만 보이고 확률은 없다. 지난 해석이 드러나면 맞혔을 때·틀렸을 때 한마디가 위에 붙는다.
 * 말투는 안목 구간이 정하고 맞았는지는 드러나지 않는다.
 */
export function AnalysisNote({
  title,
  analysis,
  testId,
}: {
  title: string
  analysis: Analysis | undefined
  testId: string
}) {
  return (
    <section className="rounded border border-line bg-bg px-3 py-2.5" data-testid={testId}>
      <h4 className="flex items-baseline justify-between text-xs font-bold">
        <span>{title}</span>
        {analysis && (
          <span className="font-mono-num text-[11px] font-normal text-muted">
            안목 {analysis.insight}{' '}
            <span className="tracking-tight text-wine">{insightGauge(analysis.insight)}</span>
          </span>
        )}
      </h4>
      {analysis ? (
        <>
          {analysis.remark && (
            <p
              className={`mt-1.5 text-[12px] italic ${analysis.remark.correct ? 'text-teal' : 'text-wine'}`}
              data-testid={`${testId}-remark`}
            >
              {analysis.remark.text}
            </p>
          )}
          <p className="mt-1.5 text-[13px] leading-relaxed" data-testid={`${testId}-text`}>
            <span className="mr-1.5 inline-block rounded-full border border-line bg-card px-1.5 text-[10px] text-muted">
              {readingLabel(analysis.reading)}
            </span>
            {analysis.text}
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-faint">읽는 중…</p>
      )}
    </section>
  )
}
