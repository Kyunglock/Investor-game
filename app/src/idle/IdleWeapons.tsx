import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { sfx } from '../fx/sound'
import { BOSS_NAME, GRADE_BADGE } from '../mental/armory'
import { GunSprite } from '../mental/GunSprite'
import { DEFAULT_WEAPON, heroOf, type Weapon } from '../mental/hero'
import { FIRE_STYLE_NAMES, WEAPON_EFFECTS } from '../mental/weaponEffects'
import { CatGear } from './CatGear'
import { CatPortrait as Portrait } from './CatPortrait'

type Cat = NonNullable<Company['idle']>['cats'][number]

/** 무기를 들 수 있는 이: 출전한 고양이와, 쉬고 있어도 무기를 쥔 고양이(그 무기를 빼 줄 수 있게). 사장냥은 늘 맨 앞이다. */
export function gearWearers(company: Company): Cat[] {
  return (company.idle?.cats ?? []).filter((c) => c.level > 0 && (c.fielded || c.weapon !== null))
}

/**
 * 무기 탭 (decisions.md 540번): 가진 무기를 보고, 사장냥과 고양이에게 들리고, 같은 무기를 합친다. 위에서 누가 들지를 고르고 아래 장비 목록에서
 * 무기를 누른다. 장착·합치기의 규칙은 장비 목록(CatGear, 530번) 그대로다. 무기 뽑기는 상점 탭에 있다.
 */
export function IdleWeapons({
  company,
  wearer,
  onWearer,
  onDraw,
}: {
  company: Company
  /** 무기를 들 고양이. null이면 사장냥이다. */
  wearer: CatCode | null
  onWearer: (code: CatCode | null) => void
  /** 무기 뽑기(상점 탭)로 간다. */
  onDraw: () => void
}) {
  const hero = heroOf(company)
  const wearers = gearWearers(company)
  // 고른 고양이가 더는 없으면(쉬게 하고 무기도 뺐다) 사장냥으로 돌아간다.
  const cat = wearers.find((c) => c.code === wearer) ?? null
  const same = (w: Weapon, held: Cat['weapon']) => w.kind === held?.kind && w.grade === held.grade
  const gun = cat
    ? (company.weapons?.find((w) => same(w, cat.weapon)) ?? DEFAULT_WEAPON)
    : hero.weapon
  const pick = (code: CatCode | null) => {
    sfx.tap()
    onWearer(code)
  }
  return (
    <>
      <p className="idle-subtitle">누가 들지 고르고, 아래에서 무기를 눌러 장착해요</p>
      <ul className="idle-cat-field-row idle-wearers" aria-label="무기를 들 고양이">
        <li>
          <button
            type="button"
            className={`idle-cat-boss ${cat ? '' : 'is-picked'}`}
            data-testid="gear-wearer"
            data-code="boss"
            aria-pressed={!cat}
            aria-label={`${BOSS_NAME} 무기 고르기`}
            onClick={() => pick(null)}
          >
            <Portrait />
            <small className="idle-cat-slot-name">{BOSS_NAME}</small>
          </button>
        </li>
        {wearers.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              className={`idle-cat-slot ${cat?.code === c.code ? 'is-picked' : ''}`}
              data-testid="gear-wearer"
              data-code={c.code}
              aria-pressed={cat?.code === c.code}
              aria-label={`${c.name} 무기 고르기${c.fielded ? '' : ' · 쉬는 중'}`}
              onClick={() => pick(c.code)}
            >
              <Portrait code={c.code} />
              <small className="idle-cat-slot-name">{c.name}</small>
            </button>
          </li>
        ))}
      </ul>
      <article className="idle-cat owned idle-weapon-now" data-testid="weapon-now">
        <div className="idle-cat-gun idle-weapon-held">
          <GunSprite kind={gun.kind} grade={gun.grade} width={48} />
          <span className="idle-gun-text">
            <small className="idle-gun-note">{cat ? cat.name : hero.name}의 무기</small>
            {cat && !cat.weapon ? '기본 권총' : gun.name}{' '}
            <i className={`idle-grade ${GRADE_BADGE[gun.grade]}`}>{gun.gradeName}</i>
            <small className="idle-gun-note">
              {FIRE_STYLE_NAMES[gun.kind]} · {WEAPON_EFFECTS[gun.kind].name}
            </small>
          </span>
        </div>
        <CatGear company={company} wearer={cat} />
      </article>
      <button
        type="button"
        className="idle-weapon-draw"
        data-testid="weapon-to-shop"
        onClick={onDraw}
      >
        무기 뽑기는 상점에서 ▸
      </button>
    </>
  )
}
