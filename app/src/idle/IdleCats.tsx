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

/** 고양이마다 제 그림 (488번, 전투의 접힌 귀·장모 고양이). 사장냥은 늘 출전한다. */
const ART: Record<CatCode, string> = {
  sky: STAGE_ASSETS.fold,
  mint: STAGE_ASSETS.fluffy,
}

function Portrait({ art, locked }: { art: string; locked?: boolean }) {
  return (
    <span className={`idle-cat-portrait ${locked ? 'is-locked' : ''}`} aria-hidden="true">
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
      <p className="idle-subtitle">뽑은 고양이를 출전시키면 함께 싸워요</p>
      <section className="idle-cat-gacha" data-testid="cat-gacha">
        <div>
          <b>고양이 뽑기</b>
          <small>
            {drawn
              ? drawn.isNew
                ? `${drawn.cat.name} 합류!`
                : `${drawn.cat.name} Lv.${drawn.cat.level} · 총 공격력 +${drawn.cat.bonusPercent}%`
              : '새 고양이가 합류하고, 또 나오면 레벨이 올라요'}
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
              <Portrait art={ART[cat.code]} locked={!owned} />
              <div className="idle-cat-info">
                <b>
                  {cat.name} {owned && <small>Lv.{cat.level}</small>}
                </b>
                <small>
                  {owned
                    ? `제 총으로 함께 쏴요${cat.bonusPercent > 0 ? ` · 총 공격력 +${cat.bonusPercent}%` : ''}`
                    : '고양이 뽑기로 만나요'}
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
                  disabled={busy}
                  onClick={() => {
                    sfx.tap()
                    haptic.light()
                    void useRaisingStore.getState().fieldCat(cat.code, !cat.fielded)
                  }}
                >
                  {cat.fielded ? '출전 중' : '출전'}
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
