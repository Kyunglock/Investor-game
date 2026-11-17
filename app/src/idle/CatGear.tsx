import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
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
import { DEFAULT_WEAPON, heroOf, type Weapon } from '../mental/hero'
import { CatPortrait as Portrait } from './CatPortrait'
import { useLoadoutDrag } from './useLoadoutDrag'

/**
 * 장비 목록 (decisions.md 530번): 고양이 탭에서 고른 고양이(또는 사장냥)가 들 무기를 고른다. 짧게 누르면 비교하고, 집어서 끌어 같은 무기
 * 위에 놓으면 합쳐진다. 출전 칸에 놓으면 장착한다. 남이 든 것은 `장착 중`과 든 이만 보이고 고를 수 없다. 서버도 같은 규칙이다(IdleEngine.equipCat·requireFreeForMerge).
 */
export function CatGear({
  company,
  wearer,
  onSelect,
}: {
  company: Company
  onSelect?: (code: CatCode | null) => void
  /** 장비를 고르는 고양이. null이면 사장냥이다. */
  wearer: { code: CatCode; name: string } | null
}) {
  const error = useRaisingStore((s) => s.error)
  const [notice, setNotice] = useState('')
  const busy = useRaisingStore((s) => s.busy)
  const [merged, setMerged] = useState<{ id: number; weapon: Weapon } | null>(null)
  const [manual, setManual] = useState(false)
  const [picked, setPicked] = useState<Weapon | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
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

  const equip = async (w: Weapon, code: CatCode | null = wearer?.code ?? null) => {
    if (useRaisingStore.getState().busy) return
    const store = useRaisingStore.getState()
    await (code
      ? store.equipCat(code, { kind: w.kind, grade: w.grade })
      : store.equipWeapon(w.kind, w.grade))
    if (mounted.current && !useRaisingStore.getState().error) {
      sfx.tap()
      haptic.light()
      setNotice(
        `${code ? company.idle?.cats.find((c) => c.code === code)?.name : BOSS_NAME} 장착 완료`,
      )
      onSelect?.(code)
      setPicked(null)
    }
  }
  const merge = async (w: Weapon) => {
    if (useRaisingStore.getState().busy || mergeBlock(company, w) !== null) return
    sfx.levelUp()
    haptic.medium()
    await useRaisingStore.getState().mergeWeapon(w.kind, w.grade as MergeGrade)
    const state = useRaisingStore.getState()
    const up = nextGrade(w.grade)
    const made = state.company?.weapons?.find((x) => x.grade === up && x.kind === w.kind)
    if (mounted.current && !state.error && made) setMerged({ id: Date.now(), weapon: made })
  }

  const acceptsTarget = (cell: GearCell, target: string) => {
    if (busy || cell.holder || !cells.some((c) => c.key === cell.key && !c.holder)) return false
    if (target.startsWith('wearer:')) {
      const code = target.slice(7)
      return (
        code === 'boss' || Boolean(company.idle?.cats.some((c) => c.code === code && c.level > 0))
      )
    }
    const to = cells.find((c) => `gear:${c.key}` === target)
    return Boolean(to && accepts(cell, to))
  }
  const { drag, down, consumeClick } = useLoadoutDrag<GearCell>(acceptsTarget, (cell, target) => {
    if (target.startsWith('wearer:')) {
      const code = target.slice(7)
      void equip(cell.weapon, code === 'boss' ? null : (code as CatCode))
    } else void merge(cell.weapon)
  })
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('[data-loadout-target^="wearer:"]')
    for (const target of targets) {
      target.classList.toggle(
        'is-drop-ready',
        Boolean(drag && acceptsTarget(drag.item, target.dataset.loadoutTarget ?? '')),
      )
      target.classList.toggle(
        'is-drop-over',
        Boolean(drag && drag.over === target.dataset.loadoutTarget),
      )
    }
    return () => {
      for (const target of targets) target.classList.remove('is-drop-ready', 'is-drop-over')
    }
  })
  const currentCat = company.idle?.cats.find((c) => c.code === wearer?.code)
  const currentWeapon = wearer
    ? (company.weapons?.find(
        (w) => w.kind === currentCat?.weapon?.kind && w.grade === currentCat.weapon.grade,
      ) ?? DEFAULT_WEAPON)
    : heroOf(company).weapon
  const hoveredCode = drag?.over?.startsWith('wearer:') ? drag.over.slice(7) : null
  const hoveredName =
    hoveredCode === 'boss'
      ? BOSS_NAME
      : company.idle?.cats.find((c) => c.code === hoveredCode)?.name
  const block = drag ? mergeBlock(company, drag.item.weapon) : null
  const hint = drag
    ? hoveredName
      ? `${hoveredName}에게 ${drag.item.weapon.name} ${drag.item.weapon.gradeName} 장착`
      : block === 'top'
        ? '가장 높은 등급이라 더 합칠 수 없어요'
        : block === 'short'
          ? `아무도 안 든 같은 무기가 ${need}개 있어야 합쳐져요`
          : `같은 무기 위에 놓으면 ${nextGrade(drag.item.weapon.grade)} 등급이 돼요`
    : need > 0
      ? `눌러 비교 · 집어서 끌어 고양이에 장착 · 같은 무기에 합성 (${need}개)`
      : '눌러 비교 · 집어서 끌어 고양이에게 장착'
  const merges = mergeable(company)
  return (
    <div
      className="idle-gear"
      data-testid="cat-gear"
      data-dragging={drag ? drag.item.key : undefined}
    >
      <p className="idle-gear-hint" aria-live="polite" data-testid="gear-hint">
        {hint}
      </p>
      <ul
        className={`idle-gear-grid ${drag ? 'is-dragging' : ''}`}
        aria-label={`${wearer?.name ?? BOSS_NAME} 장비`}
      >
        {cells.map((cell) => {
          const w = cell.weapon
          const held = mine(cell)
          const taken = cell.holder !== null && !held
          const target = drag ? accepts(drag.item, cell) : false
          const state = drag
            ? drag.item.key === cell.key
              ? 'is-source'
              : target
                ? drag.over === `gear:${cell.key}`
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
                data-loadout-target={`gear:${cell.key}`}
                data-kind={w.kind}
                data-grade={w.grade}
                data-holder={cell.holder ? (cell.holder.code ?? 'boss') : undefined}
                data-target={target || undefined}
                aria-pressed={held}
                aria-label={
                  cell.holder
                    ? `${w.name} ${w.gradeName} · ${cell.holder.name} 장착 중`
                    : `${w.name} ${w.gradeName} ${cell.stack}개 · 눌러서 비교`
                }
                disabled={taken || (busy && !held)}
                onClick={(event) => {
                  if (consumeClick(event.detail)) return
                  if (!held) setPicked(w)
                }}
                onPointerDown={cell.holder || busy ? undefined : down(cell)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <GunSprite kind={w.kind} grade={w.grade} width={40} className="idle-gear-art" />
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
      {picked && (
        <div className="loadout-compare" data-testid="gear-compare">
          <span>
            {picked.name} {picked.gradeName} · 공격 배율 ×{currentWeapon.damagePercent / 100} → ×
            {picked.damagePercent / 100}
          </span>
          <button
            type="button"
            disabled={
              busy ||
              !cells.some(
                (c) =>
                  !c.holder && c.weapon.kind === picked.kind && c.weapon.grade === picked.grade,
              )
            }
            onClick={() => void equip(picked)}
            data-testid="gear-equip"
          >
            {wearer?.name ?? BOSS_NAME}에게 장착
          </button>
          <button type="button" onClick={() => setPicked(null)}>
            취소
          </button>
        </div>
      )}
      <p className="loadout-hint" role="status">
        {notice}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="idle-gear-foot">
        {/* 사장냥의 무기도 뺄 수 있다 (585번). */}
        {cells.some(mine) && (
          <button
            type="button"
            className="idle-gear-off"
            data-testid="cat-unequip"
            disabled={busy}
            onClick={() => {
              sfx.tap()
              const store = useRaisingStore.getState()
              void (wearer ? store.equipCat(wearer.code, null) : store.unequipWeapon())
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
            <GunSprite kind={drag.item.weapon.kind} grade={drag.item.weapon.grade} width={56} />
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
