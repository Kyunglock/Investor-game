import type { Game } from '../../api/client'
import { percent, STAT_KEYS, STAT_LABELS, statLabel, won } from './labels'
import { nickname } from './nickname'

export function ResultScreen({ game, onRestart }: { game: Game; onRestart: () => void }) {
  const result = game.result
  if (!result) {
    return null
  }
  const deviations = Object.entries(result.deviationCounts).sort(([, a], [, b]) => b - a)

  return (
    <section
      className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-md"
      data-testid="result-screen"
    >
      <h2 className="text-2xl font-bold">{result.finalAge}세, 투자 인생을 마쳤습니다</h2>
      <p className="mt-4 text-lg">
        {won(result.initialAsset)} → <b>{won(result.finalAsset)}</b>{' '}
        <b className={result.returnBp >= 0 ? 'text-red-600' : 'text-blue-600'}>
          ({result.returnBp >= 0 ? '+' : ''}
          {percent(result.returnBp)})
        </b>
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {nickname(game.initialStats).name} · {game.job?.title} ·{' '}
        {game.investmentStyle?.name ?? '스타일 미정'}
      </p>

      <h3 className="mt-6 text-sm font-semibold text-slate-500">최종 능력치</h3>
      <ul className="mt-2 grid grid-cols-5 gap-2 text-center">
        {STAT_KEYS.map((key) => (
          <li key={key} className="rounded-lg bg-slate-50 py-2">
            <p className="text-xs text-slate-500">{STAT_LABELS[key]}</p>
            <p className="font-semibold">{game.stats[key]}</p>
          </li>
        ))}
      </ul>

      {deviations.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-slate-500">내 선택이 뒤집힌 횟수</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {deviations.map(([code, count]) => (
              <li key={code} className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700">
                {statLabel(code)} 부족 {count}번
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        type="button"
        className="mt-8 min-h-12 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700"
        onClick={onRestart}
      >
        다시 태어나기
      </button>
    </section>
  )
}
