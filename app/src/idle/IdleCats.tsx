import type { Company } from '@web/api/client'
import { GUN_GRADES } from '@web/features/game/cat/draw'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { STAGE_ASSETS } from '../mental/assets'
import { GunSprite } from '../mental/GunSprite'
import { DEFAULT_WEAPON, heroOf, type Weapon } from '../mental/hero'
import { GRADE_BADGE } from '../mental/WeaponInventory'
import { IdleIcon } from './icons'

type Cat = NonNullable<Company['idle']>['cats'][number]

/** 고양이마다 제 그림과 특성 (488·492·493번). 그림은 접힌 귀·장모 둘이고, 나머지는 빛깔(tone)로 가린다. 특성 수치는 서버가 준다. */
const CATS: Record<CatCode, { art: string; tone?: string }> = {
  sky: { art: STAGE_ASSETS.fold },
  mint: { art: STAGE_ASSETS.fluffy },
  lilac: { art: STAGE_ASSETS.fold, tone: 'lilac' },
  sunset: { art: STAGE_ASSETS.fluffy, tone: 'sunset' },
  night: { art: STAGE_ASSETS.fold, tone: 'night' },
  snow: { art: STAGE_ASSETS.fluffy, tone: 'snow' },
}

/** 인벤토리 격자: 8칸 × 3줄 (493번). */
const SLOTS = 24

/** 이 고양이 총의 특성: 서버가 준 연사·치명타 배율을 그대로 읽는다. 공격력 특성은 damagePercent에 이미 들어 있다. */
function trait(cat: Cat) {
  const parts = [
    cat.firePercent > 100 && `연사 +${cat.firePercent - 100}%`,
    cat.criticalPercent > 100 && `치명타 피해 +${cat.criticalPercent - 100}%`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '공격력 특화'
}

function Portrait({ code, locked }: { code?: CatCode; locked?: boolean }) {
  const look = code ? CATS[code] : { art: STAGE_ASSETS.hero }
  return (
    <span
      className={`idle-cat-portrait ${locked ? 'is-locked' : ''} ${look.tone ? `is-${look.tone}` : ''}`}
      aria-hidden="true"
    >
      <img src={look.art} alt="" draggable={false} />
      {locked && <IdleIcon name="lock" />}
    </span>
  )
}

/**
 * 고양이 메뉴 (decisions.md 488·491·493번): 뽑기권으로 고양이를 뽑고, 위의 출전 칸 넷에 세우고, 고양이마다 가진 무기를 하나씩 들린다. 아래는
 * 가진 고양이의 인벤토리 격자다. 스킬은 고양이와 상관없이 성장 › 스킬에 있다. 결과는 서버가 정한다.
 */
export function IdleCats({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const [drawing, setDrawing] = useState(false)
  const [drawn, setDrawn] = useState<{ cat: Cat; isNew: boolean } | null>(null)
  const [picked, setPicked] = useState<CatCode | null>(null)
  const [arming, setArming] = useState(false)
  const idle = company.idle
  if (!idle) return null
  const hero = heroOf(company)
  const tickets = company.armory?.tickets ?? 0
  const weapons = company.weapons?.length ? company.weapons : [DEFAULT_WEAPON]
  const same = (w: Weapon, held: Cat['weapon']) => w.kind === held?.kind && w.grade === held.grade
  const fielded = idle.cats.filter((cat) => cat.fielded)
  const cat = idle.cats.find((c) => c.code === picked && c.level > 0)
  const gun = cat ? (weapons.find((w) => same(w, cat.weapon)) ?? DEFAULT_WEAPON) : null
  const pick = (code: CatCode) => {
    sfx.tap()
    setArming(false)
    setPicked(picked === code ? null : code)
  }
  const draw = async () => {
    setDrawing(true)
    sfx.stamp()
    try {
      const after = await useRaisingStore.getState().drawCat()
      const got = after?.idle?.cats.find(
        (c) => c.level !== idle.cats.find((old) => old.code === c.code)?.level,
      )
      if (got) {
        sfx.levelUp()
        haptic.medium()
        setDrawn({ cat: got, isNew: got.level === 1 })
        setPicked(got.code)
        setArming(false)
      }
    } finally {
      setDrawing(false)
    }
  }
  return (
    <>
      <section className="idle-cat-gacha" data-testid="cat-gacha">
        <div>
          <b>고양이 뽑기</b>
          <small>
            {drawn
              ? drawn.isNew
                ? `${drawn.cat.name} 합류!`
                : `${drawn.cat.name} Lv.${drawn.cat.level} · 화력 ${drawn.cat.damagePercent}%`
              : '뽑기권 한 장으로 한 마리 · 또 나오면 레벨이 올라요'}
          </small>
        </div>
        <button
          type="button"
          className="idle-buy"
          data-testid="cat-draw"
          disabled={drawing || busy || tickets < 1}
          onClick={() => void draw()}
        >
          뽑기
          <small>뽑기권 {tickets}장</small>
        </button>
      </section>
      <p className="idle-subtitle">
        출전 {fielded.length} / {idle.fieldSlots} · 사장냥은 늘 함께 싸워요
      </p>
      <ul className="idle-cat-field-row" aria-label="출전 칸">
        {Array.from({ length: idle.fieldSlots }, (_, i) => fielded[i] ?? null).map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 출전 칸은 자리 번호가 곧 열쇠다.
          <li key={i}>
            {c ? (
              <button
                type="button"
                className={picked === c.code ? 'is-picked' : ''}
                data-testid="cat-slot"
                data-code={c.code}
                aria-label={`출전 ${i + 1}번 ${c.name}`}
                onClick={() => pick(c.code)}
              >
                <Portrait code={c.code} />
                <small>{c.name}</small>
              </button>
            ) : (
              <span
                className="idle-cat-empty"
                data-testid="cat-slot"
                role="img"
                aria-label="빈 출전 칸"
              >
                ＋
              </span>
            )}
          </li>
        ))}
      </ul>
      {cat && gun ? (
        <article className="idle-cat owned" data-testid="cat-detail" data-code={cat.code}>
          <Portrait code={cat.code} />
          <div className="idle-cat-info">
            <b>
              {cat.name} <small>Lv.{cat.level}</small>
            </b>
            <small>
              무기 공격력의 {cat.damagePercent}%로 쏴요 · {trait(cat)}
            </small>
            <button
              type="button"
              className="idle-cat-gun"
              data-testid="cat-gun"
              aria-expanded={arming}
              onClick={() => {
                sfx.tap()
                setArming(!arming)
              }}
            >
              <GunSprite kind={gun.kind} grade={gun.grade} width={40} />
              {cat.weapon ? gun.name : '기본 권총'}
              <i className={GRADE_BADGE[gun.grade]}>{gun.gradeName}</i>
              <em>장비 ›</em>
            </button>
          </div>
          <button
            type="button"
            className="idle-cat-field"
            data-testid="cat-field"
            aria-pressed={cat.fielded}
            disabled={busy || (!cat.fielded && fielded.length >= idle.fieldSlots)}
            onClick={() => {
              sfx.tap()
              haptic.light()
              void useRaisingStore.getState().fieldCat(cat.code, !cat.fielded)
            }}
          >
            {cat.fielded ? '출전 중' : fielded.length >= idle.fieldSlots ? '칸 없음' : '출전'}
          </button>
          {arming && (
            <ul className="idle-cat-guns" aria-label={`${cat.name} 장비`}>
              {[...weapons]
                .sort(
                  (a, b) =>
                    GUN_GRADES.indexOf(b.grade) - GUN_GRADES.indexOf(a.grade) ||
                    a.kind.localeCompare(b.kind),
                )
                .map((w) => {
                  const held = same(w, cat.weapon)
                  const others = idle.cats.filter((c) => c.code !== cat.code && same(w, c.weapon))
                  // 사장냥이 든 하나뿐인 무기는 가져올 수 없다. 다른 고양이가 든 것은 가져온다(서버 IdleEngine.equipCat).
                  const free = w.count - (w.equipped ? 1 : 0)
                  return (
                    <li key={`${w.kind}-${w.grade}`}>
                      <button
                        type="button"
                        data-testid="cat-weapon"
                        data-kind={w.kind}
                        data-grade={w.grade}
                        aria-pressed={held}
                        disabled={busy || held || free < 1}
                        onClick={() => {
                          sfx.tap()
                          haptic.light()
                          void useRaisingStore
                            .getState()
                            .equipCat(cat.code, { kind: w.kind, grade: w.grade })
                        }}
                      >
                        <GunSprite kind={w.kind} grade={w.grade} width={52} />
                        <span>
                          {w.name} <i className={GRADE_BADGE[w.grade]}>{w.gradeName}</i>
                        </span>
                        <small>
                          {held
                            ? '장착 중'
                            : free < 1
                              ? '사장냥 장착'
                              : free - others.length < 1
                                ? `${others[0].name}에게서 가져오기`
                                : `×${w.count}`}
                        </small>
                      </button>
                    </li>
                  )
                })}
              {cat.weapon && (
                <li>
                  <button
                    type="button"
                    data-testid="cat-unequip"
                    disabled={busy}
                    onClick={() => {
                      sfx.tap()
                      void useRaisingStore.getState().equipCat(cat.code, null)
                    }}
                  >
                    <span>무기 빼기</span>
                    <small>기본 권총을 쏴요</small>
                  </button>
                </li>
              )}
            </ul>
          )}
        </article>
      ) : (
        <article className="idle-cat owned" data-testid="cat-detail">
          <Portrait />
          <div className="idle-cat-info">
            <b>{hero.name}</b>
            <small>아래 칸의 고양이를 누르면 출전·장비를 바꿀 수 있어요</small>
            <span className="idle-cat-gun">
              <GunSprite kind={hero.weapon.kind} grade={hero.weapon.grade} width={40} />
              {hero.weapon.name}
              <i className={GRADE_BADGE[hero.weapon.grade]}>{hero.weapon.gradeName}</i>
            </span>
          </div>
        </article>
      )}
      <ul className="idle-cat-grid" aria-label="고양이 인벤토리 · 8칸 3줄">
        {Array.from({ length: SLOTS }, (_, i) => idle.cats[i] ?? null).map((c, i) =>
          c ? (
            <li key={c.code}>
              <button
                type="button"
                className={`${c.level > 0 ? 'owned' : ''} ${c.fielded ? 'fielded' : ''} ${picked === c.code ? 'is-picked' : ''}`}
                data-testid="cat"
                data-code={c.code}
                disabled={c.level < 1}
                aria-label={
                  c.level > 0
                    ? `${c.name} 레벨 ${c.level}${c.fielded ? ' 출전 중' : ''}`
                    : `${c.name} 아직 없음`
                }
                onClick={() => pick(c.code)}
              >
                <Portrait code={c.code} locked={c.level < 1} />
                {c.level > 0 && <i>Lv.{c.level}</i>}
              </button>
            </li>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: 빈 칸은 자리 번호가 곧 열쇠다.
            <li key={i} className="idle-cat-cell-empty" />
          ),
        )}
      </ul>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
