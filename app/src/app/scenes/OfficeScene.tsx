import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { GradeCard } from '@web/features/raising/GradeCard'
import { IndustryLine } from '@web/features/raising/IndustryLine'
import { OfficeArt, type SeatFocus } from '@web/features/raising/OfficeArt'
import { OfficeRoom } from '@web/features/raising/OfficeRoom'
import { nextStep } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { useLocked, useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { TUTORIAL_STEPS, tutorialStep, useTutorial } from '@web/features/raising/tutorial'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import { DeskButtons, EmployeeDetail, NameTag } from '../people'
import { Sheet } from '../Sheet'
import { useAppUi } from '../ui'

/**
 * 사무실 장면 (decisions.md 309·310·343번): 앱의 첫 화면이다. 제목 로고, 일하는 고양이 사무실 그림, 시대 한 줄, 튜토리얼 띠, 다음 건물, 사무실 미니맵.
 * 미니맵의 칸을 누르면 아래에서 자리 고르기 시트가 올라온다.
 */
export function OfficeScene({ company }: { company: Company }) {
  const sheet = useAppUi((s) => s.sheet)
  const { openSheet, closeSheet } = useAppUi.getState()
  const ended = company.status === 'ENDED'
  const focus = sheet?.kind === 'seat' ? sheet.focus : null
  return (
    <div data-testid="office-scene">
      <h1
        className="title-in text-center font-game text-[30px] leading-none text-[#ffd23f] [-webkit-text-stroke:3px_var(--outline)] [paint-order:stroke] [text-shadow:0_4px_0_var(--outline)]"
        data-testid="title"
      >
        흔들리지 않는 고양이
      </h1>
      <div className="panel mt-2 overflow-hidden p-0">
        <OfficeRoom company={company} />
      </div>
      <p className="panel-dark mt-2 px-3 py-1.5 text-[12px] text-ink/70" data-testid="era">
        <b className="text-[#e08a00]">{company.era.name}</b> · {company.era.description}
      </p>
      {company.opening && !company.lastSettlement && (
        <p className="mt-2 text-[13px] text-ink/85" data-testid="opening">
          {company.opening}
        </p>
      )}
      <TutorialWrap company={company} />
      <IndustryLine company={company} className="mt-2 text-center text-ink/80" />
      <NextStep company={company} />
      <OfficeArt
        company={company}
        focus={focus}
        onSeat={
          ended
            ? undefined
            : (f) => {
                sfx.tap()
                openSheet({ kind: 'seat', focus: f })
              }
        }
      />
      {focus && <SeatSheet company={company} focus={focus} onClose={closeSheet} />}
    </div>
  )
}

/**
 * 튜토리얼 한 줄 (decisions.md 347번): 말풍선 설명 대신 지금 걸음과 짧은 안내만. 열리지 않은 탭·버튼은 잠겨 있어 눌러야 할 것이 하나뿐이다. 마지막 걸음에선
 * 끝내기, 그 전엔 건너뛰기(모두 연다).
 */
function TutorialWrap({ company }: { company: Company }) {
  const active = useTutorial((s) => s.active)
  const { finish } = useTutorial.getState()
  if (!active || company.status === 'ENDED') {
    return null
  }
  const step = tutorialStep(company)
  const last = step.n === TUTORIAL_STEPS
  return (
    <div
      className="panel mt-2 flex items-center gap-2 px-3 py-2"
      data-testid="tutorial"
      data-step={step.id}
    >
      <span className="shrink-0 rounded-full border-2 border-(--outline) bg-[#fff6c9] px-2 py-0.5 font-game text-[12px]">
        {step.n}/{TUTORIAL_STEPS}
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-tight">
        <b className="font-game text-[14px]">{step.title}</b>
        <span className="block text-[12px] text-ink/70">{step.short}</span>
      </p>
      <button
        type="button"
        onClick={() => {
          sfx.tap()
          finish()
        }}
        className={`shrink-0 rounded-full px-3 py-1 text-[12px] ${last ? 'btn btn-teal min-h-9 text-white' : 'text-ink/55 underline'}`}
        data-testid="tutorial-finish"
      >
        {last ? '다 열렸다!' : '건너뛰기'}
      </button>
    </div>
  )
}

/** 다음 건물 (decisions.md 296번): 자본이 다음 띠 + 이사 비용 이상이면 버튼이 켜진다. 누르면 도장·진동·코인. */
function NextStep({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { upgrade } = useRaisingStore.getState()
  const step = nextStep(company.grade)
  const plan = company.upgrade
  const spot = useTutorialSpot(company, 'upgrade')
  const locked = useLocked(company, 'upgrade')
  if (!step || !plan || company.status === 'ENDED') {
    return null
  }
  const label = step.kind === 'move' ? `다음 건물 ${step.to}` : '사무실 등급 올리기'
  const short = plan.needed - company.capital
  // 공사 중 (#347): 새 건물은 몇 해에 걸쳐 짓는다. 그동안 지금 건물에서 일한다.
  if (plan.left != null) {
    const done = plan.years - plan.left
    return (
      <div className="panel mt-2 border-2 border-gold px-3 py-2" data-testid="construction">
        <p className="text-[12px] text-muted">
          <b className="block text-[13px] text-gold">
            공사 중 · {step.kind === 'move' ? step.to : label}
          </b>
          {plan.years}년 중 {done + 1}년째 · 연말 결산마다 한 해씩 짓는다
        </p>
        <div className="mt-1 h-2 overflow-hidden rounded bg-ink/10">
          <div
            className="h-full bg-gold transition-[width] duration-700"
            style={{ width: `${Math.round(((done + 0.5) / plan.years) * 100)}%` }}
          />
        </div>
      </div>
    )
  }
  return (
    <div
      className={`panel mt-2 flex items-center justify-between gap-2 border-2 px-3 py-2 ${
        plan.affordable ? 'border-gold' : 'border-transparent'
      } ${spot}`}
      data-testid="next-step"
      data-affordable={plan.affordable}
    >
      <p className="min-w-0 text-[12px] text-muted">
        <b className={`block text-[13px] ${plan.affordable ? 'text-gold' : 'text-ink'}`}>{label}</b>
        이사 비용 {money(plan.cost)} · 자본 {money(plan.needed)}부터
        {!plan.affordable && ` (${money(short)} 더)`}
        {plan.years > 0 && ` · 공사 ${plan.years}년`}
      </p>
      <button
        type="button"
        disabled={busy || !plan.affordable || locked}
        aria-disabled={locked || undefined}
        onClick={(ev) => {
          sfx.stamp()
          haptic.heavy()
          useFx.getState().burstAt(ev.currentTarget, 'coins')
          void upgrade()
        }}
        className={`btn min-h-12 shrink-0 px-4 text-[14px] ${locked ? 'btn-line opacity-50' : plan.affordable ? 'btn-gold animate-glow' : 'btn-line'}`}
        data-testid="upgrade"
        data-locked={locked || undefined}
      >
        {locked
          ? '🔒'
          : plan.years > 0
            ? '공사 시작'
            : step.kind === 'move'
              ? '이사하기'
              : '올리기'}
      </button>
    </div>
  )
}

/** 미니맵 칸을 누르면 올라오는 시트 (237번): 사람이면 상세와 자리 버튼, 빈 자리면 쉬는 사람 가운데 앉힐 사람. */
function SeatSheet({
  company,
  focus,
  onClose,
}: {
  company: Company
  focus: SeatFocus
  onClose: () => void
}) {
  const { openSheet, setTab } = useAppUi.getState()
  if ('employee' in focus) {
    const e = company.employees.find((x) => x.id === focus.employee)
    if (!e) {
      return null
    }
    return (
      <Sheet title={`${e.name} 자리 고르기`} onClose={onClose} testId="seat-sheet">
        <GradeCard grade={e.overallGrade} badgeLabel="종합" className="p-3 pl-[68px]">
          <EmployeeDetail employee={e} company={company} />
        </GradeCard>
        <p className="mt-3 text-[13px] text-muted">어디에 앉힐까요? 맞는 자리부터 늘어섭니다.</p>
        <div className="mt-1">
          <DeskButtons
            company={company}
            employee={e}
            onSeated={() => {
              sfx.tap()
              haptic.light()
              onClose()
            }}
          />
        </div>
      </Sheet>
    )
  }
  const resting = company.employees.filter((x) => !x.desk)
  return (
    <Sheet title="빈 자리에 누구를 앉힐까요?" onClose={onClose} testId="seat-sheet">
      {resting.length > 0 ? (
        <div className="grid gap-1.5">
          {resting.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => openSheet({ kind: 'seat', focus: { employee: x.id } })}
              className="btn btn-line min-h-12 justify-start px-3 text-left text-[14px]"
            >
              <NameTag employee={x} />{' '}
              <span className="font-mono-num text-[12px] text-muted">종합 {x.overallGrade}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-[13px] text-muted">쉬는 직원이 없습니다. 채용에서 뽑으세요.</p>
          <button
            type="button"
            onClick={() => {
              sfx.tap()
              setTab('market')
            }}
            className="btn btn-blue min-h-12 text-[14px]"
          >
            채용 보러 가기
          </button>
        </div>
      )}
    </Sheet>
  )
}
