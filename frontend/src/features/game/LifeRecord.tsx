import { useMemo } from 'react'
import type { Game } from '../../api/client'
import { spouseWord } from '../../api/spouseTerms'
import { AssetCurve } from './AssetCurve'
import { buildCredits, scoreDecisions } from './credits'
import { Document } from './Document'
import { GradeBadge } from './GradeBadge'
import { LifeLog } from './LifeLog'
import {
  actionLabelFor,
  percent,
  STAT_KEYS,
  STAT_LABELS,
  shortWon,
  signedShortWon,
  statLabel,
  won,
  yearOf,
} from './labels'
import { ProfileReport } from './ProfileReport'
import { layersFor } from './pixel/layers'
import { Sprite } from './pixel/SpriteView'
import { Vignette } from './pixel/Vignette'
import { playerName } from './playerName'
import { RankingBoard } from './RankingBoard'
import { highlights, plainProfile } from './resultSummary'
import { SharePanel } from './SharePanel'
import { lifeVerdict } from './verdict'

/**
 * 인생 기록부 (설계 5.7절, decisions.md 193번). 한 장 요약이 먼저다: 결말과 최종 자산, 한 줄 평, 인생 하이라이트 그림 몇 장, 최고·최악의 한 수,
 * 쉬운 말로 쓴 투자 성향. 그 아래 다시 태어나기·순위표·공유, 세부 숫자(자산 곡선·능력치·포트폴리오·성향 보고서·전체 기록)는 접어 둔다.
 */
export function LifeRecord({ game, onRestart }: { game: Game; onRestart: () => void }) {
  const credits = useMemo(() => buildCredits(game), [game])
  const scenes = useMemo(() => highlights(credits), [credits])
  const profile = useMemo(() => plainProfile(game), [game])
  const decisions = useMemo(() => scoreDecisions(game), [game])
  const me = useMemo(() => {
    const { sex, adornment, mark } = layersFor(game.initialStats, game.stats, game.endAge, game.sex)
    return { sex, adornment, mark }
  }, [game])
  const result = game.result
  if (!result) {
    return null
  }
  const bankrupt = result.ending === 'BANKRUPT'
  const quit = result.ending === 'QUIT'
  const hasFamily = game.household.married || game.household.children.length > 0
  const up = result.returnBp >= 0
  const best = decisions.reduce<(typeof decisions)[number] | null>(
    (acc, d) => (d.score > 0 && (!acc || d.score > acc.score) ? d : acc),
    null,
  )
  const worst = decisions.reduce<(typeof decisions)[number] | null>(
    (acc, d) => (d.score < 0 && (!acc || d.score < acc.score) ? d : acc),
    null,
  )
  const flipped = Object.values(result.deviationCounts).reduce((a, b) => a + b, 0)
  const deviations = Object.entries(result.deviationCounts).sort(([, a], [, b]) => b - a)

  return (
    <Document
      title="인생 기록부"
      number={`No. KOR-${yearOf(game.startAge)}-${game.gameId.slice(0, 7)}`}
      testId="result-screen"
    >
      {/* 1. 결말 */}
      <section className="text-center" data-testid="result-hero">
        <div className="flex justify-center">
          <Sprite
            spec={layersFor(game.initialStats, game.stats, game.endAge, game.sex)}
            size={72}
            className="rounded border border-line bg-bg"
          />
        </div>
        <h2 className="mt-2 font-serif-kr text-[26px] font-black leading-tight">
          {playerName(game)}의 인생
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {yearOf(game.startAge)}–{yearOf(result.finalAge)} ·{' '}
          {game.job?.title ?? (game.fullTimeInvestor ? '전업투자자' : '무직')}
          {hasFamily &&
            ` · ${game.household.married ? spouseWord(game.sex) : ''}${game.household.married && game.household.children.length > 0 ? '와 ' : ''}${game.household.children.length > 0 ? `자녀 ${game.household.children.length}` : ''}`}
        </p>
        <p
          className={`mt-3 inline-block rounded-full px-3 py-1 text-[13px] font-bold ${bankrupt ? 'bg-wine text-white' : quit ? 'bg-bg text-muted' : 'bg-teal-soft text-teal'}`}
          data-testid="result-ending"
        >
          {result.finalAge}세 · {bankrupt ? '파산' : quit ? '여기서 멈춤' : '은퇴 후 연금 생활'}
        </p>
        <p className="mt-3 text-[12px] text-faint">{bankrupt ? '남긴 빚' : '최종 자산'}</p>
        <p
          className={`font-mono-num text-[34px] font-black leading-tight ${bankrupt ? 'text-down' : ''}`}
          data-testid="result-asset"
        >
          {bankrupt ? shortWon(game.debt) : shortWon(result.finalAsset)}
        </p>
        {/* 0원에서 시작했으면 수익률이 없다 (decisions.md 94번). */}
        {!bankrupt && result.initialAsset > 0 && (
          <p className={`font-mono-num text-sm ${up ? 'text-up' : 'text-down'}`}>
            시작 {shortWon(result.initialAsset)}에서 {up ? '+' : ''}
            {percent(result.returnBp)}
          </p>
        )}
        {/* 돈·행복·가족을 함께 본 한 줄 평가 (#230, decisions.md 167번) */}
        <p
          className="mt-4 font-serif-kr text-[19px] font-bold leading-snug"
          data-testid="result-verdict"
        >
          “
          {lifeVerdict({
            finalAsset: result.finalAsset,
            bankrupt,
            happiness: game.happiness,
            family: game.family,
            hasFamily,
          })}
          ”
        </p>
        <p className="mt-1.5 text-[12px] text-muted" data-testid="result-epilogue">
          {bankrupt
            ? `빚을 갚을 길이 없어 ${result.finalAge}세에 파산했다.`
            : quit
              ? `${result.finalAge}세에 투자 인생을 스스로 멈췄다.`
              : `이후로는 매달 연금 ${won(game.household.pension)}으로 여생을 보낸다.`}
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-2" data-testid="result-tiles">
          <Tile label="행복도" value={`${game.happiness}`} unit="/100" />
          {hasFamily ? (
            <Tile label="가족" value={`${game.family}`} unit="/100" />
          ) : (
            <Tile label="가족" value="혼자" />
          )}
          <Tile label="뒤집힌 선택" value={`${flipped}`} unit="번" />
        </ul>
      </section>

      {/* 2. 인생 하이라이트 */}
      {scenes.length > 0 && (
        <section className="mt-7" data-testid="result-highlights">
          <h3 className="text-[11px] font-bold tracking-wider text-faint">인생의 장면들</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2.5">
            {scenes.map((scene) => (
              <li key={scene.key} className="overflow-hidden rounded border border-line-soft bg-bg">
                {scene.art && (
                  <div className="[&_svg]:mb-0">
                    <Vignette art={scene.art} me={me} />
                  </div>
                )}
                <div className="px-2.5 py-1.5">
                  <p className="text-[12px] font-bold leading-snug">{scene.lines[0]?.text}</p>
                  {scene.lines[0]?.sub && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
                      {scene.lines[0].sub}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3. 최고·최악의 한 수 */}
      {(best || worst) && (
        <section className="mt-6 grid gap-2 sm:grid-cols-2" data-testid="result-moves">
          {best && (
            <Move
              label="최고의 한 수"
              tone="up"
              text={`${best.age}세 · ${best.title}`}
              sub={`${best.kind === 'TRADE' ? '자유 매매' : `${actionLabelFor(best.kind, best.actual)} ${best.stockName}`} · ${signedShortWon(best.score)}`}
            />
          )}
          {worst && (
            <Move
              label="가장 아쉬운 선택"
              tone="down"
              text={`${worst.age}세 · ${worst.title}`}
              sub={`${worst.kind === 'TRADE' ? '자유 매매' : `${actionLabelFor(worst.kind, worst.actual)} ${worst.stockName}`}${worst.chosen !== worst.actual ? ` (원래는 ${actionLabelFor(worst.kind, worst.chosen)})` : ''} · ${signedShortWon(worst.score)}`}
            />
          )}
        </section>
      )}

      {/* 4. 나는 이런 투자자 (코드 없이 쉬운 말로) */}
      <section
        className="mt-6 rounded border border-line bg-bg px-4 py-3.5"
        data-testid="result-profile"
      >
        <h3 className="text-[11px] font-bold tracking-wider text-faint">나는 이런 투자자였다</h3>
        {profile.invested ? (
          <>
            <p className="mt-1 font-serif-kr text-[20px] font-black">{profile.name}</p>
            <p className="text-[12px] text-muted">{profile.tagline}</p>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {profile.traits.map((t) => (
                <li key={t.text} className="text-[13px]">
                  <span className="mr-1.5 text-teal">✓</span>
                  {t.text}
                  <span className="block pl-5 text-[11px] text-faint">{t.evidence}</span>
                </li>
              ))}
            </ul>
            {profile.caution && (
              <p className="mt-2.5 border-t border-line-soft pt-2 text-[12px] text-wine">
                다음 인생에는 · {profile.caution}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-[13px] text-muted">투자를 시작하지 않은 인생이었다.</p>
        )}
      </section>

      {/* 5. 다음 행동 */}
      <button
        type="button"
        className="mt-6 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
        onClick={onRestart}
      >
        다시 태어나기
      </button>
      <div className="mt-4 flex flex-col gap-3.5">
        <RankingBoard game={game} />
        <SharePanel game={game} />
      </div>

      {/* 6. 세부 기록은 접어 둔다 */}
      <details className="mt-5" data-testid="result-details">
        <summary className="cursor-pointer text-[13px] text-muted">자세한 기록 보기</summary>
        <div className="mt-3 flex flex-col gap-4">
          <AssetCurve game={game} ageYears={result.finalAge} full />
          <div>
            <h3 className="text-[11px] text-faint">최종 능력치</h3>
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
              <p className="mt-2 text-[12px] text-muted">
                뒤집힌 선택:{' '}
                {deviations
                  .map(([code, count]) => `${statLabel(code)} 부족 ${count}번`)
                  .join(' · ')}
              </p>
            )}
          </div>
          {game.holdings.length > 0 && (
            <div>
              <h3 className="text-[11px] text-faint">끝에 들고 있던 주식</h3>
              <ul className="mt-1.5 text-xs">
                {game.holdings.map((h) => (
                  <li
                    key={h.stockCode}
                    className="flex justify-between border-b border-line-soft py-1"
                  >
                    <span>
                      {h.stockName} {h.quantity.toLocaleString('ko-KR')}주
                    </span>
                    <span className="font-mono-num">
                      {shortWon(h.value)}{' '}
                      <span className={h.pnlBp >= 0 ? 'text-up' : 'text-down'}>
                        {h.pnlBp >= 0 ? '+' : ''}
                        {percent(h.pnlBp)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ProfileReport game={game} />
          {game.investorType && <SharePanel game={game} focus="type" />}
          <div>
            <h3 className="text-[11px] text-faint">인생 기록 전체</h3>
            <div className="mt-2">
              <LifeLog game={game} />
            </div>
          </div>
        </div>
      </details>
    </Document>
  )
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <li className="rounded border border-line-soft bg-bg px-1 py-2">
      <p className="text-[11px] text-faint">{label}</p>
      <p className="font-mono-num text-lg font-bold leading-tight">
        {value}
        {unit && <span className="text-[11px] font-normal text-faint">{unit}</span>}
      </p>
    </li>
  )
}

function Move({
  label,
  tone,
  text,
  sub,
}: {
  label: string
  tone: 'up' | 'down'
  text: string
  sub: string
}) {
  return (
    <div
      className={`rounded border-l-[3px] bg-bg px-3 py-2 ${tone === 'up' ? 'border-up' : 'border-down'}`}
    >
      <p className={`text-[11px] font-bold ${tone === 'up' ? 'text-up' : 'text-down'}`}>{label}</p>
      <p className="text-[13px] font-bold leading-snug">{text}</p>
      <p className="text-[12px] text-muted">{sub}</p>
    </div>
  )
}
