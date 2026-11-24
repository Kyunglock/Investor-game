import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { CatPortrait } from '../idle/CatPortrait'
import { SkillBadge } from '../idle/SkillBadge'
import { stageTeamOf } from '../idle/stageTeam'
import { ENEMIES } from './enemies'
import { WAVE_SECONDS } from './genres'
import { WAVE_ORDER, waveKind } from './waves'

type Cat = NonNullable<Company['idle']>['cats'][number]

/**
 * 출전 화면의 출전 고양이 줄 (decisions.md 678번): 고양이 카드를 고를 때마다 나올 고양이를 출전 칸의 차례대로 보인다(669번).
 * 사장냥이 쉬면(672번) 맨 앞 고양이는 처음부터 나온다.
 */
export function StageLobbyTeam({ company }: { company: Company }) {
  const owned = company.idle?.cats ?? []
  const team = stageTeamOf(company).flatMap((code) => owned.filter((c) => c.code === code))
  const benched = company.idle?.bossFielded === false && team.length > 0
  return (
    <section className="stage-lobby-team" data-testid="stage-lobby-team" aria-label="출전 고양이">
      <header>
        <b>출전 고양이</b>
        <span>{benched ? '사장냥은 쉬어요' : '고양이 카드를 고르면 차례로 나와요'}</span>
      </header>
      {team.length === 0 ? (
        <p className="stage-lobby-team-empty">출전한 고양이가 없어요 · 사장냥 혼자 싸워요</p>
      ) : (
        <ol>
          {team.map((cat: Cat, i) => (
            <li key={cat.code} data-testid="stage-lobby-cat" data-code={cat.code}>
              <em className="stage-lobby-team-order">{i + 1}</em>
              <CatPortrait code={cat.code as CatCode} grade={cat.grade} />
              <b>{cat.name}</b>
              {/* 고유 스킬은 그림으로만 (스테이지에서는 Lv.1부터 쓴다, 669번). C·B등급은 스킬이 없어 비운다. */}
              <span className="stage-lobby-team-skills">
                {cat.skills.map((s) => (
                  <SkillBadge key={s.code} skill={s.code} size={20} label={s.name} />
                ))}
              </span>
              {benched && i === 0 && <small>처음부터</small>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

const WAVE_NAMES = { panic: '패닉셀', dump: '투매', short: '공매도' } as const

/**
 * 출전 화면의 한 판 타임라인 (decisions.md 678번): WAVE_SECONDS마다 오는 파도(패닉셀 → 투매 → 공매도)를 눈금으로, 챕터 끝 판이면
 * 한가운데에 나오는 보스를 표시한다. 판이 끝나는 순간의 파도는 오지 않으므로 그리지 않는다.
 */
export function StageTimeline({ seconds, bossAt }: { seconds: number; bossAt?: number }) {
  const waves = Array.from({ length: Math.ceil(seconds / WAVE_SECONDS) - 1 }, (_, i) => ({
    at: (i + 1) * WAVE_SECONDS,
    kind: waveKind(i),
  }))
  const pct = (t: number) => `${(t / seconds) * 100}%`
  return (
    <section
      className="stage-timeline"
      data-testid="stage-timeline"
      data-waves={waves.length}
      aria-label={`${clock(seconds)} 동안 파도 ${waves.length}번${bossAt ? `, ${clock(bossAt)}에 보스` : ''}`}
    >
      <div className="stage-timeline-bar" aria-hidden="true">
        {waves.map((w) => (
          <i
            key={w.at}
            className="stage-timeline-wave"
            data-kind={w.kind}
            style={{ left: pct(w.at), background: ENEMIES[w.kind].fill }}
          />
        ))}
        {bossAt !== undefined && (
          <span
            className="stage-timeline-boss"
            data-testid="stage-timeline-boss"
            style={{ left: pct(bossAt) }}
          >
            👑
          </span>
        )}
      </div>
      <div className="stage-timeline-clock" aria-hidden="true">
        <span>0:00</span>
        {bossAt !== undefined && (
          <span className="is-boss" style={{ left: pct(bossAt) }}>
            {clock(bossAt)} 보스
          </span>
        )}
        <span>{clock(seconds)} 버티면 승리</span>
      </div>
      <ul className="stage-timeline-legend" aria-hidden="true">
        {WAVE_ORDER.map((kind) => (
          <li key={kind}>
            <i style={{ background: ENEMIES[kind].fill }} />
            {WAVE_NAMES[kind]} 파도
          </li>
        ))}
        <li>{WAVE_SECONDS}초마다</li>
      </ul>
    </section>
  )
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
