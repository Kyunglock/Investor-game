import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import {
  BOSS_NAME,
  type GearCell,
  GRADE_BADGE,
  gearCells,
  type MergeGrade,
  mergeable,
  mergeBlock,
  nextGrade,
} from '../mental/armory'
import { GunSprite } from '../mental/GunSprite'
import type { Weapon } from '../mental/hero'
import { CatPortrait as Portrait } from './CatPortrait'

/** 이만큼 누르고 있으면 끌기가 시작된다(ms). 그 전에 떼면 장착이다. */
const HOLD_MS = 280
/** 누른 채 이만큼 움직이면(px) 터치는 목록을 넘기는 것이고, 마우스는 끌기다. */
const SLOP = 8

interface Drag {
  cell: GearCell
  x: number
  y: number
  /** 지금 손가락 아래의 합칠 수 있는 칸. */
  over: string | null
}

/**
 * 장비 목록 (decisions.md 530번): 고양이 탭에서 고른 고양이(또는 사장냥)가 들 무기를 고른다. 짧게 누르면 장착이고, 길게 눌러 끌어 같은 무기
 * 위에 놓으면 합쳐진다. 남이 든 것은 `장착 중`과 든 이만 보이고 고를 수 없다. 서버도 같은 규칙이다(IdleEngine.equipCat·requireFreeForMerge).
 */
export function CatGear({
  company,
  wearer,
}: {
  company: Company
  /** 장비를 고르는 고양이. null이면 사장냥이다. */
  wearer: { code: CatCode; name: string } | null
}) {
  const busy = useRaisingStore((s) => s.busy)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [merged, setMerged] = useState<{ id: number; weapon: Weapon } | null>(null)
  const [manual, setManual] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  /** 누르고 있는 손가락: 끌기가 시작되기 전에는 timer가, 시작된 뒤에는 active가 켜진다. */
  const press = useRef<{
    id: number
    cell: GearCell
    x: number
    y: number
    timer: number
    active: boolean
  } | null>(null)
  /** 끌고 난 뒤의 click은 장착으로 치지 않는다. */
  const dragged = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (press.current) clearTimeout(press.current.timer)
    }
  }, [])
  // 끄는 동안에는 목록이 넘어가지 않게 한다: touch-action은 누른 뒤에 바꿀 수 없어 touchmove를 막는다.
  useEffect(() => {
    const el = list.current
    if (!el) return
    const stop = (e: TouchEvent) => {
      if (press.current?.active) e.preventDefault()
    }
    el.addEventListener('touchmove', stop, { passive: false })
    return () => el.removeEventListener('touchmove', stop)
  }, [])
  useEffect(() => {
    if (!merged) return
    const timer = setTimeout(() => setMerged(null), 2200)
    return () => clearTimeout(timer)
  }, [merged])

  const cells = gearCells(company)
  const need = company.armory?.mergeCount ?? 0
  const mine = (cell: GearCell) =>
    cell.holder !== null && cell.holder.code === (wearer?.code ?? null)
  /** 끌던 칸을 놓으면 합쳐지는 칸: 아무도 들지 않은 같은 무기의 다른 칸이고, 그 무기가 합칠 수만큼 남아 있다. */
  const accepts = (from: GearCell, to: GearCell) =>
    to.key !== from.key &&
    to.holder === null &&
    to.weapon.kind === from.weapon.kind &&
    to.weapon.grade === from.weapon.grade &&
    mergeBlock(company, from.weapon) === null

  const equip = (w: Weapon) => {
    sfx.tap()
    haptic.light()
    const store = useRaisingStore.getState()
    void (wearer
      ? store.equipCat(wearer.code, { kind: w.kind, grade: w.grade })
      : store.equipWeapon(w.kind, w.grade))
  }
  const merge = async (w: Weapon) => {
    if (useRaisingStore.getState().busy || mergeBlock(company, w) !== null) return
    sfx.levelUp()
    haptic.medium()
    await useRaisingStore.getState().mergeWeapon(w.kind, w.grade as MergeGrade)
    const state = useRaisingStore.getState()
    const up = nextGrade(w.grade)
    const made = state.company?.weapons?.find((x) => x.grade === up)
    if (mounted.current && !state.error && made) setMerged({ id: Date.now(), weapon: made })
  }

  const cellAt = (from: GearCell, x: number, y: number) => {
    const key = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('[data-gear-cell]')
      ?.getAttribute('data-gear-cell')
    const to = cells.find((c) => c.key === key)
    return to && accepts(from, to) ? to.key : null
  }
  const begin = (el: HTMLElement) => {
    const p = press.current
    if (!p || p.active) return
    clearTimeout(p.timer)
    p.active = true
    // 손가락이 칸 밖으로 나가도 이 칸이 계속 움직임을 받는다.
    if (el.isConnected) el.setPointerCapture?.(p.id)
    haptic.light()
    setDrag({ cell: p.cell, x: p.x, y: p.y, over: null })
  }
  const end = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
    setDrag(null)
  }
  const down = (cell: GearCell) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || busy || press.current) return
    const el = e.currentTarget
    dragged.current = false
    press.current = {
      id: e.pointerId,
      cell,
      x: e.clientX,
      y: e.clientY,
      active: false,
      timer: window.setTimeout(() => begin(el), HOLD_MS),
    }
  }
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    if (!p.active) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < SLOP) return
      // 마우스는 넘길 목록이 없으니 움직이면 바로 끈다. 터치는 목록을 넘기는 손짓이다.
      if (e.pointerType !== 'mouse') return end()
      begin(e.currentTarget)
    }
    p.x = e.clientX
    p.y = e.clientY
    setDrag({ cell: p.cell, x: p.x, y: p.y, over: cellAt(p.cell, p.x, p.y) })
  }
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    if (p.active) {
      dragged.current = true
      if (cellAt(p.cell, e.clientX, e.clientY)) void merge(p.cell.weapon)
    }
    end()
  }

  const block = drag ? mergeBlock(company, drag.cell.weapon) : null
  const hint = drag
    ? block === 'top'
      ? '가장 높은 등급이라 더 합칠 수 없어요'
      : block === 'short'
        ? `아무도 안 든 같은 무기가 ${need}개 있어야 합쳐져요`
        : `같은 무기 위에 놓으면 ${nextGrade(drag.cell.weapon.grade)} 등급이 돼요`
    : need > 0
      ? `누르면 장착 · 길게 눌러 같은 무기 위로 끌면 합쳐져요 (${need}개)`
      : '누르면 장착해요'
  const merges = mergeable(company)
  return (
    <div
      className="idle-gear"
      data-testid="cat-gear"
      data-dragging={drag ? drag.cell.key : undefined}
    >
      <p className="idle-gear-hint" aria-live="polite" data-testid="gear-hint">
        {hint}
      </p>
      <ul
        ref={list}
        className={`idle-gear-grid ${drag ? 'is-dragging' : ''}`}
        aria-label={`${wearer?.name ?? BOSS_NAME} 장비`}
      >
        {cells.map((cell) => {
          const w = cell.weapon
          const held = mine(cell)
          const taken = cell.holder !== null && !held
          const target = drag ? accepts(drag.cell, cell) : false
          const state = drag
            ? drag.cell.key === cell.key
              ? 'is-source'
              : target
                ? drag.over === cell.key
                  ? 'is-target is-over'
                  : 'is-target'
                : 'is-off'
            : ''
          return (
            <li key={cell.key}>
              <button
                type="button"
                className={`idle-gear-cell ${state}`}
                data-testid="cat-weapon"
                data-gear-cell={cell.key}
                data-kind={w.kind}
                data-grade={w.grade}
                data-holder={cell.holder ? (cell.holder.code ?? 'boss') : undefined}
                data-target={target || undefined}
                aria-pressed={held}
                aria-label={
                  cell.holder
                    ? `${w.name} ${w.gradeName} · ${cell.holder.name} 장착 중`
                    : `${w.name} ${w.gradeName} ${cell.stack}개 · 눌러서 장착`
                }
                disabled={taken || (busy && !held)}
                onClick={() => {
                  if (dragged.current) {
                    dragged.current = false
                    return
                  }
                  if (!held) equip(w)
                }}
                // 든 무기는 끌 수 없다: 장착 중인 것은 합치기에 쓰지 않는다.
                onPointerDown={cell.holder ? undefined : down(cell)}
                onPointerMove={cell.holder ? undefined : move}
                onPointerUp={cell.holder ? undefined : up}
                onPointerCancel={cell.holder ? undefined : end}
                onContextMenu={(e) => e.preventDefault()}
              >
                <GunSprite kind={w.kind} grade={w.grade} width={46} className="idle-gear-art" />
                <i className={`idle-grade idle-gear-grade ${GRADE_BADGE[w.grade]}`}>
                  {w.gradeName}
                </i>
                {cell.stack > 1 && <em className="idle-gear-count">×{cell.stack}</em>}
                {cell.holder && (
                  <span className="idle-gear-holder">
                    <Portrait code={cell.holder.code ?? undefined} />
                  </span>
                )}
                <small className="idle-gear-name">
                  {cell.holder && <b className="idle-gear-held">장착 중</b>}
                  {cell.holder ? cell.holder.name : w.name}
                </small>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="idle-gear-foot">
        {wearer && cells.some(mine) && (
          <button
            type="button"
            className="idle-gear-off"
            data-testid="cat-unequip"
            disabled={busy}
            onClick={() => {
              sfx.tap()
              void useRaisingStore.getState().equipCat(wearer.code, null)
            }}
          >
            무기 빼기 <small className="idle-gear-off-note">기본 권총을 쏴요</small>
          </button>
        )}
        {/* 끌기 어려울 때 (530번): 합칠 수 있는 무기를 단추로 합친다. */}
        {merges.length > 0 && (
          <button
            type="button"
            className="idle-gear-manual"
            aria-expanded={manual}
            data-testid="gear-manual"
            onClick={() => setManual(!manual)}
          >
            끌지 않고 합치기 {manual ? '▴' : '▾'}
          </button>
        )}
      </div>
      {manual && merges.length > 0 && (
        <ul className="idle-gear-merges" aria-label="합칠 수 있는 무기">
          {merges.map((w) => (
            <li key={`${w.kind}-${w.grade}`}>
              <button
                type="button"
                className="idle-gear-merge"
                data-testid="gear-merge"
                data-grade={w.grade}
                disabled={busy}
                onClick={() => void merge(w)}
              >
                {w.name} {w.gradeName} {need}개 → {nextGrade(w.grade)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {drag &&
        createPortal(
          <div
            className="idle-gear-ghost"
            style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
            aria-hidden="true"
          >
            <GunSprite kind={drag.cell.weapon.kind} grade={drag.cell.weapon.grade} width={56} />
          </div>,
          document.body,
        )}
      {merged &&
        createPortal(
          <div
            className="idle-merge-result"
            role="status"
            data-testid="merge-result"
            data-grade={merged.weapon.grade}
            key={merged.id}
          >
            <b className="idle-merge-title">합치기 성공!</b>
            <GunSprite kind={merged.weapon.kind} grade={merged.weapon.grade} width={96} />
            <span>
              {merged.weapon.name}{' '}
              <i className={`idle-grade ${GRADE_BADGE[merged.weapon.grade]}`}>
                {merged.weapon.gradeName}
              </i>
            </span>
          </div>,
          document.body,
        )}
    </div>
  )
}
