import type { Company } from '@web/api/client'
import { shortWon } from '@web/features/game/labels'
import { usePixelArt } from '@web/features/game/pixelArt'
import { BuildingArt } from '@web/features/raising/BuildingArt'
import { GradeCard } from '@web/features/raising/GradeCard'
import { OfficeArt, type SeatFocus } from '@web/features/raising/OfficeArt'
import { nextStep } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import { TutorialBanner, useTutorialSpot } from '@web/features/raising/TutorialBanner'
import { useTutorial } from '@web/features/raising/tutorial'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'
import { DeskButtons, EmployeeDetail, NameTag } from '../people'
import { Sheet } from '../Sheet'
import { useAppUi } from '../ui'

/**
 * 사무실 장면 (decisions.md 309·310번): 시대 한 줄, 튜토리얼 띠, 건물, 이사, 사무실 미니맵. 미니맵의 칸을 누르면 아래에서 자리 고르기 시트가 올라온다.
 */
export function OfficeScene({ company }: { company: Company }) {
  const sheet = useAppUi((s) => s.sheet)
  const { openSheet, closeSheet } = useAppUi.getState()
  const ended = company.status === 'ENDED'
  const focus = sheet?.kind === 'seat' ? sheet.focus : null
  return (
    <div data-testid="office-scene">
      <p className="panel-dark px-3 py-1.5 text-[12px] text-white/70" data-testid="era">
        <b className="text-(--gold-bright)">{company.era.name}</b> · {company.era.description}
      </p>
      {company.opening && !company.lastSettlement && (
        <p className="mt-2 text-[13px] text-white/85" data-testid="opening">
          {company.opening}
        </p>
      )}
      <TutorialWrap company={company} />
      <div className="panel mx-auto mt-2 max-w-[360px] p-2">
        <BuildingArt grade={company.grade} />
      </div>
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
      <PixelToggle />
      {focus && <SeatSheet company={company} focus={focus} onClose={closeSheet} />}
    </div>
  )
}

/** 튜토리얼 띠는 종이빛 카드 안에 둔다(바탕이 어둡다). 켜져 있지 않으면 아무것도 없다. */
function TutorialWrap({ company }: { company: Company }) {
  const active = useTutorial((s) => s.active)
  if (!active || company.status === 'ENDED') {
    return null
  }
  return (
    <div className="panel mt-2 px-3 pb-2">
      <TutorialBanner company={company} />
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
  if (!step || !plan || company.status === 'ENDED') {
    return null
  }
  const label = step.kind === 'move' ? `다음 건물 ${step.to}` : '사무실 넓히기'
  const short = plan.needed - company.capital
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
        이사 비용 {shortWon(plan.cost)} · 자본 {shortWon(plan.needed)}부터
        {!plan.affordable && ` (${shortWon(short)} 더)`}
      </p>
      <button
        type="button"
        disabled={busy || !plan.affordable}
        onClick={(ev) => {
          sfx.stamp()
          haptic.heavy()
          useFx.getState().burstAt(ev.currentTarget, 'coins')
          void upgrade()
        }}
        className={`btn min-h-12 shrink-0 px-4 text-[14px] ${plan.affordable ? 'btn-gold animate-glow' : 'btn-line'}`}
        data-testid="upgrade"
      >
        {step.kind === 'move' ? '이사하기' : '넓히기'}
      </button>
    </div>
  )
}

/** 도트 그림 끄기 (decisions.md 190번). */
function PixelToggle() {
  const shown = usePixelArt((s) => s.shown)
  const setShown = usePixelArt((s) => s.setShown)
  return (
    <button
      type="button"
      onClick={() => setShown(!shown)}
      className="mt-1 text-[12px] text-white/50 underline"
      aria-pressed={!shown}
    >
      {shown ? '그림 끄기' : '그림 켜기'}
    </button>
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
          <p className="text-[13px] text-muted">쉬는 직원이 없습니다. 공채에서 뽑으세요.</p>
          <button
            type="button"
            onClick={() => {
              sfx.tap()
              setTab('market')
            }}
            className="btn btn-blue min-h-12 text-[14px]"
          >
            공채 보러 가기
          </button>
        </div>
      )}
    </Sheet>
  )
}
