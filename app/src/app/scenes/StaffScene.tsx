import './company-scenes.css'
import './staff-office.css'
import type { Company } from '@web/api/client'
import { signedMoney, withParticle } from '@web/features/game/labels'
import { GradeBadge, GradeCard } from '@web/features/raising/GradeCard'
import { LADDER, STAT_NAMES } from '@web/features/raising/grades'
import { LockedDesks } from '@web/features/raising/LockedDesks'
import { autoPlace, DESK_CAP, deskEffect, seatOne } from '@web/features/raising/placement'
import { useRaisingStore } from '@web/features/raising/store'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import {
  type Desk,
  DeskButtons,
  type Employee,
  EmployeeDetail,
  FIT_TONE,
  fitOf,
  NameTag,
} from '../people'
import { Sheet } from '../Sheet'
import { CatFigure, suitOf } from '../toy-city/CatFigure'
import { useAppUi } from '../ui'
import { deskLine, LOUNGE_LINE, loungeSpeaker, moodHearts, moodPhrase } from './staffLines'

/** 한 줄 책상에 앉는 자리 수. 폰 너비(390px)에 고양이 넷이 맞고, 더 많으면 다음 줄 책상으로 넘어간다. */
const PER_ROW = 4
/** 휴게실 소파 하나에 앉는 수(옆에 화분·커피가 놓인다). */
const PER_SOFA = 3

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}

const seatedAt = (company: Company, desk: string) =>
  company.employees
    .filter((e) => e.desk === desk)
    .sort((a, b) => Number(b.leader) - Number(a.leader) || a.id - b.id)

/**
 * 배치 장면 "우리 사무실" (decisions.md 269·309·412번): 팀마다 책상에 고양이 직원이 앉아 모니터를 보고, 팀장은 왕관·웃는 눈·말풍선. 빈 자리 "+"나
 * "팀 보기"를 누르면 그 팀 시트(빼기·팀장으로·앉힐 후보), 앉은 고양이를 누르면 직원 상세, 휴게실 소파에서 조는 동료를 누르면 보낼 팀을 고른다.
 */
export function StaffScene({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { place } = useRaisingStore.getState()
  const sheet = useAppUi((s) => s.sheet)
  const { closeSheet } = useAppUi.getState()
  const ended = company.status === 'ENDED'
  const working = company.employees.filter((e) => e.desk)
  const resting = company.employees.filter((e) => !e.desk).sort((a, b) => a.id - b.id)
  const openDesk =
    sheet?.kind === 'desk' ? company.desks.find((d) => d.code === sheet.desk) : undefined
  const sheetEmployee =
    sheet?.kind === 'employee' || sheet?.kind === 'lounge'
      ? company.employees.find((e) => e.id === sheet.id)
      : undefined
  return (
    <div className="company-scene staff-scene staff-office" data-testid="staff-scene">
      <header className="office-top">
        <h1>우리 사무실</h1>
        {!ended && company.employees.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              sfx.whoosh()
              haptic.light()
              void place(autoPlace(company))
            }}
            className="btn btn-primary min-h-11 px-4 text-[14px]"
          >
            ✨ 자동 배치
          </button>
        )}
      </header>
      <ul className="office-badges" aria-label="사무실 현황">
        <li>
          🐾 근무 {working.length} / {company.seats}자리
        </li>
        <li>☕ 휴게실 {resting.length}</li>
        <li>{moodPhrase(working.map((e) => e.morale))}</li>
      </ul>
      {company.employees.length === 0 ? (
        <p className="office-empty">아직 직원이 없습니다. 채용에서 뽑으세요.</p>
      ) : (
        <>
          <ul className="office-rooms" data-testid="desk-board">
            {company.desks.map((d) => (
              <TeamRoom key={d.code} company={company} desk={d} ended={ended} />
            ))}
          </ul>
          <Lounge company={company} resting={resting} />
        </>
      )}
      {!ended && <LockedDesks company={company} className="text-ink/80" />}
      {openDesk && <DeskSheet company={company} desk={openDesk} onClose={closeSheet} />}
      {sheetEmployee && sheet?.kind === 'employee' && (
        <EmployeeSheet company={company} employee={sheetEmployee} onClose={closeSheet} />
      )}
      {sheetEmployee && sheet?.kind === 'lounge' && (
        <LoungeSheet company={company} employee={sheetEmployee} onClose={closeSheet} />
      )}
    </div>
  )
}

/** 하트 다섯 칸의 팀 분위기. 아무도 없으면 그리지 않는다. */
function Hearts({ value }: { value: number }) {
  if (value === 0) {
    return null
  }
  return (
    <span className="office-hearts" role="img" aria-label={`팀 분위기 하트 ${value}개`}>
      {Array.from({ length: 5 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 하트 다섯 칸이다.
        <i key={i} data-on={i < value} aria-hidden="true">
          ❤️
        </i>
      ))}
    </span>
  )
}

/** 고양이 한 마리 그림. 앉은 자리·소파가 같이 쓴다. */
function CatArt({ employee: e, eyes }: { employee: Employee; eyes: 'open' | 'happy' | 'sleep' }) {
  return (
    <svg viewBox="0 0 36 40" className="office-cat-svg" aria-hidden="true">
      <CatFigure
        id={e.id}
        grade={e.overallGrade}
        eyes={eyes}
        suit={eyes === 'sleep' ? '#c38b7a' : suitOf(e.overallGrade, e.leader)}
      />
    </svg>
  )
}

/** 팀 방 하나: 이름·분위기 하트, 원하는 능력치·효과·지난 분기 손익, 책상에 앉은 고양이와 빈 자리, 팀장·인원과 "팀 보기". */
function TeamRoom({ company, desk: d, ended }: { company: Company; desk: Desk; ended: boolean }) {
  const { openSheet } = useAppUi.getState()
  const seated = seatedAt(company, d.code)
  const leader = seated.find((e) => e.leader)
  const report = company.lastQuarter?.reports.find((r) => r.desk === d.code)
  const pnl = report?.pnl
  const openDesk = () => {
    sfx.tap()
    openSheet({ kind: 'desk', desk: d.code })
  }
  // 빈 자리 "+"는 하나: 자리 수는 회사 전체(seats)라 팀마다 정해진 칸이 없다.
  const slots: (Employee | null)[] = ended ? seated : [...seated, null]
  return (
    <li className="office-room panel" data-hot={d.hot} data-filled={seated.length > 0}>
      <div className="office-room-head">
        <h2>
          {d.hot && <span className="office-hot">★ </span>}
          {d.name}
        </h2>
        <Hearts value={moodHearts(seated.map((e) => e.morale))} />
      </div>
      <p className="office-room-sub">
        원하는 능력치 <b>{STAT_NAMES[d.statCode]}</b> · {deskEffect(d)}
        {pnl != null && (
          <>
            {' · 지난 분기 '}
            <b className={pnl >= 0 ? 'office-up' : 'office-down'}>{signedMoney(pnl)}</b>
          </>
        )}
      </p>
      <div className="office-floor" data-testid="desk-members" data-empty={seated.length === 0}>
        {seated.length === 0 && <span className="sr-only">비어 있음</span>}
        {chunk(slots, PER_ROW).map((row, r) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 책상 줄은 순서로만 나뉜다.
            key={r}
            className="office-row"
            data-talk={row.some((e) => e?.leader)}
            style={{ gridTemplateColumns: `repeat(${PER_ROW}, minmax(0, 1fr))` }}
          >
            <span className="office-desk" aria-hidden="true" />
            {row.map((e) =>
              e ? (
                <button
                  key={e.id}
                  type="button"
                  className="office-seat"
                  data-leader={e.leader}
                  aria-label={`${e.leader ? '팀장 ' : ''}${e.name} ${e.overallGrade}등급`}
                  onClick={() => {
                    sfx.tap()
                    openSheet({ kind: 'employee', id: e.id })
                  }}
                >
                  {e.leader && (
                    <span className="office-bubble" aria-hidden="true">
                      {deskLine(e)}
                    </span>
                  )}
                  <span className="office-figure" aria-hidden="true">
                    {e.leader && <span className="office-crown">👑</span>}
                    <span
                      className="office-bob"
                      style={{ animationDelay: `${(e.id % 4) * -0.7}s` }}
                    >
                      <CatArt employee={e} eyes={e.leader ? 'happy' : 'open'} />
                    </span>
                    <span className="office-monitor" />
                  </span>
                  <span className="office-plate" aria-hidden="true">
                    <GradeBadge grade={e.overallGrade} size="inline" />
                    <span>{e.name}</span>
                  </span>
                </button>
              ) : (
                <button
                  key="add"
                  type="button"
                  className="office-seat office-add"
                  aria-label={`${d.name}에 동료 앉히기`}
                  onClick={openDesk}
                >
                  <span className="office-add-box" aria-hidden="true">
                    +
                  </span>
                </button>
              ),
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={ended}
        onClick={openDesk}
        className="office-room-foot"
        data-testid="desk-row"
        data-desk={d.code}
        data-filled={seated.length > 0}
        data-hot={d.hot}
      >
        <span>
          {seated.length === 0 ? (
            '동료를 배치해 팀을 시작하세요'
          ) : (
            <>
              {leader ? (
                <>
                  팀장 <b>{leader.name}</b> ·{' '}
                </>
              ) : null}
              <b>{seated.length}</b>명
            </>
          )}
        </span>
        {!ended && <span className="office-more">팀 보기 ›</span>}
      </button>
    </li>
  )
}

/** 휴게실: 쉬는 동료가 소파에서 존다. 한 사람은 "저 일하고 싶어요…". 누르면 보낼 팀을 고른다(끝난 회사면 상세만). */
function Lounge({ company, resting }: { company: Company; resting: Employee[] }) {
  const { openSheet } = useAppUi.getState()
  const ended = company.status === 'ENDED'
  const speaker = loungeSpeaker(resting)
  // 말하는 사람이 첫 소파 맨 앞에 앉아야 말풍선이 카드 밖으로 넘치지 않는다.
  const order = speaker ? [speaker, ...resting.filter((e) => e !== speaker)] : resting
  const sofas = order.length === 0 ? [[]] : chunk(order, PER_SOFA)
  return (
    <section className="office-room office-lounge panel" aria-label="휴게실" data-testid="lounge">
      <div className="office-room-head">
        <h2>☕ 휴게실</h2>
        <span className="office-hint">
          {resting.length === 0 ? '모두 일하는 중' : ended ? '' : '눌러서 팀에 보내요'}
        </span>
      </div>
      <div className="office-lounge-floor">
        {sofas.map((row, r) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 소파 줄은 순서로만 나뉜다.
            key={r}
            className="office-sofa-row"
            data-talk={row.some((e) => e === speaker)}
          >
            <span className="office-sofa" aria-hidden="true" />
            {row.map((e) => (
              <button
                key={e.id}
                type="button"
                className="office-seat office-rest"
                aria-label={`쉬는 중 ${e.name} ${e.overallGrade}등급`}
                data-testid="lounge-cat"
                onClick={() => {
                  sfx.tap()
                  openSheet(ended ? { kind: 'employee', id: e.id } : { kind: 'lounge', id: e.id })
                }}
              >
                {e === speaker && (
                  <span className="office-bubble" aria-hidden="true">
                    {LOUNGE_LINE}
                  </span>
                )}
                <span className="office-figure" aria-hidden="true">
                  {e !== speaker && <span className="office-zz">z z</span>}
                  <span className="office-bob" style={{ animationDelay: `${(e.id % 4) * -0.9}s` }}>
                    <CatArt employee={e} eyes={e === speaker ? 'open' : 'sleep'} />
                  </span>
                </span>
                <span className="office-plate" aria-hidden="true">
                  <GradeBadge grade={e.overallGrade} size="inline" />
                  <span>{e.name}</span>
                </span>
              </button>
            ))}
            {r === 0 && (
              <span className="office-lounge-deco" aria-hidden="true">
                <span className="office-coffee">☕</span>
                <span className="office-plant">🪴</span>
                <span className="office-stand" />
              </span>
            )}
          </div>
        ))}
        {resting.length === 0 && <p className="office-sofa-empty">소파가 비었어요</p>}
      </div>
    </section>
  )
}

/** 앉은 직원 한 명의 상세 (EmployeeDetail): 고양이를 누르면 뜬다. */
function EmployeeSheet({
  company,
  employee: e,
  onClose,
}: {
  company: Company
  employee: Employee
  onClose: () => void
}) {
  return (
    <Sheet title={e.name} onClose={onClose} testId="employee-sheet">
      <GradeCard
        grade={e.overallGrade}
        badgeLabel="종합"
        className="p-3 pl-[68px]"
        data-testid="employee"
      >
        <EmployeeDetail employee={e} company={company} />
      </GradeCard>
    </Sheet>
  )
}

/** 휴게실 동료를 보낼 팀 고르기: 맞는 팀부터, 누르면 바로 앉고 시트가 닫힌다. 자리가 꽉 찼으면 앉힐 수 없다. */
function LoungeSheet({
  company,
  employee: e,
  onClose,
}: {
  company: Company
  employee: Employee
  onClose: () => void
}) {
  const full = company.employees.filter((x) => x.desk).length >= company.seats
  return (
    <Sheet
      title={<>{withParticle(e.name, '을', '를')} 어디로 보낼까요?</>}
      onClose={onClose}
      testId="lounge-sheet"
    >
      <p className="mb-2 text-[13px]">
        <NameTag employee={e} /> <span className="text-muted">· 맞는 팀부터</span>
        {full && (
          <span className="block text-[12px] text-wine">
            자리가 꽉 찼어요. 다른 팀에서 한 명을 빼야 앉힐 수 있습니다.
          </span>
        )}
      </p>
      <DeskButtons company={company} employee={e} onSeated={onClose} />
    </Sheet>
  )
}

/** 자리 하나의 시트: 앉은 사람(빼기·팀장으로)과 앉힐 후보. 후보는 그 자리가 원하는 능력치가 높은 순이고, 다른 자리 사람은 옮겨 앉는다. */
function DeskSheet({
  company,
  desk: d,
  onClose,
}: {
  company: Company
  desk: Desk
  onClose: () => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const { place, appointLeader } = useRaisingStore.getState()
  const placed = company.employees.filter((e) => e.desk).length
  const full = placed >= company.seats
  const rank = (e: Employee) => LADDER.indexOf(e.grades[d.statCode] as (typeof LADDER)[number])
  const seated = seatedAt(company, d.code)
  // 한 자리에는 DESK_CAP명까지 (440번).
  const packed = seated.length >= DESK_CAP
  const others = company.employees
    .filter((e) => e.desk !== d.code)
    .sort((a, b) => rank(b) - rank(a) || a.id - b.id)
  const deskName = (code: string | null | undefined) =>
    company.desks.find((x) => x.code === code)?.name ?? code
  return (
    <Sheet
      title={
        <>
          {d.hot && '★ '}
          {d.name}
        </>
      }
      onClose={onClose}
      testId="desk-sheet"
    >
      <p className="text-[12px] text-muted">
        {d.description} {deskEffect(d)}
      </p>
      {seated.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {seated.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line-soft bg-white px-2 py-1.5 text-[13px]"
            >
              <GradeBadge grade={e.overallGrade} size="inline" />
              <b>{e.name}</b>
              <span className="font-mono-num text-[12px]">
                {STAT_NAMES[d.statCode]} {e.grades[d.statCode]}
              </span>
              {e.leader ? (
                <span className="rounded bg-gold px-1.5 text-[11px] text-white">팀장</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    sfx.coin()
                    haptic.light()
                    void appointLeader(d.code, e.id)
                  }}
                  className="btn btn-line min-h-8 px-2 text-[12px] text-gold"
                >
                  팀장으로
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  sfx.tap()
                  void place(seatOne(company, e.id, null))
                }}
                className="btn btn-line ml-auto min-h-8 px-2 text-[12px] text-muted"
              >
                빼기
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-muted">
        앉힐 사람 · {withParticle(STAT_NAMES[d.statCode], '이', '가')} 높은 순
        {` · ${seated.length}/${DESK_CAP}명`}
        {packed
          ? ' · 이 자리는 꽉 찼습니다'
          : full && ' · 자리가 꽉 차서 쉬는 사람은 앉힐 수 없습니다'}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {others.map((e) => {
          const fit = fitOf(e, d)
          const blocked = packed || (!e.desk && full)
          return (
            <button
              key={e.id}
              type="button"
              disabled={busy || blocked}
              onClick={() => {
                sfx.tap()
                haptic.light()
                onClose()
                void place(seatOne(company, e.id, d.code))
              }}
              className={`btn btn-line min-h-12 flex-col items-start px-2 text-left text-[13px] ${FIT_TONE[fit]}`}
              data-fit={fit}
              data-testid="desk-candidate"
            >
              <NameTag employee={e} />
              <span className="block font-mono-num text-[11px] opacity-80">
                {STAT_NAMES[d.statCode]} {e.grades[d.statCode]}
                {e.sector && d.sector === e.sector && ' · 관심'}
              </span>
              <span className="block text-[11px] text-muted">
                {e.desk ? `${deskName(e.desk)}에서 옮김` : '쉬는 중'}
              </span>
            </button>
          )
        })}
        {others.length === 0 && <p className="text-[13px] text-muted">다른 직원이 없습니다.</p>}
      </div>
    </Sheet>
  )
}
