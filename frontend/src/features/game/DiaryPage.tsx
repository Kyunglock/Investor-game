import type { Game } from '../../api/client'
import { gradeOf } from './grade'
import { PHASE_LABELS, STAT_KEYS, STAT_LABELS } from './labels'
import { type LogLine, logLines } from './log'
import { frugalMoment } from './moments'
import { nickname } from './nickname'
import { stageFor } from './pixel/bodies'
import { familyFigures } from './pixel/family'
import { layersFor } from './pixel/layers'
import { Scene } from './pixel/Scene'
import { SCENES, sceneCaption, sceneFor } from './pixel/scenes'
import { Vignette } from './pixel/Vignette'
import { useGameStore } from './store'

const VISIBLE = 12

/**
 * 수첩 왼쪽 쪽: 나 (2026-10-22 시안 D). 신원, 테이프로 붙인 도트 장면, 성격과 약점 포스트잇, 요즘 있었던 일. 모바일에서는 이 쪽이 먼저 와서 신원·능력치가
 * 인생 기록보다 위에 있다.
 */
export function DiaryPage({ game, ageYears }: { game: Game; ageYears: number }) {
  const month = Math.floor(game.market.month % 12) + 1
  return (
    <section
      aria-label="나"
      className="paper-ruled min-w-0 flex-[1_1_440px] px-5 pt-6 pb-8 pl-12 sm:pr-8"
    >
      <p className="font-pen text-[40px] leading-none">
        {month}월, {ageYears}살
      </p>
      <Identity game={game} />
      <Photo game={game} ageYears={ageYears} />
      <Personality game={game} />
      <Diary game={game} />
      <ReportButton game={game} />
      <p className="mt-4 text-right text-[11px] text-pen-soft" data-testid="reported-day">
        서버 확인: {game.day}일
      </p>
    </section>
  )
}

function Identity({ game }: { game: Game }) {
  const nick = nickname(game.initialStats)
  const job = game.job
    ? game.job.title
    : game.fullTimeInvestor
      ? '전업투자자'
      : game.phase === 'CHILDHOOD'
        ? '학생'
        : '구직 중'
  return (
    <div className="mt-1 mb-5 text-pen-soft" data-testid="identity-card">
      <p className="text-[15px]">
        <b className="text-pen" data-testid="nickname">
          {nick.name}
        </b>
        {' · '}
        <span data-testid="job">{job}</span>
        {game.job && game.job.tenureYears > 0 && ` ${game.job.tenureYears}년차`}
        {' · '}
        {PHASE_LABELS[game.phase]}
      </p>
      <p className="text-[13px]">
        <span data-testid="style">
          {game.investorType ? `${game.investorType.name}형` : '아직 모름'}
        </span>
        {game.interestSector && ` · 관심 ${game.interestSector.name}`}
      </p>
    </div>
  )
}

/** 지금 장면을 사진처럼 붙인다. 테이프 두 장은 장식이다. */
function Photo({ game, ageYears }: { game: Game; ageYears: number }) {
  // 전업투자자는 직장이 없어도 일자리를 찾는 중이 아니다 (decisions.md 35번).
  const working = (game.job !== null && game.job !== undefined) || game.fullTimeInvestor
  const key = sceneFor(stageFor(ageYears), game.phase, working)
  // 현금이 생활비에 못 미치거나 빚이 있으면 긴축 생활 장면 (decisions.md 62번).
  const frugal = frugalMoment(game)
  // 결혼하고 아이가 생기면 사진에 같이 선다 (decisions.md 64번).
  const figures = familyFigures(game, ageYears, frugal ? 34 : SCENES[key].anchor.x)
  return (
    <figure className="m-0 mb-6">
      <div className="relative -rotate-1">
        <span
          aria-hidden="true"
          className="absolute -top-2.5 left-6 z-10 h-[22px] w-[84px] -rotate-[4deg] bg-[var(--tape)]"
        />
        <span
          aria-hidden="true"
          className="absolute -top-2 right-8 z-10 h-[22px] w-[84px] rotate-[5deg] bg-[var(--tape)]"
        />
        <div className="overflow-hidden border-8 border-white bg-white shadow-[0_2px_6px_rgba(0,0,0,0.12)]">
          {frugal ? (
            <Vignette
              art={{ ...frugal.art, figures }}
              me={layersFor(game.initialStats, game.stats, ageYears, game.sex)}
              mood={frugal.mood}
            />
          ) : (
            <Scene
              sceneKey={key}
              sprite={layersFor(game.initialStats, game.stats, ageYears, game.sex)}
              figures={figures}
            />
          )}
        </div>
      </div>
      <figcaption className="mt-2 font-pen text-[24px] leading-tight" data-testid="scene-caption">
        {frugal
          ? `${sceneCaption(key, {
              tenure: game.housing.tenure,
              regionName: game.housing.regionName,
              married: game.household.married,
              children: game.household.children.length,
              fullTimeInvestor: game.fullTimeInvestor,
            }).replace(/ · [^·]*$/, '')} · ${frugal.caption}`
          : sceneCaption(key, {
              tenure: game.housing.tenure,
              regionName: game.housing.regionName,
              married: game.household.married,
              children: game.household.children.length,
              fullTimeInvestor: game.fullTimeInvestor,
            })}
      </figcaption>
    </figure>
  )
}

/** 능력치는 등급과 점수만. 지금 가장 낮은 능력치는 빨간 물결 밑줄과 포스트잇으로 짚는다. */
function Personality({ game }: { game: Game }) {
  const current = nickname(game.stats)
  return (
    <div className="mb-6 flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-[1_1_220px]">
        <h2 className="font-pen text-[28px] font-normal leading-8">내 성격</h2>
        <ul className="m-0 flex list-none flex-col p-0">
          {STAT_KEYS.map((key) => {
            const weak = key === current.weakness
            return (
              <li
                key={key}
                className={`grid grid-cols-[52px_1fr_auto] items-center gap-2 leading-8 ${weak ? 'text-red-pen' : ''}`}
                data-testid={`stat-${key}`}
              >
                <span className={weak ? 'underline decoration-wavy' : ''}>{STAT_LABELS[key]}</span>
                <span className="h-[3px] rounded-full bg-[var(--ruled)]">
                  <span
                    className={`block h-full rounded-full transition-[width] duration-500 ${weak ? 'bg-red-pen' : 'bg-pen'}`}
                    style={{ width: `${game.stats[key]}%` }}
                  />
                </span>
                <span className="font-pen text-[22px]">
                  {gradeOf(game.stats[key])} {game.stats[key]}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="m-0 w-[196px] flex-none rotate-2 bg-sticky px-3.5 py-3 font-pen text-[22px] leading-tight text-[#3b3320] shadow-[0_3px_8px_rgba(0,0,0,0.12)]">
        약점: {STAT_LABELS[current.weakness]} {game.stats[current.weakness]}점…
        <br />
        {current.weaknessEffect}
      </p>
    </div>
  )
}

/** 요즘 있었던 일. 최근 순으로 12줄, 나머지는 접는다. 판단이 뒤집힌 줄은 빨간 펜이다. */
function Diary({ game }: { game: Game }) {
  const lines = logLines(game)
  const shown = lines.slice(0, VISIBLE)
  const rest = lines.slice(VISIBLE)
  const kindOf = (i: number) => game.log[game.log.length - 1 - i]?.kind
  return (
    <section data-testid="life-log">
      <h2 className="font-pen text-[28px] font-normal leading-8">요즘 있었던 일</h2>
      <ol className="m-0 list-none p-0">
        {shown.map((line, i) => (
          <DiaryLine key={line.seq} line={line} kind={kindOf(i)} />
        ))}
      </ol>
      {rest.length > 0 && (
        <details className="text-pen-soft">
          <summary className="cursor-pointer font-pen text-[22px] leading-8">
            지난 일 더 보기 ({rest.length}줄)
          </summary>
          <ol className="m-0 list-none p-0">
            {rest.map((line, i) => (
              <DiaryLine key={line.seq} line={line} kind={kindOf(VISIBLE + i)} />
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

function DiaryLine({ line, kind }: { line: LogLine; kind?: string }) {
  const tone =
    line.tone === 'flipped' || line.tone === 'decline'
      ? 'text-red-pen'
      : line.tone === 'growth'
        ? 'text-blue-pen'
        : ''
  return (
    <li
      className={`animate-slide-in grid grid-cols-[48px_1fr] gap-2 py-1 leading-6 ${tone}`}
      data-testid="life-log-line"
      data-kind={kind}
    >
      <span className="font-pen text-[20px] leading-6 text-pen-soft">{line.age}살</span>
      {/* 세상 소식(전조·기사·위기 회고)은 놓치기 쉬워 형광펜을 그어 둔다 (#24, decisions.md 47번) */}
      <span className={line.pill === '세상' ? 'bg-sticky box-decoration-clone px-1' : ''}>
        {line.pill && (
          <span className="mr-1 font-pen text-[19px] text-pen-soft">[{line.pill}]</span>
        )}
        {line.text}
      </span>
    </li>
  )
}

/** 투자 성향 진단 보고서를 펼친다. 투자를 시작한 뒤부터 (decisions.md 61번). */
function ReportButton({ game }: { game: Game }) {
  const openReport = useGameStore((s) => s.openReport)
  if (game.phase === 'CHILDHOOD') {
    return null
  }
  return (
    <button
      type="button"
      className="mt-4 min-h-11 rounded-full border-2 border-pen bg-paper px-4 font-note text-sm text-pen hover:bg-white"
      onClick={openReport}
      data-testid="open-report"
    >
      투자 성향 진단 보고서
    </button>
  )
}
