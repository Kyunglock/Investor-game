import type { Game } from '../../api/client'
import { AssetCurve } from './AssetCurve'
import { Document } from './Document'
import { GradeBadge } from './GradeBadge'
import { LifeLog } from './LifeLog'
import { LifeMap } from './LifeMap'
import { percent, STAT_KEYS, STAT_LABELS, statLabel, won, yearOf } from './labels'
import { nickname } from './nickname'
import { ProfileReport } from './ProfileReport'
import { layersFor } from './pixel/layers'
import { Sprite } from './pixel/SpriteView'

/** 인생 기록부 (설계 5.7절). 끝난 판의 결과를 한 장의 문서로 보여 준다. */
export function LifeRecord({ game, onRestart }: { game: Game; onRestart: () => void }) {
  const result = game.result
  if (!result) {
    return null
  }
  const deviations = Object.entries(result.deviationCounts).sort(([, a], [, b]) => b - a)
  const up = result.returnBp >= 0
  const bankrupt = result.ending === 'BANKRUPT'
  const quit = result.ending === 'QUIT'

  return (
    <Document
      title="인생 기록부"
      number={`No. KOR-${yearOf(game.startAge)}-${game.gameId.slice(0, 7)}`}
      testId="result-screen"
    >
      <div className="flex items-start gap-4">
        <Sprite
          spec={layersFor(game.initialStats, game.stats, game.endAge, game.sex)}
          size={64}
          className="border border-line bg-bg"
        />
        <div className="min-w-0">
          <p className="text-[11px] text-faint">이름</p>
          <h2 className="font-serif-kr text-[26px] font-black leading-tight">
            {nickname(game.initialStats).name}
          </h2>
          <p className="text-[13px] text-muted">
            {result.finalAge}세,{' '}
            {bankrupt ? '파산했습니다' : quit ? '여기서 멈췄습니다' : '투자 인생을 마쳤습니다'} ·{' '}
            {game.job?.title ?? (game.fullTimeInvestor ? '전업투자자' : '무직')} ·{' '}
            {game.investorType?.name ?? '유형 미정'}
          </p>
        </div>
      </div>

      <p className="mt-5 font-serif-kr text-2xl font-black">
        <span className="font-mono-num text-base font-normal text-muted">
          {won(result.initialAsset)} →
        </span>{' '}
        <span className="font-mono-num">{won(result.finalAsset)}</span>{' '}
        <span className={`font-mono-num text-lg ${up ? 'text-up' : 'text-down'}`}>
          ({up ? '+' : ''}
          {percent(result.returnBp)})
        </span>
      </p>

      <p className="mt-1 text-[13px] text-muted" data-testid="result-epilogue">
        {bankrupt
          ? `빚 ${won(game.debt)}을 갚을 길이 없어 ${result.finalAge}세에 파산했습니다.`
          : quit
            ? `${result.finalAge}세에 투자 인생을 스스로 멈췄습니다.`
            : `이후로는 매달 연금 ${won(game.household.pension)}으로 여생을 보냅니다.`}
      </p>

      <p className="mt-2 text-[13px] text-muted" data-testid="result-family">
        가족 ·{' '}
        {game.household.married
          ? `배우자${game.household.children.length > 0 ? `, 자녀 ${game.household.children.length}` : ''}`
          : '혼자'}
        {game.debt > 0 && (
          <>
            {' · 남은 빚 '}
            <span className="font-mono-num text-up">{won(game.debt)}</span>
          </>
        )}
      </p>

      {game.holdings.length > 0 && (
        <>
          <h3 className="mt-5 text-[11px] text-faint">최종 포트폴리오</h3>
          <table className="mt-1.5 w-full border-collapse text-xs">
            <tbody>
              {game.holdings.map((h) => (
                <tr key={h.stockCode}>
                  <td className="border-b border-line-soft py-1">{h.stockName}</td>
                  <td className="border-b border-line-soft py-1 text-right font-mono-num">
                    {h.quantity.toLocaleString('ko-KR')}주
                  </td>
                  <td
                    className={`border-b border-line-soft py-1 text-right font-mono-num ${h.pnlBp > 0 ? 'text-up' : h.pnlBp < 0 ? 'text-down' : ''}`}
                  >
                    {percent(h.pnlBp)}
                  </td>
                  <td className="border-b border-line-soft py-1 text-right font-mono-num">
                    {won(h.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 className="mt-6 text-[11px] text-faint">최종 능력치</h3>
      <ul className="mt-1.5 grid grid-cols-5 gap-2 text-center">
        {STAT_KEYS.map((key) => (
          <li key={key} className="rounded border border-line-soft bg-bg py-2">
            <p className="text-[11px] text-faint">{STAT_LABELS[key]}</p>
            <p className="font-mono-num font-semibold">
              <GradeBadge score={game.stats[key]} className="mr-1" />
              {game.stats[key]}
            </p>
          </li>
        ))}
      </ul>

      {deviations.length > 0 && (
        <>
          <h3 className="mt-5 text-[11px] text-faint">내 선택이 뒤집힌 횟수</h3>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {deviations.map(([code, count]) => (
              <li
                key={code}
                className="rounded-full border border-wine px-3 py-0.5 text-xs text-wine"
              >
                {statLabel(code)} 부족 {count}번
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 flex flex-col gap-3.5">
        <AssetCurve game={game} ageYears={result.finalAge} full />
        <LifeMap game={game} ageYears={result.finalAge} />
        <ProfileReport game={game} />
        <details>
          <summary className="cursor-pointer text-[13px] text-muted">인생 기록 전체 보기</summary>
          <div className="mt-2">
            <LifeLog game={game} />
          </div>
        </details>
      </div>

      <button
        type="button"
        className="mt-6 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
        onClick={onRestart}
      >
        다시 태어나기
      </button>
    </Document>
  )
}
