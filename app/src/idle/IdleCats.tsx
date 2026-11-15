import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useEffect, useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { BOSS_NAME, GRADE_BADGE, mergeable } from '../mental/armory'
import { GunSprite } from '../mental/GunSprite'
import { DEFAULT_WEAPON, heroOf, type Weapon } from '../mental/hero'
import { magicTier } from '../mental/magic'
import { FIRE_STYLE_NAMES, WEAPON_EFFECTS } from '../mental/weaponEffects'
import { CatGear } from './CatGear'
import { catTrait, CatPortrait as Portrait } from './CatPortrait'
import { IdleGacha } from './IdleGacha'
import { SkillBadge } from './SkillBadge'
import { SKILLS } from './skills'

type Cat = NonNullable<Company['idle']>['cats'][number]

/** 6열 격자. 보유 여부와 관계없이 전체 도감을 표시한다. */
const COLUMNS = 6

/**
 * 고양이 메뉴 (decisions.md 488·491·493·526·530번): 다이아로 고양이와 무기를 뽑고, 위의 출전 칸 넷에 세우고, 사장냥과 고양이마다 가진 무기를
 * 하나씩 들린다. 아래는 가진 고양이의 인벤토리 격자다. 고양이를 누르면 그 고양이의 고유 스킬 설명과 장비가 나온다 (501번). 결과는 서버가 정한다.
 */
export function IdleCats({ company, gearAsked }: { company: Company; gearAsked?: boolean }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  // 고른 고양이. null이면 사장냥이다.
  const [picked, setPicked] = useState<CatCode | null>(null)
  const [arming, setArming] = useState(Boolean(gearAsked))
  // 전투에서 "무기 바꾸기"로 왔다(Windows): 사장냥의 장비 목록을 연다.
  useEffect(() => {
    if (!gearAsked) return
    setPicked(null)
    setArming(true)
  }, [gearAsked])
  const idle = company.idle
  if (!idle) return null
  const hero = heroOf(company)
  const same = (w: Weapon, held: Cat['weapon']) => w.kind === held?.kind && w.grade === held.grade
  const fielded = idle.cats.filter((cat) => cat.fielded)
  const cat = idle.cats.find((c) => c.code === picked && c.level > 0) ?? null
  const gun = cat
    ? (company.weapons?.find((w) => same(w, cat.weapon)) ?? DEFAULT_WEAPON)
    : hero.weapon
  const pick = (code: CatCode | null) => {
    sfx.tap()
    setArming(false)
    setPicked(picked === code ? null : code)
  }
  const skill = cat ? SKILLS[cat.skill] : null
  const canMerge = mergeable(company).length > 0
  return (
    <>
      <IdleGacha
        company={company}
        onCat={(code) => {
          setPicked(code)
          setArming(false)
        }}
      />
      <p className="idle-subtitle">
        출전 {fielded.length} / {idle.fieldSlots} · 사장냥은 늘 함께 싸워요
      </p>
      <ul className="idle-cat-field-row" aria-label="출전 칸">
        <li>
          <button
            type="button"
            className={`idle-cat-boss ${cat ? '' : 'is-picked'}`}
            data-testid="cat-boss"
            aria-label={`${BOSS_NAME} · 늘 출전`}
            aria-pressed={!cat}
            onClick={() => pick(null)}
          >
            <Portrait />
            <small className="idle-cat-slot-name">{BOSS_NAME}</small>
          </button>
        </li>
        {Array.from({ length: idle.fieldSlots }, (_, i) => fielded[i] ?? null).map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 출전 칸은 자리 번호가 곧 열쇠다.
          <li key={i}>
            {c ? (
              <button
                type="button"
                className={`idle-cat-slot ${picked === c.code ? 'is-picked' : ''}`}
                data-testid="cat-slot"
                data-code={c.code}
                aria-label={`출전 ${i + 1}번 ${c.name}`}
                onClick={() => pick(c.code)}
              >
                <Portrait code={c.code} />
                <span className="idle-cat-badge">
                  <SkillBadge skill={c.skill} level={c.skillLevel} size={22} />
                </span>
                <small className="idle-cat-slot-name">{c.name}</small>
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
      <article className="idle-cat owned" data-testid="cat-detail" data-code={cat?.code ?? 'boss'}>
        <Portrait code={cat?.code} />
        <div className="idle-cat-info">
          <b>
            {cat ? cat.name : hero.name} {cat && <small>Lv.{cat.level}</small>}
          </b>
          <small>
            {cat
              ? `무기 공격력의 ${cat.damagePercent}%로 쏴요 · ${catTrait(cat)}`
              : '늘 맨 앞에서 싸워요 · 아래 고양이를 누르면 출전·장비를 바꿔요'}
          </small>
        </div>
        {cat ? (
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
        ) : (
          <span className="idle-cat-field idle-cat-always">늘 출전</span>
        )}
        {/* 스킬 설명 (530번): 하는 일, 레벨이 오르면 달라지는 점, 다음 스킬 레벨까지 필요한 고양이 레벨. */}
        {cat && skill && (
          <section className="idle-cat-skill" data-testid="cat-skill" data-skill={cat.skill}>
            <SkillBadge skill={cat.skill} level={cat.skillLevel} size={60} />
            <div className="idle-skill-text">
              <b className="idle-skill-title">
                고유 스킬 {cat.skillName}{' '}
                <small className="idle-skill-lv">Lv.{cat.skillLevel}</small>
              </b>
              <p className="idle-skill-line">{skill.does}</p>
              <p className="idle-skill-line">{skill.grows}</p>
              {/* 레벨에 따라 바뀌는 모습 (531번): 지금 단계에 테를 두른다. */}
              <ol className="idle-skill-tiers" aria-label="레벨에 따라 바뀌는 모습">
                {skill.tiers.map((name, i) => {
                  const now = magicTier(cat.skillLevel) === i + 1
                  return (
                    <li
                      key={name}
                      className={`idle-skill-tier ${now ? 'is-now' : ''}`}
                      aria-current={now || undefined}
                    >
                      <SkillBadge skill={cat.skill} level={i + 1} size={24} />
                      {name}
                    </li>
                  )
                })}
              </ol>
              <p className="idle-skill-line idle-skill-next" data-testid="cat-skill-next">
                {cat.skillNextLevel > 0
                  ? `고양이 Lv.${cat.skillNextLevel}에 스킬 Lv.${cat.skillLevel + 1} · 앞으로 ${cat.skillNextLevel - cat.level}레벨`
                  : '스킬 최고 레벨이에요'}
              </p>
              <p className="idle-skill-line">
                {cat.fielded ? '출전 중이라 발동하고 있어요' : '출전하면 발동해요'}
              </p>
            </div>
          </section>
        )}
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
          <span className="idle-gun-text">
            {cat && !cat.weapon ? '기본 권총' : gun.name}{' '}
            <i className={`idle-grade ${GRADE_BADGE[gun.grade]}`}>{gun.gradeName}</i>
            <small className="idle-gun-note">
              {FIRE_STYLE_NAMES[gun.kind]} · {WEAPON_EFFECTS[gun.kind].name}
            </small>
          </span>
          <em className="idle-gun-open">
            장비 {arming ? '▴' : '▾'}
            {canMerge && !arming && (
              <i className="idle-gun-dot" role="img" aria-label="합칠 수 있는 무기 있음" />
            )}
          </em>
        </button>
        {arming && <CatGear company={company} wearer={cat} />}
      </article>
      <ul className="idle-cat-grid" aria-label={`고양이 인벤토리 · 동료 ${idle.cats.length}종`}>
        {Array.from(
          { length: Math.max(18, Math.ceil(idle.cats.length / COLUMNS) * COLUMNS) },
          (_, i) => idle.cats[i] ?? null,
        ).map((c, i) =>
          c ? (
            <li key={c.code}>
              <button
                type="button"
                className={`idle-cat-cell ${c.level > 0 ? 'owned' : ''} ${c.fielded ? 'fielded' : ''} ${picked === c.code ? 'is-picked' : ''}`}
                data-testid="cat"
                data-code={c.code}
                disabled={c.level < 1}
                aria-label={
                  c.level > 0
                    ? `${c.name} 레벨 ${c.level}${c.fielded ? ' 출전 중' : ''} · 고유 스킬 ${c.skillName}`
                    : `${c.name} 아직 없음 · 고유 스킬 ${c.skillName}`
                }
                onClick={() => pick(c.code)}
              >
                <Portrait code={c.code} locked={c.level < 1} />
                {/* 고유 스킬 (531번): 못 가진 고양이의 스킬은 흑백에 자물쇠다. */}
                <span className="idle-cat-badge">
                  <SkillBadge skill={c.skill} level={c.skillLevel} size={18} locked={c.level < 1} />
                </span>
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
