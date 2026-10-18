import type { Game } from '../../api/client'
import { PHASE_LABELS, won, yearOf } from './labels'
import { nickname } from './nickname'
import { layersFor } from './pixel/layers'
import { Sprite } from './pixel/SpriteView'

/** 여권 느낌의 신원 기록. 이름 자리에 별명이 들어간다 (설계 5.2절). */
export function IdentityCard({ game, ageYears }: { game: Game; ageYears: number }) {
  const nick = nickname(game.initialStats)
  const spec = layersFor(game.initialStats, game.stats, ageYears)

  return (
    <section
      className="overflow-hidden rounded-md border border-line bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
      data-testid="identity-card"
    >
      <div className="flex justify-between bg-wine px-3 py-1.5 font-mono-num text-[11px] tracking-wider text-white">
        <span>신원 기록 · KOR</span>
        <span>{yearOf(game.startAge)}</span>
      </div>
      <div className="relative grid grid-cols-[64px_1fr] gap-3 p-3">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(135deg, transparent 0 9px, rgba(139,35,66,.05) 9px 10px)',
          }}
        />
        <Sprite spec={spec} size={64} crop="face" className="border border-line bg-bg" />
        <div className="relative min-w-0">
          <p
            className="mb-1.5 font-serif-kr text-[19px] font-black leading-tight"
            data-testid="nickname"
          >
            {nick.name}
          </p>
          <dl className="grid grid-cols-[54px_1fr] gap-x-1.5 gap-y-0.5 text-xs">
            <dt className="text-faint">단계</dt>
            <dd>{PHASE_LABELS[game.phase]}</dd>
            <dt className="text-faint">직업</dt>
            <dd data-testid="job">
              {game.job ? game.job.title : game.phase === 'CHILDHOOD' ? '학생' : '구직 중'}
            </dd>
            <dt className="text-faint">월급</dt>
            <dd className="font-mono-num">
              {game.job
                ? `${won(game.job.monthlySalary)}${game.job.tenureYears > 0 ? ` · ${game.job.tenureYears}년차` : ''}`
                : '—'}
            </dd>
            <dt className="text-faint">유형</dt>
            <dd data-testid="style">
              {game.investorType ? (
                <>
                  <b>{game.investorType.name}</b>
                  {game.investmentStyle && (
                    <span className="text-muted"> · {game.investmentStyle.name}</span>
                  )}
                </>
              ) : (
                '아직 모름'
              )}
            </dd>
            <dt className="text-faint">관심</dt>
            <dd>{game.interestSector?.name ?? '아직 모름'}</dd>
          </dl>
        </div>
      </div>
      <div className="border-t border-dashed border-line px-3 py-2 font-mono-num text-[10px] tracking-[0.08em] text-faint">
        {mrz(`KOR${nick.strength}<<${nick.weakness}`)}
        <br />
        {mrz(`${yearOf(game.startAge)}${String(ageYears).padStart(3, '0')}KOR`)}
      </div>
    </section>
  )
}

/** 여권 아래쪽 기계 판독 줄 흉내. 장식이다. */
function mrz(text: string): string {
  return `I<${text.toUpperCase()}`.padEnd(30, '<')
}
