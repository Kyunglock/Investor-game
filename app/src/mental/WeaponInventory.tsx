import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { GunSprite } from './GunSprite'
import { DEFAULT_WEAPON, type Weapon } from './hero'
import { type DrawResult, WeaponReveal } from './WeaponReveal'
import { FIRE_STYLE_NAMES, WEAPON_EFFECTS, WEAPON_TRAITS } from './weaponEffects'
import './weapons.css'

type Armory = NonNullable<Company['armory']>

/** 합칠 수 있는 등급: 가장 높은 등급(S)은 못 합친다 (366번). */
type MergeGrade = Exclude<Weapon['grade'], 'S'>

/** 무기 등급 배지 색 (346번). */
export const GRADE_BADGE: Record<Weapon['grade'], string> = {
  F: 'bg-slate-200 text-slate-700',
  E: 'bg-emerald-100 text-emerald-800',
  D: 'bg-sky-100 text-sky-800',
  C: 'bg-violet-100 text-violet-800',
  B: 'bg-fuchsia-100 text-fuchsia-800',
  A: 'bg-orange-100 text-orange-800',
  S: 'bg-cyan-100 text-cyan-900',
}

const GRADE_ORDER: Record<Weapon['grade'], number> = { F: 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 }

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
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const [reveal, setReveal] = useState<{ id: number; result: DrawResult | null } | null>(null)
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
    (a, b) => GRADE_ORDER[b.grade] - GRADE_ORDER[a.grade] || a.kind.localeCompare(b.kind),
  )
  const ended = company.status === 'ENDED'
  return (
    <div className="weapon-inventory" data-testid="weapon-picker">
      <section className="weapon-equipped" data-testid="weapon-equipped" data-kind={equipped.kind}>
        <GunSprite kind={equipped.kind} grade={equipped.grade} width={120} />
        <div className="min-w-0">
          <p className="text-[11px] text-muted">지금 든 무기</p>
          <p className="font-game text-[19px]">
            {equipped.name}{' '}
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${GRADE_BADGE[equipped.grade]}`}
            >
              {equipped.gradeName}
            </span>
          </p>
          <p className="text-[12px] text-muted">
            공격 ×{equipped.damagePercent / 100} · {(1000 / equipped.fireMs).toFixed(1)}발/초
          </p>
          <p className="weapon-tag">
            {FIRE_STYLE_NAMES[equipped.kind]} · {WEAPON_EFFECTS[equipped.kind].name}
          </p>
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
        가진 무기 {weapons.length}종 · 눌러서 들기
        {armory ? ` · 같은 무기 ${armory.mergeCount}개면 합성` : ''}
      </p>
      <ul className="weapon-grid">
        {sorted.map((w) => (
          <li key={`${w.kind}-${w.grade}`}>
            <button
              type="button"
              disabled={busy || ended || w.equipped}
              aria-pressed={w.equipped}
              onClick={() => {
                sfx.tap()
                haptic.light()
                void useRaisingStore.getState().equipWeapon(w.kind, w.grade)
              }}
              className={`weapon-card ${w.equipped ? 'is-equipped' : ''}`}
              data-testid="weapon"
              data-kind={w.kind}
              data-grade={w.grade}
            >
              <GunSprite kind={w.kind} grade={w.grade} width={88} />
              <span className="font-game text-[15px]">
                {w.name}{' '}
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${GRADE_BADGE[w.grade]}`}
                >
                  {w.gradeName}
                </span>
              </span>
              <span className="text-[11px] text-muted">
                {w.equipped ? '장착 중 · ' : ''}공격 ×{w.damagePercent / 100} ·{' '}
                {(1000 / w.fireMs).toFixed(1)}발/초{w.count > 1 ? ` · ${w.count}개` : ''}
              </span>
              <span className="weapon-tag">{FIRE_STYLE_NAMES[w.kind]}</span>
              <span
                className="weapon-effect"
                data-testid="weapon-effect"
                title={WEAPON_EFFECTS[w.kind].desc}
              >
                {WEAPON_EFFECTS[w.kind].name} · {WEAPON_EFFECTS[w.kind].desc}
              </span>
              {/* 강점·약점 한 줄 (#587, decisions.md 430번). */}
              <span className="weapon-traits" data-testid="weapon-traits">
                <b className="text-teal">강점</b> {WEAPON_TRAITS[w.kind].strength}
                <br />
                <b className="text-red-pen">약점</b> {WEAPON_TRAITS[w.kind].weakness}
              </span>
            </button>
            {armory && w.grade !== 'S' && w.count >= armory.mergeCount && (
              <button
                type="button"
                className="weapon-merge"
                data-testid="weapon-merge"
                disabled={busy || ended}
                onClick={() => {
                  sfx.levelUp()
                  haptic.medium()
                  void useRaisingStore.getState().mergeWeapon(w.kind, w.grade as MergeGrade)
                }}
              >
                {armory.mergeCount}개 합쳐 등급 올리기
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-red-pen">
          {error}
        </p>
      )}
    </div>
  )
}
