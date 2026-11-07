import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import type { Company } from '../../api/client'
import { GradeBadge, tierClass, tierOf } from './GradeCard'
import { type MergeGroup, mergeGroups, mergePlan } from './gachaRules'
import { EMPLOYEE_LADDER } from './grades'
import { titleOf } from './office'
import { useRaisingStore } from './store'

type Employee = Company['employees'][number]

/** 끌기로 치는 손가락 이동(px). 이보다 덜 움직이면 끈 것이 아니다. */
const DRAG_PX = 6
/** 재료가 바탕으로 미끄러져 겹치는 시간(ms). 끝나면 서버에 합성을 보낸다. */
const GLIDE_MS = 480
/** 합성 결과 줄이 떠 있는 시간(ms). */
const RESULT_MS = 2600

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/** 앱이 소리·진동을 붙이는 자리. 웹은 비워 둔다. */
export interface MergeEffects {
  /** 카드를 집어 들었다. */
  pick?: () => void
  /** 재료를 바탕에 놓았다(합성이 시작된다). */
  drop?: () => void
  merged?: () => void
  failed?: () => void
}

/**
 * 방금 합친 결과. 웹의 회사 화면은 직원이 들고 나면 새로 그려지므로(App의 key) 판 바깥에 둔다.
 */
interface MergeResult {
  name: string
  from: string
  to: string
  n: number
}
const useMergeResult = create<{ result: MergeResult | null }>(() => ({ result: null }))

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
  /** 재료 카드가 바탕까지 미끄러질 거리. */
  fly: Record<number, { dx: number; dy: number }>
}

/**
 * 합성 판 (decisions.md 314·316번): 같은 등급 카드를 끌어 다른 카드 위에 놓으면 바로 합친다. 놓인 카드가 바탕이 되어 한 단계 오르고, 끌어 온
 * 카드는 재료로 바탕에 미끄러져 겹친 뒤 떠난다. 판 위에 "이름 C → B" 한 줄이 잠깐 뜬다. 누르기만으로는 합치지 않는다. 앱과 웹이 같이 쓴다.
 * mergeCount가 둘보다 크면 모자란 재료는 같은 무리에서 쉬는 사람부터 채운다.
 */
export function MergeBoard({ company, effects }: { company: Company; effects?: MergeEffects }) {
  const busy = useRaisingStore((s) => s.busy)
  const groups = mergeGroups(company)
  const need = company.gacha.mergeCount
  const [drag, setDrag] = useState<Drag | null>(null)
  const [fusing, setFusing] = useState<Fusing | null>(null)
  const result = useMergeResult((s) => s.result)
  const cards = useRef(new Map<number, HTMLElement>())

  // 합성 결과 줄은 잠깐 떠 있다 사라진다.
  useEffect(() => {
    if (!result) return
    const t = setTimeout(() => useMergeResult.setState({ result: null }), RESULT_MS)
    return () => clearTimeout(t)
  }, [result])

  const resultLine = result && (
    <p key={result.n} className="merge-result" role="status" data-testid="merge-result">
      <b>{result.name}</b>
      <span className="text-muted">
        {result.from} → <b className="text-gold">{result.to}</b>
      </span>
    </p>
  )

  if (groups.length === 0) {
    return (
      <div>
        {resultLine}
        <p className="text-[13px] text-muted" data-testid="merge-empty">
          같은 등급 {need}명이 모이면 카드를 끌어 겹쳐서 한 단계 올릴 수 있습니다.
        </p>
      </div>
    )
  }

  const locked = busy || fusing !== null

  const fuse = async (group: MergeGroup, src: number, target: number) => {
    const plan = mergePlan(group, need, target)
    const mats = [src, ...plan.materials.map((m) => m.id).filter((id) => id !== src)].slice(
      0,
      need - 1,
    )
    const to = cards.current.get(target)?.getBoundingClientRect()
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
    setFusing({ grade: group.grade, base: target, fly })
    effects?.drop?.()
    await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : GLIDE_MS))
    const name = group.members.find((m) => m.id === target)?.name ?? ''
    await useRaisingStore.getState().merge(target, mats)
    setFusing(null)
    if (useRaisingStore.getState().error) {
      effects?.failed?.()
      return
    }
    const next = EMPLOYEE_LADDER[EMPLOYEE_LADDER.indexOf(group.grade) + 1]
    effects?.merged?.()
    const n = (useMergeResult.getState().result?.n ?? 0) + 1
    useMergeResult.setState({ result: { name, from: group.grade, to: next, n } })
  }

  /** 끌던 카드를 이 카드에 놓을 수 있나: 같은 무리의 다른 사람. */
  const accepts = (d: Drag, targetId: number, group: MergeGroup) =>
    targetId !== d.id && group.members.some((m) => m.id === targetId)

  const onDown = (ev: ReactPointerEvent<HTMLElement>, group: MergeGroup, m: Employee) => {
    if (locked || ev.button > 0) return
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
      over: null,
    })
  }

  const onMove = (ev: ReactPointerEvent<HTMLElement>, group: MergeGroup) => {
    if (!drag || drag.pointer !== ev.pointerId) return
    const moved = drag.moved || Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > DRAG_PX
    if (moved && !drag.moved) {
      effects?.pick?.()
    }
    const hit = document
      .elementFromPoint(ev.clientX, ev.clientY)
      ?.closest<HTMLElement>('[data-merge-card]')
    const id = hit ? Number(hit.dataset.mergeCard) : null
    const over = moved && id !== null && accepts(drag, id, group) ? id : null
    setDrag({ ...drag, x: ev.clientX, y: ev.clientY, moved, over })
  }

  const onUp = (ev: ReactPointerEvent<HTMLElement>, group: MergeGroup) => {
    if (!drag || drag.pointer !== ev.pointerId) return
    const d = drag
    setDrag(null)
    if (d.moved && d.over !== null) {
      void fuse(group, d.id, d.over)
    }
  }

  const dragged = drag?.moved
    ? groups.flatMap((g) => g.members).find((m) => m.id === drag.id)
    : undefined

  return (
    <div data-testid="merge-board">
      {resultLine}
      <p className="mb-2 text-[12px] text-muted">
        카드를 끌어 같은 등급 카드 위에 놓으면 합쳐집니다. 놓인 카드가 한 단계 오르고, 끌어 온
        카드는 회사를 떠납니다(번 돈은 오른 사람에게).
      </p>
      <ul className="grid gap-3" data-testid="merge-list">
        {groups.map((g) => {
          const next = EMPLOYEE_LADDER[EMPLOYEE_LADDER.indexOf(g.grade) + 1]
          const fuseHere = fusing?.grade === g.grade
          return (
            <li
              key={g.grade}
              className="rounded-lg border border-line-soft bg-white p-3"
              data-testid="merge-group"
              data-grade={g.grade}
            >
              <p className="text-[13px] font-semibold">
                <GradeBadge grade={g.grade} size="inline" />
                {g.grade} {need}명 → <GradeBadge grade={next} size="inline" />
                {next} 1명
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {g.members.map((m) => {
                  const canTake = drag?.moved && drag.grade === g.grade && accepts(drag, m.id, g)
                  const fly = fuseHere ? fusing.fly[m.id] : undefined
                  const cls = [
                    'merge-card',
                    drag?.moved && drag.id === m.id && 'is-dragged',
                    canTake && 'can-take',
                    drag?.over === m.id && 'is-over',
                    fuseHere && fusing.base === m.id && 'is-charging',
                    fly && 'is-flying',
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
                      aria-label={`${m.name} ${g.grade}`}
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
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
      {dragged &&
        drag &&
        createPortal(
          <div
            className={`merge-ghost ${drag.over !== null ? 'is-over' : ''}`}
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
