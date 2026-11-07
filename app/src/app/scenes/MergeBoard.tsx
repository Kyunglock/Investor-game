import type { Company } from '@web/api/client'
import { GradeBadge, tierClass, tierOf } from '@web/features/raising/GradeCard'
import { type MergeGroup, mergeGroups, mergePlan } from '@web/features/raising/gachaRules'
import { EMPLOYEE_LADDER } from '@web/features/raising/grades'
import { titleOf } from '@web/features/raising/office'
import { useRaisingStore } from '@web/features/raising/store'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'

type Employee = Company['employees'][number]

/** 끌기로 치는 손가락 이동(px). 이보다 덜 움직이면 누른 것이다. */
const DRAG_PX = 6
/** 재료가 바탕으로 빨려 들어가며 모이는 시간(ms). 끝나면 서버에 합성을 보낸다. */
const CHARGE_MS = 750

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/** 한 무리에 올려 둔 것: 바탕(★)과 그 위에 놓인 재료. */
interface Load {
  base: number
  mats: number[]
}

interface Drag {
  id: number
  grade: Company['grade']
  pointer: number
  sx: number
  sy: number
  x: number
  y: number
  moved: boolean
  over: number | null
}

interface Fusing {
  grade: Company['grade']
  base: number
  mats: number[]
  /** 재료 카드가 바탕까지 날아갈 거리. */
  fly: Record<number, { dx: number; dy: number }>
}

/**
 * 앱의 합성 판 (decisions.md 314번): 같은 등급 카드를 끌어 다른 카드 위에 놓는다. 놓인 카드가 바탕(★)이 되고 끌어 온 카드는 재료로 올라간다. 재료가
 * mergeCount−1장 차면 재료가 바탕으로 빨려 들어가며 바탕이 떨고 빛을 모은 뒤 합성되고, 번쩍임·색종이·흔들림·팡파르·떠오르는 "승급!"이 터진다.
 * 올린 재료를 누르면 내려오고, 바탕을 누르면 모두 내려온다. 끌기가 어려우면 "알아서 합성"(웹과 같은 바탕·재료 고르기).
 */
export function MergeBoard({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const groups = mergeGroups(company)
  const need = company.gacha.mergeCount
  const [loads, setLoads] = useState<Record<string, Load>>({})
  const [drag, setDrag] = useState<Drag | null>(null)
  const [fusing, setFusing] = useState<Fusing | null>(null)
  const [bump, setBump] = useState<{ id: number; n: number } | null>(null)
  const cards = useRef(new Map<number, HTMLElement>())

  // 회사가 바뀌어 무리에서 빠진 사람은 올려 둔 것에서도 내린다.
  const memberIds = groups.flatMap((g) => g.members.map((m) => m.id)).join(',')
  useEffect(() => {
    const alive = new Set(memberIds.split(',').filter(Boolean).map(Number))
    setLoads((all) => {
      const next: Record<string, Load> = {}
      for (const [grade, l] of Object.entries(all)) {
        if (alive.has(l.base)) {
          next[grade] = { base: l.base, mats: l.mats.filter((id) => alive.has(id)) }
        }
      }
      return next
    })
  }, [memberIds])

  if (groups.length === 0) {
    return (
      <p className="text-[13px] text-muted" data-testid="merge-empty">
        같은 등급 {need}명이 모이면 끌어다 겹쳐서 한 단계 올릴 수 있습니다.
      </p>
    )
  }

  const locked = busy || fusing !== null

  /** 끌던 카드를 이 카드에 놓을 수 있나: 같은 무리, 자기 자신·재료가 아님, 바탕이 있으면 바탕에만. */
  const accepts = (d: Drag, targetId: number, group: MergeGroup) => {
    if (targetId === d.id || !group.members.some((m) => m.id === targetId)) return false
    const l = loads[group.grade]
    if (!l) return true
    if (l.mats.includes(targetId)) return false
    return l.base === targetId
  }

  const fuse = async (group: MergeGroup, base: number, mats: number[]) => {
    const baseEl = cards.current.get(base)
    const to = baseEl?.getBoundingClientRect()
    const fly: Fusing['fly'] = {}
    for (const id of mats) {
      const from = cards.current.get(id)?.getBoundingClientRect()
      if (from && to) {
        fly[id] = {
          dx: to.left + to.width / 2 - (from.left + from.width / 2),
          dy: to.top + to.height / 2 - (from.top + from.height / 2),
        }
      }
    }
    setFusing({ grade: group.grade, base, mats, fly })
    sfx.charge()
    haptic.medium()
    await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : CHARGE_MS))
    // 합성 뒤에는 바탕 카드가 다른 무리로 옮겨 가므로, 터질 자리는 미리 잡아 둔다.
    const at = baseEl?.getBoundingClientRect() ?? to
    await useRaisingStore.getState().merge(base, mats)
    setFusing(null)
    setLoads(({ [group.grade]: _, ...rest }) => rest)
    const fx = useFx.getState()
    // 떠오르는 글이 화면 밖으로 잘리지 않게 가장자리에서 띄운다.
    const x = Math.min(
      Math.max(at ? at.left + at.width / 2 : window.innerWidth / 2, 80),
      window.innerWidth - 80,
    )
    const y = at ? at.top + at.height / 2 : window.innerHeight / 2
    if (useRaisingStore.getState().error) {
      sfx.thud()
      haptic.error()
      fx.burst(x, y, 'smoke')
      return
    }
    const next = EMPLOYEE_LADDER[EMPLOYEE_LADDER.indexOf(group.grade) + 1]
    sfx.levelUp()
    haptic.success()
    fx.flashScreen('rgba(245,211,107,0.45)')
    fx.shakeScreen()
    fx.burst(x, y, 'sparks')
    fx.burst(x, y, 'confetti')
    fx.float(x, y - 20, `${next} 승급!`, 'gold')
  }

  const drop = (group: MergeGroup, src: number, target: number) => {
    const l = loads[group.grade] ?? { base: target, mats: [] }
    const mats = [...l.mats, src]
    setLoads((all) => ({ ...all, [group.grade]: { base: l.base, mats } }))
    setBump({ id: target, n: (bump?.n ?? 0) + 1 })
    const fx = useFx.getState()
    fx.burstAt(cards.current.get(target), 'sparks')
    if (mats.length >= need - 1) {
      void fuse(group, l.base, mats)
      return
    }
    sfx.absorb(mats.length)
    haptic.light()
    fx.floatAt(cards.current.get(target), `${mats.length + 1}/${need}`, 'gold')
  }

  const tap = (group: MergeGroup, id: number) => {
    const l = loads[group.grade]
    if (!l) return
    sfx.tap()
    if (id === l.base) {
      setLoads(({ [group.grade]: _, ...rest }) => rest)
    } else if (l.mats.includes(id)) {
      setLoads((all) => ({
        ...all,
        [group.grade]: { base: l.base, mats: l.mats.filter((m) => m !== id) },
      }))
    }
  }

  const onDown = (ev: ReactPointerEvent<HTMLElement>, group: MergeGroup, m: Employee) => {
    if (locked || ev.button > 0) return
    const l = loads[group.grade]
    // 올려 둔 재료와, 재료를 받은 바탕은 끌지 않는다(누르면 내려온다).
    const draggable = !l || (!l.mats.includes(m.id) && !(l.base === m.id && l.mats.length > 0))
    ev.currentTarget.setPointerCapture(ev.pointerId)
    setDrag({
      id: m.id,
      grade: group.grade,
      pointer: ev.pointerId,
      sx: ev.clientX,
      sy: ev.clientY,
      x: ev.clientX,
      y: ev.clientY,
      moved: false,
      over: draggable ? null : -1,
    })
  }

  const onMove = (ev: ReactPointerEvent<HTMLElement>, group: MergeGroup) => {
    if (!drag || drag.pointer !== ev.pointerId || drag.over === -1) return
    const moved = drag.moved || Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > DRAG_PX
    if (moved && !drag.moved) {
      sfx.pick()
      haptic.light()
    }
    const hit = document
      .elementFromPoint(ev.clientX, ev.clientY)
      ?.closest<HTMLElement>('[data-merge-card]')
    const id = hit ? Number(hit.dataset.mergeCard) : null
    const over = moved && id !== null && accepts(drag, id, group) ? id : null
    if (over !== null && over !== drag.over) {
      haptic.light()
    }
    setDrag({ ...drag, x: ev.clientX, y: ev.clientY, moved, over })
  }

  const onUp = (ev: ReactPointerEvent<HTMLElement>, group: MergeGroup) => {
    if (!drag || drag.pointer !== ev.pointerId) return
    const d = drag
    setDrag(null)
    if (!d.moved) {
      tap(group, d.id)
    } else if (d.over !== null && d.over >= 0) {
      drop(group, d.id, d.over)
    }
  }

  const auto = (group: MergeGroup) => {
    const l = loads[group.grade]
    const plan = mergePlan(group, need, l?.base)
    sfx.stamp()
    void fuse(
      group,
      plan.base.id,
      plan.materials.map((m) => m.id),
    )
  }

  const dragged = drag?.moved
    ? groups.flatMap((g) => g.members).find((m) => m.id === drag.id)
    : undefined

  return (
    <div data-testid="merge-board">
      <p className="mb-2 text-[12px] text-muted">
        카드를 <b>끌어서</b> 같은 등급 카드 위에 놓으세요. 놓인 카드(★)가 오르고 끌어 온 카드는
        재료로 떠납니다(번 돈은 ★에게). 올린 카드를 누르면 내려옵니다.
      </p>
      <ul className="grid gap-3" data-testid="merge-list">
        {groups.map((g) => {
          const l = loads[g.grade]
          const next = EMPLOYEE_LADDER[EMPLOYEE_LADDER.indexOf(g.grade) + 1]
          const filled = l ? l.mats.length + 1 : 0
          const fuseHere = fusing?.grade === g.grade
          return (
            <li
              key={g.grade}
              className={`merge-group rounded-lg border bg-white p-2 ${fuseHere ? 'is-fusing border-gold' : 'border-gold/60'}`}
              data-testid="merge-group"
              data-grade={g.grade}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">
                  <GradeBadge grade={g.grade} size="inline" />
                  {g.grade} {need}명 → <GradeBadge grade={next} size="inline" />
                  {next} 1명
                </p>
                <span className="flex gap-1" role="img" aria-label={`${filled}/${need}장 올림`}>
                  {Array.from({ length: need }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: 칸 자리
                      key={i}
                      className={`merge-pip ${i < filled ? 'is-on' : ''}`}
                    />
                  ))}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {g.members.map((m) => {
                  const isBase = l?.base === m.id
                  const isMat = l?.mats.includes(m.id) ?? false
                  const isDragged = drag?.moved && drag.id === m.id
                  const isOver = drag?.over === m.id
                  const canTake =
                    drag?.moved &&
                    drag.grade === g.grade &&
                    drag.over !== -1 &&
                    accepts(drag, m.id, g)
                  const fly = fuseHere ? fusing.fly[m.id] : undefined
                  const cls = [
                    'merge-card',
                    isBase && 'is-base',
                    isMat && 'is-mat',
                    isDragged && 'is-dragged',
                    canTake && 'can-take',
                    isOver && 'is-over',
                    fuseHere && fusing.base === m.id && 'is-charging',
                    fly && 'is-flying',
                    bump?.id === m.id && `bump-${bump.n % 2}`,
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <button
                      type="button"
                      key={m.id}
                      ref={(el) => {
                        if (el) cards.current.set(m.id, el)
                        else cards.current.delete(m.id)
                      }}
                      aria-label={`${m.name} ${g.grade}${isBase ? ' 바탕' : isMat ? ' 재료' : ''}`}
                      data-merge-card={m.id}
                      data-testid="merge-card"
                      className={cls}
                      style={
                        fly
                          ? ({ '--dx': `${fly.dx}px`, '--dy': `${fly.dy}px` } as CSSProperties)
                          : undefined
                      }
                      onPointerDown={(ev) => onDown(ev, g, m)}
                      onPointerMove={(ev) => onMove(ev, g)}
                      onPointerUp={(ev) => onUp(ev, g)}
                      onPointerCancel={() => setDrag(null)}
                    >
                      <CardFace employee={m} grade={g.grade} />
                      {isBase && <span className="merge-tag bg-gold">★ 바탕</span>}
                      {isMat && <span className="merge-tag bg-ink/70">재료</span>}
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                disabled={locked}
                onClick={() => auto(g)}
                className="mt-2 min-h-10 w-full rounded border border-gold/70 text-[13px] font-semibold text-gold disabled:opacity-50"
                data-testid="merge"
              >
                알아서 합성
              </button>
            </li>
          )
        })}
      </ul>
      {dragged &&
        drag &&
        createPortal(
          <div
            className={`merge-ghost ${drag.over !== null && drag.over >= 0 ? 'is-over' : ''}`}
            style={{ left: drag.x, top: drag.y }}
            aria-hidden="true"
          >
            <CardFace employee={dragged} grade={dragged.overallGrade} />
          </div>,
          document.body,
        )}
    </div>
  )
}

function CardFace({ employee, grade }: { employee: Employee; grade: Company['grade'] }) {
  return (
    <span
      className={`grade-card ${tierClass(tierOf(grade))} flex h-full w-full flex-col items-center justify-center gap-0.5 p-1.5 text-ink`}
    >
      <span className="gem-static">
        <GradeBadge grade={grade} size="sm" />
      </span>
      <b className="text-[13px] leading-tight">{employee.name}</b>
      <span className="text-[10px] text-muted">{titleOf(grade)}</span>
      {employee.desk && <span className="text-[10px] text-muted">· 자리</span>}
    </span>
  )
}
