import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { createPortal } from 'react-dom'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { BOSS_NAME, GRADE_BADGE, mergeable } from '../mental/armory'
import { GunSprite } from '../mental/GunSprite'
import { DEFAULT_WEAPON, heroOf, type Weapon } from '../mental/hero'
import { magicTier } from '../mental/magic'
import { FIRE_STYLE_NAMES, WEAPON_EFFECTS } from '../mental/weaponEffects'
import { CatGear } from './CatGear'
import { catTrait, CatPortrait as Portrait } from './CatPortrait'
import { sortCats } from './catGrade'
import { FishIcon } from './FishIcon'
import { SkillBadge } from './SkillBadge'
import { SKILLS, skillNames } from './skills'
import { useLoadoutDrag } from './useLoadoutDrag'

type Cat = NonNullable<Company['idle']>['cats'][number]

/** 낭독기가 읽을 스킬 (561번): 없으면 없다고 읽는다. */
const skillLabel = (cat: Cat) =>
  cat.skills.length > 0 ? `고유 스킬 ${skillNames(cat)}` : '고유 스킬 없음'

/** 6열 격자. 보유 여부와 관계없이 전체 도감을 표시한다. */
const COLUMNS = 6

/**
 * 고양이 메뉴 (decisions.md 488·491·493·530·567번): 위의 출전 칸 넷에 세우고, 아래는 가진 고양이의 인벤토리 격자다. 고양이를 누르면 그
 * 고양이의 등급·고유 스킬 설명과 든 무기가 나온다 (501번). 무기는 같은 패널에서 바꾸고 뽑기는 상점 탭이다(541번). 결과는 서버가 정한다.
 * 무기 탭을 여기에 합쳤다 (560번): 든 무기를 누르면 고양이 목록 자리에 장비 목록이 펴져 들리고 합친다.
 */
export function IdleCats({
  company,
  picked,
  onPick,
  gear: gearOpen,
  onGear: setGearOpen,
  onDraw,
}: {
  company: Company
  /** 메뉴를 오가도 선택한 고양이를 유지한다. null은 사장냥이다. */
  picked: CatCode | null
  onPick: (code: CatCode | null) => void
  /** 고양이 목록 대신 장비 목록을 펴고 있는가 (560번). */
  gear: boolean
  onGear: (open: boolean) => void
  /** 무기 뽑기(상점 탭)로 간다. */
  onDraw: () => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  // 고른 고양이. null이면 사장냥이다.
  const setPicked = onPick
  const idle = company.idle
  const hero = heroOf(company)
  const fish = idle?.rebirth?.fish ?? 0
  const same = (w: Weapon, held: Cat['weapon']) => w.kind === held?.kind && w.grade === held.grade
  const fielded = (idle?.cats ?? []).filter((cat) => cat.fielded)
  // 인벤토리: 가진 고양이를 등급순으로 먼저, 없는 고양이를 등급순으로 뒤에.
  const sorted = sortCats(idle?.cats ?? [])
  const cat = (idle?.cats ?? []).find((c) => c.code === picked && c.level > 0) ?? null
  const gun = cat
    ? (company.weapons?.find((w) => same(w, cat.weapon)) ?? DEFAULT_WEAPON)
    : hero.weapon
  const pick = (code: CatCode | null) => {
    sfx.tap()
    setPicked(code)
  }
  const place = async (code: CatCode, target: string) => {
    const store = useRaisingStore.getState()
    if (store.busy) return
    const c = store.company?.idle?.cats.find((c) => c.code === code)
    if (!c || c.fielded) return
    await store.fieldCat(
      code,
      true,
      target.startsWith('slot:empty') ? undefined : (target.slice(5) as CatCode),
    )
    if (!useRaisingStore.getState().error) {
      onPick(code)
      haptic.light()
      sfx.tap()
    }
  }
  const accepts = (code: CatCode, target: string) =>
    !busy && target.startsWith('slot:') && !(idle?.cats ?? []).find((c) => c.code === code)?.fielded
  const { drag, down, consumeClick } = useLoadoutDrag<CatCode>(accepts, (code, target) => {
    void place(code, target)
  })
  const canMerge = mergeable(company).length > 0
  const weaponOf = (c: Cat) => company.weapons?.find((w) => same(w, c.weapon)) ?? DEFAULT_WEAPON
  /**
   * 무기 칸 (567번): 바로 위 고양이(code가 null이면 사장냥)가 드는 무기. 장비 목록에서 무기를 끌어 놓으면 그 고양이가 장착하고, 누르면 그
   * 고양이의 장비 목록이 펴진다. 든 무기가 없으면 기본 권총을 흐리게 보인다.
   */
  const gunSlot = (code: CatCode | null, name: string, held: Weapon, bare: boolean) => (
    <button
      type="button"
      className={`idle-gun-slot ${bare ? 'is-bare' : ''} ${gearOpen && picked === code ? 'is-picked' : ''}`}
      data-testid="gun-slot"
      data-code={code ?? 'boss'}
      data-kind={held.kind}
      data-grade={held.grade}
      data-loadout-target={`wearer:${code ?? 'boss'}`}
      aria-label={`${name}의 무기 ${bare ? '기본 권총' : `${held.name} ${held.gradeName}`} · 눌러서 바꾸기`}
      onClick={() => {
        pick(code)
        if (!gearOpen) setGearOpen(true)
      }}
    >
      <GunSprite kind={held.kind} grade={held.grade} width={38} />
      <i className={`idle-grade idle-gun-slot-grade ${GRADE_BADGE[held.grade]}`}>
        {bare ? '기본' : held.gradeName}
      </i>
    </button>
  )
  return (
    <>
      <div className="loadout-team">
        <p className="idle-subtitle idle-team-line">
          <span>
            출전 {fielded.length} / {idle?.fieldSlots ?? 0} · 윗줄은 고양이, 아랫줄은 그 고양이의
            무기
          </span>
          {/* 생선 (569번): 환생하면 얻고 고양이의 레벨을 올린다. */}
          <b
            className="idle-fish-count"
            data-testid="fish-count"
            role="status"
            aria-label={`생선 ${fish.toLocaleString()}마리`}
          >
            <FishIcon />
            {fish.toLocaleString()}
          </b>
        </p>
        {/* 출전 칸 (567번): 다섯 칸 두 줄. 윗줄은 고양이 칸, 아랫줄은 바로 위 고양이가 드는 무기 칸이다. 이름은 적지 않는다. */}
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
            </button>
            {gunSlot(null, BOSS_NAME, hero.weapon, false)}
          </li>
          {Array.from({ length: idle?.fieldSlots ?? 0 }, (_, i) => fielded[i] ?? null).map(
            (c, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 출전 칸은 자리 번호가 곧 열쇠다.
              <li key={i}>
                {c ? (
                  <button
                    type="button"
                    className={`idle-cat-slot ${picked === c.code ? 'is-picked' : ''} ${drag ? 'is-drop-ready' : ''} ${drag?.over === `slot:${c.code}` ? 'is-drop-over' : ''}`}
                    data-testid="cat-slot"
                    data-loadout-target={`slot:${c.code}`}
                    data-code={c.code}
                    aria-label={`출전 ${i + 1}번 ${c.name}`}
                    onClick={() => {
                      if (!gearOpen && cat && !cat.fielded) void place(cat.code, `slot:${c.code}`)
                      else pick(c.code)
                    }}
                  >
                    <Portrait code={c.code} />
                    {c.skills.length > 0 && (
                      <span className="idle-cat-badge">
                        {c.skills.map((skill) => (
                          <SkillBadge
                            key={skill.code}
                            skill={skill.code}
                            level={c.skillLevel}
                            size={c.skills.length > 1 ? 18 : 22}
                          />
                        ))}
                      </span>
                    )}
                    <em className={`idle-cat-grade idle-cat-grade-tag is-${c.grade}`}>{c.grade}</em>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`idle-cat-empty ${drag ? 'is-drop-ready' : ''} ${drag?.over === `slot:empty${i}` ? 'is-drop-over' : ''}`}
                    data-loadout-target={`slot:empty${i}`}
                    disabled={busy}
                    onClick={() => {
                      if (cat && !cat.fielded) void place(cat.code, `slot:empty${i}`)
                    }}
                    data-testid="cat-slot"
                    aria-label="빈 출전 칸에 선택한 고양이 출전"
                  >
                    ＋
                  </button>
                )}
                {c ? (
                  gunSlot(c.code, c.name, weaponOf(c), !c.weapon)
                ) : (
                  <span className="idle-gun-slot is-empty" aria-hidden="true" />
                )}
              </li>
            ),
          )}
        </ul>
      </div>
      <article className="idle-cat owned" data-testid="cat-detail" data-code={cat?.code ?? 'boss'}>
        <Portrait code={cat?.code} />
        <div className="idle-cat-info">
          <b>
            {cat && (
              <i className={`idle-cat-grade is-${cat.grade}`} data-testid="cat-grade">
                {cat.grade}
              </i>
            )}{' '}
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
            disabled={busy || (!cat.fielded && fielded.length >= (idle?.fieldSlots ?? 0))}
            onClick={() => {
              sfx.tap()
              haptic.light()
              void useRaisingStore.getState().fieldCat(cat.code, !cat.fielded)
            }}
          >
            {cat.fielded
              ? '출전 중'
              : fielded.length >= (idle?.fieldSlots ?? 0)
                ? '칸 없음'
                : '출전'}
          </button>
        ) : (
          <span className="idle-cat-field idle-cat-always">늘 출전</span>
        )}
        {/* 생선으로 레벨업 (569번): 값은 서버가 준다(지금 레벨 × 5). */}
        {cat && (cat.levelCost ?? 0) > 0 && (
          <button
            type="button"
            className="idle-cat-feed"
            data-testid="cat-feed"
            disabled={busy || fish < (cat.levelCost ?? 0)}
            onClick={() => {
              sfx.levelUp()
              haptic.light()
              void useRaisingStore.getState().feedCat(cat.code)
            }}
          >
            <span>
              생선으로 레벨업{' '}
              <small>
                Lv.{cat.level} → Lv.{cat.level + 1}
              </small>
            </span>
            <em className="idle-cat-feed-cost">
              <FishIcon />
              {(cat.levelCost ?? 0).toLocaleString()}
            </em>
          </button>
        )}
        {/* 스킬 설명 (530번): 하는 일, 레벨이 오르면 달라지는 점, 다음 스킬 레벨까지 필요한 고양이 레벨. 스킬은 A등급부터 있고 S등급은 둘이다 (561번). */}
        {cat && cat.skills.length === 0 && (
          <p className="idle-cat-noskill" data-testid="cat-noskill">
            고유 스킬 없음 · 스킬은 A등급 고양이부터 있어요
          </p>
        )}
        {cat && cat.skills.length > 0 && (
          <details>
            <summary>
              고유 스킬 · {skillNames(cat)} Lv.{cat.skillLevel}
            </summary>
            {cat.skills.map((own) => {
              const skill = SKILLS[own.code]
              return (
                <section
                  key={own.code}
                  className="idle-cat-skill"
                  data-testid="cat-skill"
                  data-skill={own.code}
                >
                  <SkillBadge skill={own.code} level={cat.skillLevel} size={60} />
                  <div className="idle-skill-text">
                    <b className="idle-skill-title">
                      고유 스킬 {own.name}{' '}
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
                            <SkillBadge skill={own.code} level={i + 1} size={24} />
                            {name}
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </section>
              )
            })}
            <p className="idle-skill-line idle-skill-next" data-testid="cat-skill-next">
              {cat.skillNextLevel > 0
                ? `고양이 Lv.${cat.skillNextLevel}에 스킬 Lv.${cat.skillLevel + 1} · 앞으로 ${cat.skillNextLevel - cat.level}레벨`
                : '스킬 최고 레벨이에요'}
            </p>
            <p className="idle-skill-line">
              {cat.fielded ? '출전 중이라 발동하고 있어요' : '출전하면 발동해요'}
            </p>
          </details>
        )}
        <button
          type="button"
          className="idle-cat-gun"
          data-testid="cat-gun"
          onClick={() => {
            sfx.tap()
            setGearOpen(!gearOpen)
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
            {gearOpen ? '고양이 목록 ▾' : '무기 변경 ▸'}
            {canMerge && (
              <i className="idle-gun-dot" role="img" aria-label="합칠 수 있는 무기 있음" />
            )}
          </em>
        </button>
      </article>
      {gearOpen ? (
        <>
          <CatGear company={company} wearer={cat} onSelect={onPick} />
          <button
            type="button"
            className="idle-weapon-draw"
            data-testid="weapon-to-shop"
            onClick={onDraw}
          >
            무기 뽑기는 상점에서 ▸
          </button>
        </>
      ) : (
        <>
          <p className="loadout-hint" aria-live="polite">
            {drag?.over
              ? '놓으면 출전 고양이를 교체해요'
              : '길게 집어 출전 칸에 놓기 · 또는 고양이 선택 후 출전 칸 누르기'}
          </p>
          <ul
            className="idle-cat-grid"
            aria-label={`고양이 인벤토리 · 동료 ${(idle?.cats ?? []).length}종`}
          >
            {Array.from(
              { length: Math.max(18, Math.ceil((idle?.cats ?? []).length / COLUMNS) * COLUMNS) },
              (_, i) => sorted[i] ?? null,
            ).map((c, i) =>
              c ? (
                <li key={c.code}>
                  <button
                    type="button"
                    className={`idle-cat-cell ${c.level > 0 ? 'owned' : ''} ${c.fielded ? 'fielded' : ''} ${picked === c.code ? 'is-picked' : ''}`}
                    data-testid="cat"
                    data-code={c.code}
                    data-grade={c.grade}
                    disabled={c.level < 1}
                    aria-label={
                      c.level > 0
                        ? `${c.grade} 등급 ${c.name} 레벨 ${c.level}${c.fielded ? ' 출전 중' : ''} · ${skillLabel(c)}`
                        : `${c.grade} 등급 ${c.name} 아직 없음 · ${skillLabel(c)}`
                    }
                    onPointerDown={busy || c.level < 1 || c.fielded ? undefined : down(c.code)}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={(event) => {
                      if (!consumeClick(event.detail)) pick(c.code)
                    }}
                  >
                    <Portrait code={c.code} locked={c.level < 1} />
                    {/* 고유 스킬 (531번): 못 가진 고양이의 스킬은 흑백에 자물쇠다. */}
                    {c.skills.length > 0 && (
                      <span className="idle-cat-badge">
                        {c.skills.map((skill) => (
                          <SkillBadge
                            key={skill.code}
                            skill={skill.code}
                            level={c.skillLevel}
                            size={c.skills.length > 1 ? 15 : 18}
                            locked={c.level < 1}
                          />
                        ))}
                      </span>
                    )}
                    <em
                      className={`idle-cat-grade idle-cat-grade-tag is-${c.grade} ${c.level < 1 ? 'is-locked' : ''}`}
                    >
                      {c.grade}
                    </em>
                    {c.level > 0 && <i>Lv.{c.level}</i>}
                  </button>
                </li>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: 빈 칸은 자리 번호가 곧 열쇠다.
                <li key={i} className="idle-cat-cell-empty" />
              ),
            )}
          </ul>
        </>
      )}
      {drag &&
        createPortal(
          <div
            className="idle-gear-ghost"
            style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
            aria-hidden="true"
          >
            <Portrait code={drag.item} />
          </div>,
          document.body,
        )}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
