import type { Company } from '@web/api/client'
import { GUN_GRADES } from '@web/features/game/cat/draw'
import { money } from '@web/features/game/labels'
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

/** 고양이마다 제 그림과 특성 (488·492번). 라일락냥은 하늘냥 그림을 보랏빛으로 쓴다. 특성 수치는 서버가 준다. */
const CATS: Record<CatCode, { art: string; trait: (cat: Cat) => string }> = {
  sky: { art: STAGE_ASSETS.fold, trait: (cat) => `연사 +${cat.firePercent - 100}%` },
  // 민트냥의 공격력 특성(서버 IdleEngine.CAT_DAMAGE)은 damagePercent에 이미 들어 있다.
  mint: { art: STAGE_ASSETS.fluffy, trait: () => '공격력 특화' },
  lilac: {
    art: STAGE_ASSETS.fold,
    trait: (cat) => `치명타 피해 +${cat.criticalPercent - 100}%`,
  },
}

function Portrait({ art, locked, tone }: { art: string; locked?: boolean; tone?: string }) {
  return (
    <span
      className={`idle-cat-portrait ${locked ? 'is-locked' : ''} ${tone ? `is-${tone}` : ''}`}
      aria-hidden="true"
    >
      <img src={art} alt="" draggable={false} />
      {locked && <IdleIcon name="lock" />}
    </span>
  )
}

/**
 * 고양이 메뉴 (decisions.md 488·491번): 자본으로 고양이를 뽑고, 출전시키고, 고양이마다 가진 무기를 하나씩 들린다. 스킬은 고양이와 상관없이
 * 성장 › 스킬에 있다. 값과 결과는 서버가 정한다.
 */
export function IdleCats({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const [drawing, setDrawing] = useState(false)
  const [drawn, setDrawn] = useState<{ cat: Cat; isNew: boolean } | null>(null)
  const [arming, setArming] = useState<CatCode | null>(null)
  const idle = company.idle
  if (!idle) return null
  const hero = heroOf(company)
  const weapons = company.weapons?.length ? company.weapons : [DEFAULT_WEAPON]
  const same = (w: Weapon, held: Cat['weapon']) => w.kind === held?.kind && w.grade === held.grade
  const fielded = idle.cats.filter((cat) => cat.fielded).length
  const draw = async () => {
    setDrawing(true)
    sfx.stamp()
    try {
      const after = await useRaisingStore.getState().drawCat()
      const cat = after?.idle?.cats.find(
        (c) => c.level !== idle.cats.find((old) => old.code === c.code)?.level,
      )
      if (cat) {
        sfx.levelUp()
        haptic.medium()
        setDrawn({ cat, isNew: cat.level === 1 })
      }
    } finally {
      setDrawing(false)
    }
  }
  return (
    <>
      <p className="idle-subtitle">
        뽑은 고양이를 출전시키면 함께 싸워요 · 출전 {fielded} / {idle.fieldSlots}
      </p>
      <section className="idle-cat-gacha" data-testid="cat-gacha">
        <div>
          <b>고양이 뽑기</b>
          <small>
            {drawn
              ? drawn.isNew
                ? `${drawn.cat.name} 합류!`
                : `${drawn.cat.name} Lv.${drawn.cat.level} · 화력 ${drawn.cat.damagePercent}%`
              : '새 고양이가 합류하고, 또 나오면 레벨이 올라 화력이 세져요'}
          </small>
        </div>
        <button
          type="button"
          className="idle-buy"
          data-testid="cat-draw"
          disabled={drawing || busy || company.capital < idle.catPrice}
          onClick={() => void draw()}
        >
          뽑기
          <small>{money(idle.catPrice)}</small>
        </button>
      </section>
      <div className="idle-cats">
        <article className="idle-cat owned">
          <Portrait art={STAGE_ASSETS.hero} />
          <div className="idle-cat-info">
            <b>{hero.name}</b>
            <small>늘 출전 · 무기는 성장 › 인벤토리에서 바꿔요</small>
            <span className="idle-cat-gun">
              <GunSprite kind={hero.weapon.kind} grade={hero.weapon.grade} width={40} />
              {hero.weapon.name}
              <i className={GRADE_BADGE[hero.weapon.grade]}>{hero.weapon.gradeName}</i>
            </span>
          </div>
        </article>
        {idle.cats.map((cat) => {
          const owned = cat.level > 0
          const gun = weapons.find((w) => same(w, cat.weapon)) ?? DEFAULT_WEAPON
          return (
            <article
              key={cat.code}
              className={`idle-cat ${owned ? 'owned' : ''} ${cat.fielded ? 'fielded' : ''}`}
              data-testid="cat"
              data-code={cat.code}
            >
              <Portrait
                art={CATS[cat.code].art}
                locked={!owned}
                tone={cat.code === 'lilac' ? 'lilac' : undefined}
              />
              <div className="idle-cat-info">
                <b>
                  {cat.name} {owned && <small>Lv.{cat.level}</small>}
                </b>
                <small>
                  {owned
                    ? `무기 공격력의 ${cat.damagePercent}%로 쏴요 · ${CATS[cat.code].trait(cat)}`
                    : `${CATS[cat.code].trait(cat)} · 고양이 뽑기로 만나요`}
                </small>
                {owned && (
                  <button
                    type="button"
                    className="idle-cat-gun"
                    data-testid="cat-gun"
                    aria-expanded={arming === cat.code}
                    onClick={() => {
                      sfx.tap()
                      setArming(arming === cat.code ? null : cat.code)
                    }}
                  >
                    <GunSprite kind={gun.kind} grade={gun.grade} width={40} />
                    {cat.weapon ? gun.name : '기본 권총'}
                    <i className={GRADE_BADGE[gun.grade]}>{gun.gradeName}</i>
                    <em>장비 ›</em>
                  </button>
                )}
              </div>
              {owned && (
                <button
                  type="button"
                  className="idle-cat-field"
                  data-testid="cat-field"
                  aria-pressed={cat.fielded}
                  disabled={busy || (!cat.fielded && fielded >= idle.fieldSlots)}
                  onClick={() => {
                    sfx.tap()
                    haptic.light()
                    void useRaisingStore.getState().fieldCat(cat.code, !cat.fielded)
                  }}
                >
                  {cat.fielded ? '출전 중' : fielded >= idle.fieldSlots ? '칸 없음' : '출전'}
                </button>
              )}
              {arming === cat.code && (
                <ul className="idle-cat-guns" aria-label={`${cat.name} 장비`}>
                  {[...weapons]
                    .sort(
                      (a, b) =>
                        GUN_GRADES.indexOf(b.grade) - GUN_GRADES.indexOf(a.grade) ||
                        a.kind.localeCompare(b.kind),
                    )
                    .map((w) => {
                      const held = same(w, cat.weapon)
                      const others = idle.cats.filter(
                        (c) => c.code !== cat.code && same(w, c.weapon),
                      )
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
          )
        })}
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
