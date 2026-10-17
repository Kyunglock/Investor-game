import type { Game } from '../../api/client'
import { ageAt } from './clock'
import { PHASE_LABELS, STAT_KEYS, STAT_LABELS, won } from './labels'
import { nickname } from './nickname'

export function StatusPanel({ game, day }: { game: Game; day: number }) {
  const age = ageAt(game.startAge, day, game.daysPerYear)

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-3xl font-bold" data-testid="age">
            {age.years}세 {age.months}개월
          </p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {PHASE_LABELS[game.phase]}
          </span>
        </div>
        <p className="mt-1 font-semibold text-blue-600" data-testid="nickname">
          {nickname(game.initialStats).name}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">총자산</dt>
          <dd className="text-right font-semibold" data-testid="total-asset">
            {won(game.totalAsset)}
          </dd>
          <dt className="text-slate-500">현금</dt>
          <dd className="text-right" data-testid="cash">
            {won(game.cash)}
          </dd>
          <dt className="text-slate-500">직업</dt>
          <dd className="text-right" data-testid="job">
            {game.job
              ? `${game.job.title} · 월 ${won(game.job.monthlySalary)}`
              : game.phase === 'CHILDHOOD'
                ? '학생'
                : '구직 중'}
          </dd>
          <dt className="text-slate-500">투자 스타일</dt>
          <dd className="text-right" data-testid="style">
            {game.investmentStyle?.name ?? '아직 모름'}
          </dd>
          <dt className="text-slate-500">관심 섹터</dt>
          <dd className="text-right">{game.interestSector?.name ?? '아직 모름'}</dd>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">능력치</h2>
        <ul className="flex flex-col gap-2">
          {STAT_KEYS.map((key) => (
            <li key={key} className="flex items-center gap-3" data-testid={`stat-${key}`}>
              <span className="w-12 text-sm text-slate-600">{STAT_LABELS[key]}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-blue-500"
                  style={{ width: `${game.stats[key]}%` }}
                />
              </span>
              <span className="w-8 text-right text-sm font-semibold">{game.stats[key]}</span>
            </li>
          ))}
        </ul>
      </section>

      {game.holdings.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">보유 종목</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {game.holdings.map((h) => (
              <li key={h.sectorCode} className="flex justify-between">
                <span>{h.sectorName}</span>
                <span>{won(h.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
