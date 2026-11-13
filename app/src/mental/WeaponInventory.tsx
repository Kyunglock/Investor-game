import type { Company } from '@web/api/client'
import { GUN_GRADES } from '@web/features/game/cat/draw'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { GunSprite } from './GunSprite'
import { DEFAULT_WEAPON, type Weapon } from './hero'
import { type DrawResult, WeaponReveal } from './WeaponReveal'
import { FIRE_STYLE_NAMES, SHOT_WEIGHT, WEAPON_EFFECTS } from './weaponEffects'
import './weapons.css'

type Armory = NonNullable<Company['armory']>

/** 합칠 수 있는 등급: 가장 높은 등급(LR)은 못 합친다 (366번). */
type MergeGrade = Exclude<Weapon['grade'], 'LR'>

/** 무기 등급 배지 색 (346번). */
export const GRADE_BADGE: Record<Weapon['grade'], string> = {
  F: 'bg-slate-200 text-slate-700',
  E: 'bg-emerald-100 text-emerald-800',
  D: 'bg-sky-100 text-sky-800',
  C: 'bg-violet-100 text-violet-800',
  B: 'bg-fuchsia-100 text-fuchsia-800',
  A: 'bg-orange-100 text-orange-800',
  S: 'bg-cyan-100 text-cyan-900',
  SS: 'bg-blue-100 text-blue-900',
  SSS: 'bg-purple-100 text-purple-900',
  SR: 'bg-rose-100 text-rose-900',
  UR: 'bg-lime-100 text-lime-900',
  LR: 'bg-yellow-100 text-yellow-900',
}

/** 인벤토리 한 쪽의 칸 수: 8칸 × 5줄 (493번). */
const SLOTS = 40

/** 인벤토리 메뉴의 배지: 쓸 수 있는 무기 뽑기권 수. */
export function weaponBadge(company: Company): string | null {
  const tickets = company.armory?.tickets ?? 0
  return tickets > 0 ? String(tickets) : null
}

/**
 * 무기 인벤토리 (#564, decisions.md 346·366번): 메인의 무기 메뉴에서 연다. 스테이지 출전 화면에서 하던 무기 장착·뽑기·합성을 여기로 옮겼다.
 * 든 무기를 위에 크게 보이고, 아래에 가진 무기를 등급 높은 순으로 늘어놓는다. 누르면 들고, 같은 무기가 mergeCount개면 합쳐 한 등급 올린다.
 */
export function WeaponInventory({ company }: { company: Company }) {
  const [page, setPage] = useState(0)
  const [picked, setPicked] = useState<{ kind: Weapon['kind']; grade: Weapon['grade'] } | null>(
    null,
  )
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const [reveal, setReveal] = useState<{ id: number; result: DrawResult | null } | null>(null)
  const [dropped, setDropped] = useState<string | null>(null)
  const drawing = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const draw = async () => {
    if (
      drawing.current ||
      useRaisingStore.getState().busy ||
      ended ||
      !armory ||
      armory.tickets <= 0
    )
      return
    drawing.current = true
    const id = Date.now()
    setReveal({ id, result: null })
    sfx.stamp()
    try {
      await useRaisingStore.getState().drawWeapon()
      const state = useRaisingStore.getState()
      const last = state.company?.armory?.lastDraw
      const weapon = state.company?.weapons?.find(
        (w) => w.kind === last?.kind && w.grade === last.grade,
      )
      if (mounted.current)
        setReveal(!state.error && last && weapon ? { id, result: { draw: last, weapon } } : null)
    } catch {
      if (mounted.current) setReveal(null)
    } finally {
      drawing.current = false
    }
  }
  const armory: Armory | null = company.armory ?? null
  const weapons = company.weapons?.length ? company.weapons : [DEFAULT_WEAPON]
  const equipped = weapons.find((w) => w.equipped) ?? weapons[0]
  const sorted = [...weapons].sort(
    (a, b) =>
      GUN_GRADES.indexOf(b.grade) - GUN_GRADES.indexOf(a.grade) || a.kind.localeCompare(b.kind),
  )
  const pageCount = Math.max(1, Math.ceil(sorted.length / SLOTS))
  const currentPage = Math.min(page, pageCount - 1)
  const slots = Array.from({ length: SLOTS }, (_, i) => ({
    id: `slot-${i}`,
    weapon: sorted[currentPage * SLOTS + i] ?? null,
  }))
  // 칸이 작아 칸에는 그림·등급·수만 있다: 고른 무기(처음엔 든 무기)의 정보와 장착·합성은 위 칸에서 한다 (493번).
  const shown = weapons.find((w) => w.kind === picked?.kind && w.grade === picked.grade) ?? equipped
  const ended = company.status === 'ENDED'
  // 고양이가 빌려 든 무기 (488번): 칸에 든 고양이 이름을 보인다. 사장냥이 들면 고양이는 내려놓는다.
  const holdersOf = (w: Weapon) =>
    company.idle?.cats.filter(
      (cat) => cat.weapon?.kind === w.kind && cat.weapon.grade === w.grade,
    ) ?? []
  // 사장냥이 들거나 합성해 수가 모자라면 고양이가 무기를 내려놓는다: 말없이 풀리지 않게 알린다 (492번).
  const change = async (action: () => Promise<void>) => {
    const armed = company.idle?.cats.filter((cat) => cat.weapon) ?? []
    setDropped(null)
    await action()
    const now = useRaisingStore.getState().company?.idle?.cats ?? []
    const names = armed
      .filter((cat) => !now.find((c) => c.code === cat.code)?.weapon)
      .map((cat) => cat.name)
    if (mounted.current && names.length > 0) setDropped(`${names.join('·')}: 무기를 내려놓았어요`)
  }
  return (
    <div className="weapon-inventory" data-testid="weapon-picker">
      <section
        className="weapon-equipped"
        data-testid="weapon-equipped"
        data-kind={shown.kind}
        data-grade={shown.grade}
      >
        <GunSprite kind={shown.kind} grade={shown.grade} width={96} />
        <div className="min-w-0">
          <p className="text-[11px] text-muted">
            {shown.equipped
              ? '지금 든 무기'
              : `고른 무기 · ×${shown.count}${holdersOf(shown)[0] ? ` · ${holdersOf(shown)[0].name} 장착` : ''}`}
          </p>
          <p className="font-game text-[19px]">
            {shown.name}{' '}
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${GRADE_BADGE[shown.grade]}`}
            >
              {shown.gradeName}
            </span>
          </p>
          <p className="text-[12px] text-muted">
            공격 ×{(shown.damagePercent / 100) * SHOT_WEIGHT} ·{' '}
            {(1000 / shown.fireMs / SHOT_WEIGHT).toFixed(1)}발/초
          </p>
          <p className="weapon-tag">
            {FIRE_STYLE_NAMES[shown.kind]} · {WEAPON_EFFECTS[shown.kind].name}
          </p>
          <p className="weapon-effect">{WEAPON_EFFECTS[shown.kind].desc}</p>
          <div className="weapon-actions">
            <button
              type="button"
              className="weapon-equip"
              data-testid="weapon-equip"
              disabled={busy || ended || shown.equipped}
              onClick={() => {
                sfx.tap()
                haptic.light()
                void change(() => useRaisingStore.getState().equipWeapon(shown.kind, shown.grade))
              }}
            >
              {shown.equipped ? '장착 중' : '장착'}
            </button>
            {armory && shown.grade !== 'LR' && shown.count >= armory.mergeCount && (
              <button
                type="button"
                className="weapon-merge"
                data-testid="weapon-merge"
                disabled={busy || ended}
                onClick={() => {
                  sfx.levelUp()
                  haptic.medium()
                  void change(() =>
                    useRaisingStore.getState().mergeWeapon(shown.kind, shown.grade as MergeGrade),
                  )
                }}
              >
                {armory.mergeCount}개 합성
                {shown.count - armory.mergeCount <
                  (shown.equipped ? 1 : 0) + holdersOf(shown).length &&
                  holdersOf(shown).length > 0 && <small> · 고양이 장비 풀림</small>}
              </button>
            )}
          </div>
        </div>
      </section>
      <div className="weapon-draw-row">
        <p className="font-game text-[15px]">
          뽑기권 <b data-testid="weapon-tickets">{armory?.tickets ?? 0}</b>장
        </p>
        <button
          type="button"
          className="weapon-draw"
          data-testid="weapon-draw"
          disabled={busy || Boolean(reveal) || ended || !armory || armory.tickets <= 0}
          onClick={() => void draw()}
        >
          무기 뽑기
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">뽑기 F~A · S 이상은 합성으로 획득 · 최고 LR</p>
      {reveal && (
        <WeaponReveal
          key={reveal.id}
          result={reveal.result}
          tickets={armory?.tickets ?? 0}
          onClose={() => setReveal(null)}
          onAgain={() => void draw()}
        />
      )}
      <p className="mt-3 text-[12px] text-muted">
        가진 무기 {weapons.length}종 · 눌러서 고르기
        {armory ? ` · 같은 무기 ${armory.mergeCount}개면 합성` : ''}
      </p>
      <ul className="weapon-grid" aria-label="무기 인벤토리 · 8칸 5줄">
        {slots.map(({ id, weapon: w }) =>
          w ? (
            <li key={`${w.kind}-${w.grade}`} className="weapon-slot" data-testid="inventory-slot">
              <button
                type="button"
                aria-pressed={w.equipped}
                aria-label={`${w.name} ${w.gradeName} ${w.count}개${w.equipped ? ' 장착 중' : ''}`}
                onClick={() => {
                  sfx.tap()
                  setPicked({ kind: w.kind, grade: w.grade })
                }}
                className={`weapon-card ${w.equipped ? 'is-equipped' : ''} ${w === shown ? 'is-picked' : ''}`}
                data-testid="weapon"
                data-kind={w.kind}
                data-grade={w.grade}
              >
                <GunSprite kind={w.kind} grade={w.grade} width={34} />
                <span className={`weapon-slot-grade ${GRADE_BADGE[w.grade]}`}>{w.gradeName}</span>
                {w.count > 1 && <span className="weapon-slot-count">×{w.count}</span>}
                {holdersOf(w).length > 0 && <span className="weapon-slot-cat" aria-hidden="true" />}
              </button>
            </li>
          ) : (
            <li
              key={id}
              className="weapon-slot weapon-slot-empty"
              data-testid="inventory-slot"
              aria-label="빈 슬롯"
            />
          ),
        )}
      </ul>
      {pageCount > 1 && (
        <nav className="weapon-pages" aria-label="인벤토리 페이지">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            aria-label="이전 무기 페이지"
          >
            ‹
          </button>
          <span aria-live="polite">
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage + 1 >= pageCount}
            onClick={() => setPage(currentPage + 1)}
            aria-label="다음 무기 페이지"
          >
            ›
          </button>
        </nav>
      )}
      {dropped && (
        <p role="status" className="mt-2 text-[12px] text-muted" data-testid="weapon-dropped">
          {dropped}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-red-pen">
          {error}
        </p>
      )}
    </div>
  )
}
