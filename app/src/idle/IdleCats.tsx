import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { BOSS_NAME, GRADE_BADGE, mergeable } from '../mental/armory'
import { GunSprite } from '../mental/GunSprite'
import { DEFAULT_WEAPON, heroOf, type Weapon } from '../mental/hero'
import { FIRE_STYLE_NAMES, WEAPON_EFFECTS } from '../mental/weaponEffects'
import { CatBakery } from './CatBakery'
import { CatGear } from './CatGear'
import { catTrait, CatPortrait as Portrait } from './CatPortrait'
import { CatRosterGrid } from './CatRosterGrid'
import { CompanionSkills } from './CompanionSkills'
import { sortCats } from './catGrade'
import { fieldSteps, recommendParty } from './party'
import { SkillBadge } from './SkillBadge'
import { fieldSeats } from './seats'
import { skillNames } from './skills'
import { useLoadoutDrag } from './useLoadoutDrag'

export type LoadoutTab = '고양이' | '무기' | '식빵 공방'

type Cat = NonNullable<Company['idle']>['cats'][number]

/**
 * 고양이 메뉴 (decisions.md 488·491·493·530·571번): 위의 출전 칸 넷에 세우고, 아래는 가진 고양이의 인벤토리 격자다. 고양이를 누르면 그
 * 고양이의 등급·고유 스킬 설명과 든 무기가 나온다 (501번). 무기는 같은 패널에서 바꾸고 뽑기는 상점 탭이다(541번). 결과는 서버가 정한다.
 * 무기 탭을 여기에 합쳤다 (560번): 든 무기를 누르면 고양이 목록 자리에 장비 목록이 펴져 들리고 합친다.
 */
export function IdleCats({
  company,
  picked,
  onPick,
  tab,
  onTab,
  onSkills,
}: {
  company: Company
  /** 메뉴를 오가도 선택한 고양이를 유지한다. null은 사장냥이다. */
  picked: CatCode | null
  onPick: (code: CatCode | null) => void
  onSkills?: () => void
  tab: LoadoutTab
  onTab: (tab: LoadoutTab) => void
}) {
  const gearOpen = tab === '무기'
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  // 고른 고양이. null이면 사장냥이다.
  const setPicked = onPick
  const idle = company.idle
  const hero = heroOf(company)
  // 사장냥이 무기를 뺐다 (585번): 든 무기가 없어 기본 권총을 쏜다.
  const bossBare = !(company.weapons ?? []).some((w) => w.equipped)
  const same = (w: Weapon, held: Cat['weapon']) => w.kind === held?.kind && w.grade === held.grade
  const fielded = (idle?.cats ?? []).filter((cat) => cat.fielded)
  // 출전 칸 (599번): 고양이는 놓은 칸에 그대로 선다. 사이에 빈 칸이 있을 수 있다.
  const seats = fieldSeats(idle?.cats ?? [], idle?.fieldSlots ?? 0)
  // 인벤토리: 가진 고양이를 등급순으로 먼저, 없는 고양이를 등급순으로 뒤에.
  const sorted = sortCats(idle?.cats ?? [])
  const cat = (idle?.cats ?? []).find((c) => c.code === picked && c.level > 0) ?? null
  const bakers = sorted.filter((c) => c.level > 0 && !c.fielded)
  const full = fielded.length >= (idle?.fieldSlots ?? 0)
  // 교체 (#910): 출전 칸이 다 찼을 때 쉬는 고양이를 세우려면 뺄 고양이를 출전 칸에서 고른다. 사장냥은 출전 칸이 아니라 고를 수 없다.
  // 누구를 세우려는지 적어 둔다: 밖에서 다른 고양이를 골라 주거나 교체가 끝나 그 고양이가 출전하면 저절로 풀린다.
  const [swapFor, setSwapFor] = useState<CatCode | null>(null)
  // 고른 고양이의 설명은 목록을 내려도 출전 칸 바로 아래에 붙는다 (654번): 출전 칸 높이를 재어 그 아래에 세운다.
  // 시트가 고양이 칸을 스크롤해 보일 때 고정된 두 칸 아래로 오도록 스크롤 여백도 그 높이로 맞춘다(끌어 놓기가 설명창에 막히지 않게).
  const team = useRef<HTMLDivElement>(null)
  const detail = useRef<HTMLElement>(null)
  const [teamHeight, setTeamHeight] = useState(0)
  const sticky = tab !== '식빵 공방'
  useEffect(() => {
    const el = team.current
    if (!sticky || !el || typeof ResizeObserver === 'undefined') return
    const scroller = el.parentElement
    const measure = () => {
      setTeamHeight(el.offsetHeight)
      const pinned = detail.current && getComputedStyle(detail.current).position === 'sticky'
      if (scroller)
        scroller.style.scrollPaddingTop = pinned
          ? `${el.offsetHeight + (detail.current?.offsetHeight ?? 0) + 8}px`
          : ''
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    if (detail.current) observer.observe(detail.current)
    return () => {
      observer.disconnect()
      if (scroller) scroller.style.scrollPaddingTop = ''
    }
  }, [sticky])
  // 추천 편성 (654번): 팀 화력의 어림이 가장 큰 고양이들로 출전 칸을 바꾼다.
  const recommended = recommendParty(company)
  const alreadyBest =
    recommended.length === fielded.length &&
    recommended.every((code) => fielded.some((c) => c.code === code))
  const [arranging, setArranging] = useState(false)
  const applyRecommended = async () => {
    if (arranging) return
    setArranging(true)
    sfx.tap()
    try {
      const store = useRaisingStore.getState()
      const cats = store.company?.idle?.cats ?? []
      const steps = fieldSteps(cats, store.company?.idle?.fieldSlots ?? 0, recommended)
      for (const step of steps) {
        await store.fieldCat(
          step.code as CatCode,
          step.fielded,
          step.replaceCode as CatCode | undefined,
        )
        if (useRaisingStore.getState().error) break
      }
      if (!useRaisingStore.getState().error) haptic.light()
    } finally {
      setArranging(false)
    }
  }
  const swapping = cat !== null && !cat.fielded && full && swapFor === cat.code
  const gun = cat
    ? (company.weapons?.find((w) => same(w, cat.weapon)) ?? DEFAULT_WEAPON)
    : hero.weapon
  const pick = (code: CatCode | null) => {
    sfx.tap()
    setSwapFor(null)
    setPicked(code)
  }
  const place = async (code: CatCode, target: string) => {
    const store = useRaisingStore.getState()
    if (store.busy) return
    const cats = store.company?.idle?.cats ?? []
    const c = cats.find((c) => c.code === code)
    if (!c || target === `slot:${code}`) return
    const now = fieldSeats(cats, store.company?.idle?.fieldSlots ?? 0)
    // 놓은 칸의 번호 (599번): 빈 칸은 이름에 번호가 있고, 찬 칸은 그 고양이가 선 칸이다.
    const at = target.startsWith('slot:empty')
      ? Number(target.slice(10))
      : now.findIndex((seat) => seat?.code === target.slice(5))
    if (at < 0) return
    // 쉬던 고양이를 찬 칸에 놓으면 그 고양이와 교체하고, 그 밖에는(빈 칸, 출전 중인 고양이 옮기기·맞바꾸기) 칸 번호로 세운다.
    if (!c.fielded && now[at]) await store.fieldCat(code, true, now[at].code as CatCode)
    else await store.fieldCat(code, true, undefined, at)
    if (!useRaisingStore.getState().error) {
      onPick(code)
      haptic.light()
      sfx.tap()
    }
  }
  const accepts = (code: CatCode, target: string) =>
    !busy && target.startsWith('slot:') && target !== `slot:${code}`
  const { drag, down, consumeClick } = useLoadoutDrag<CatCode>(accepts, (code, target) => {
    void place(code, target)
  })
  /**
   * 장비 해제 (575번): 고양이가 든 무기를 무기 칸에서 집어 아래(고양이 정보·목록 쪽)로 내려놓으면 뺀다. 장비 목록의 칸 위에 놓아도 같다.
   * 무기 칸은 스크롤하지 않으므로 어느 쪽으로 움직여도 바로 집힌다. 사장냥의 무기도 같은 방식으로 뺀다 (585번).
   */
  const takeOff = async (code: CatCode | 'boss') => {
    const store = useRaisingStore.getState()
    if (store.busy) return
    await (code === 'boss' ? store.unequipWeapon() : store.equipCat(code, null))
    if (!useRaisingStore.getState().error) {
      haptic.light()
      sfx.tap()
    }
  }
  const gunDrag = useLoadoutDrag<CatCode | 'boss'>(
    (_code, target) => !busy && (target === 'unequip' || target.startsWith('gear:')),
    (code) => void takeOff(code),
    { anyDirection: true },
  )
  const weaponOf = (c: Cat) => company.weapons?.find((w) => same(w, c.weapon)) ?? DEFAULT_WEAPON
  const draggedCat = (idle?.cats ?? []).find((c) => c.code === gunDrag.drag?.item)
  const draggedGun =
    gunDrag.drag?.item === 'boss' ? hero.weapon : draggedCat ? weaponOf(draggedCat) : undefined
  const gearLocked = (idle?.onboarding?.step ?? 8) < 5
  const canMerge = mergeable(company).length > 0
  /**
   * 무기 칸 (569번): 바로 위 고양이(code가 null이면 사장냥)가 드는 무기. 장비 목록에서 무기를 끌어 놓으면 그 고양이가 장착하고, 누르면 그
   * 고양이의 장비 목록이 펴진다. 든 무기가 없으면 기본 권총을 흐리게 보인다.
   */
  const gunSlot = (code: CatCode | null, name: string, held: Weapon, bare: boolean) => (
    <button
      type="button"
      className={`idle-gun-slot ${bare ? 'is-bare' : ''} ${gearOpen && picked === code ? 'is-picked' : ''} ${bare ? '' : 'is-held'} ${gunDrag.drag?.item === (code ?? 'boss') ? 'is-lifted' : ''}`}
      data-testid="gun-slot"
      data-code={code ?? 'boss'}
      data-kind={held.kind}
      data-grade={held.grade}
      data-loadout-target={`wearer:${code ?? 'boss'}`}
      aria-label={`${name}의 무기 ${bare ? '기본 권총' : `${held.name} ${held.gradeName}`} · 눌러서 바꾸기${bare ? '' : ' · 아래로 끌어 빼기'}`}
      // 기본 권총은 뺄 수 없다. 사장냥의 무기도 고양이와 같이 뺀다 (585번).
      onPointerDown={!bare && !busy ? gunDrag.down(code ?? 'boss') : undefined}
      onClick={(event) => {
        if (gunDrag.consumeClick(event.detail)) return
        pick(code)
        if (!gearOpen) onTab('무기')
      }}
    >
      <GunSprite kind={held.kind} grade={held.grade} width={38} />
      <i className={`idle-grade idle-gun-slot-grade ${GRADE_BADGE[held.grade]}`}>
        {bare ? '기본' : held.gradeName}
      </i>
    </button>
  )
  const tabs = (
    <div className="idle-gacha-kinds loadout-tabs" role="tablist" aria-label="편성 목록">
      {(['고양이', '무기', '식빵 공방'] as const).map((label) => (
        <button
          key={label}
          type="button"
          role="tab"
          className="idle-gacha-kind"
          aria-selected={tab === label}
          disabled={label === '무기' && gearLocked}
          onClick={() => {
            sfx.tap()
            onTab(label)
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
  if (tab === '식빵 공방')
    return (
      <>
        <div className="loadout-team">{tabs}</div>
        <CatBakery idle={idle} bakers={bakers} />
      </>
    )
  return (
    <>
      <div className="loadout-team" ref={team}>
        {tabs}
        <p className="idle-subtitle idle-team-line">
          {swapping ? (
            <span className="idle-swap-hint" role="status" data-testid="swap-hint">
              {cat.name} 대신 뺄 고양이를 누르세요 · 사장냥은 못 빼요
            </span>
          ) : (
            <span>
              출전 {fielded.length} / {idle?.fieldSlots ?? 0} · 윗줄은 고양이, 아랫줄은 그 고양이의
              무기
              {recommended.length > 0 && !gearLocked && (idle?.onboarding?.step ?? 8) >= 8 && (
                <button
                  type="button"
                  className="loadout-recommend"
                  data-testid="field-recommend"
                  disabled={busy || arranging || alreadyBest}
                  title="팀 화력(총·스킬의 초당 피해 어림)이 가장 큰 고양이들로 출전 칸을 바꿔요"
                  onClick={() => void applyRecommended()}
                >
                  {alreadyBest ? '추천 편성됨' : arranging ? '편성 중…' : '추천 편성'}
                </button>
              )}
            </span>
          )}
        </p>
        {/* 출전 칸 (569번): 다섯 칸 두 줄. 윗줄은 고양이 칸, 아랫줄은 바로 위 고양이가 드는 무기 칸이다. 이름은 적지 않는다. */}
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
            {gunSlot(null, BOSS_NAME, hero.weapon, bossBare)}
          </li>
          {seats.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 출전 칸은 자리 번호가 곧 열쇠다.
            <li key={i}>
              {c ? (
                <button
                  type="button"
                  className={`idle-cat-slot ${picked === c.code ? 'is-picked' : ''} ${drag?.item === c.code ? 'is-lifted' : ''} ${drag || swapping ? 'is-drop-ready' : ''} ${drag?.over === `slot:${c.code}` ? 'is-drop-over' : ''}`}
                  data-testid="cat-slot"
                  data-loadout-target={`slot:${c.code}`}
                  data-code={c.code}
                  aria-label={`출전 ${i + 1}번 ${c.name} · ${swapping ? '눌러서 교체' : '꾹 눌러 끌어서 자리 옮기기'}`}
                  // 출전 중인 고양이도 집어 다른 칸에 놓아 자리를 옮긴다 (599번).
                  onPointerDown={busy ? undefined : down(c.code)}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={(event) => {
                    if (consumeClick(event.detail)) return
                    if ((swapping || !gearOpen) && cat && !cat.fielded)
                      void place(cat.code, `slot:${c.code}`)
                    else pick(c.code)
                  }}
                >
                  <Portrait grade={c.grade} code={c.code} />
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
                  <i className="idle-cat-slot-lv" data-testid="cat-slot-level">
                    Lv.{c.level}
                  </i>
                </button>
              ) : (
                <button
                  type="button"
                  className={`idle-cat-empty ${drag ? 'is-drop-ready' : ''} ${drag?.over === `slot:empty${i}` ? 'is-drop-over' : ''}`}
                  data-loadout-target={`slot:empty${i}`}
                  disabled={busy}
                  onClick={() => {
                    if (cat) void place(cat.code, `slot:empty${i}`)
                  }}
                  data-testid="cat-slot"
                  aria-label="빈 출전 칸에 선택한 고양이 세우기"
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
          ))}
        </ul>
      </div>
      {/* 무기를 집어 이 아래 어디에든 내려놓으면 뺀다 (575번). 틀만 두르고 배치는 바꾸지 않는다(display: contents). */}
      <div
        className={`loadout-unequip ${gunDrag.drag ? 'is-drop-ready' : ''} ${gunDrag.drag?.over ? 'is-drop-over' : ''}`}
        data-loadout-target="unequip"
        data-testid="unequip-zone"
      >
        {gunDrag.drag && (
          <p className="loadout-unequip-hint" role="status" data-testid="unequip-hint">
            {gunDrag.drag.over ? '놓으면 무기를 빼요' : '아래로 내려놓으면 무기를 빼요'}
          </p>
        )}
        <article
          className="idle-cat owned"
          data-testid="cat-detail"
          data-code={cat?.code ?? 'boss'}
          ref={detail}
          style={teamHeight ? { top: teamHeight - 6 } : undefined}
        >
          <Portrait code={cat?.code} grade={cat?.grade} />
          {/* 고양이 정보(등급·레벨·공격 특성)는 스킬 탭에서 본다 (658번): 여기는 이름과 편성 단추만 남긴다. 스킬 탭이 열리기 전에는 여기서 본다. */}
          <div className="idle-cat-info">
            <b>
              {cat && !onSkills && (
                <i className={`idle-cat-grade is-${cat.grade}`} data-testid="cat-grade">
                  {cat.grade}
                </i>
              )}{' '}
              {cat ? cat.name : hero.name} {cat && !onSkills && <small>Lv.{cat.level}</small>}
            </b>
            {!onSkills && (
              <small>
                {cat
                  ? `무기 공격력의 ${cat.damagePercent}%로 쏴요 · ${catTrait(cat)}`
                  : '늘 맨 앞에서 싸워요 · 출전은 뺄 수 없어요 · 무기는 바꾸거나 뺄 수 있어요'}
              </small>
            )}
          </div>
          {cat && !cat.fielded && full ? (
            <button
              type="button"
              className="idle-cat-field"
              data-testid="cat-swap"
              disabled={busy}
              onClick={() => {
                sfx.tap()
                setSwapFor(swapping ? null : cat.code)
              }}
            >
              {swapping ? '취소' : '교체'}
            </button>
          ) : cat ? (
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
          ) : (
            <span className="idle-cat-field idle-cat-always">늘 출전</span>
          )}
          {onSkills ? (
            <button type="button" className="cat-skills-link" onClick={onSkills}>
              {cat?.name ?? hero.name} 정보·스킬 보기
            </button>
          ) : (
            cat && (
              <details>
                <summary>고유 스킬 · {skillNames(cat) || '없음'}</summary>
                <CompanionSkills cat={cat} />
              </details>
            )
          )}
          <button
            type="button"
            className="idle-cat-gun"
            data-testid="cat-gun"
            disabled={gearLocked}
            onClick={() => {
              sfx.tap()
              onTab(gearOpen ? '고양이' : '무기')
            }}
          >
            <GunSprite kind={gun.kind} grade={gun.grade} width={40} />
            <span className="idle-gun-text">
              {(cat ? !cat.weapon : bossBare) ? '기본 권총' : gun.name}{' '}
              <i className={`idle-grade ${GRADE_BADGE[gun.grade]}`}>{gun.gradeName}</i>
              <small className="idle-gun-note">
                {FIRE_STYLE_NAMES[gun.kind]} · {WEAPON_EFFECTS[gun.kind].name}
              </small>
            </span>
            <em className="idle-gun-open">
              {gearLocked ? '무기 안내 후 해금' : gearOpen ? '고양이 목록 ▾' : '무기 변경 ▸'}
              {canMerge && (
                <i className="idle-gun-dot" role="img" aria-label="합칠 수 있는 무기 있음" />
              )}
            </em>
          </button>
        </article>
        {gearOpen ? (
          <CatGear company={company} wearer={cat} onSelect={onPick} />
        ) : (
          <>
            <p className="loadout-hint" aria-live="polite">
              {drag?.over
                ? drag.over.startsWith('slot:empty')
                  ? '놓으면 이 칸에 서요'
                  : '놓으면 이 칸의 고양이와 바꿔요'
                : '집어서 끌어 출전 칸에 놓기 · 출전 칸의 고양이는 꾹 눌러 끌어 자리 바꾸기'}
            </p>
            <CatRosterGrid
              cats={sorted}
              picked={picked}
              onPick={pick}
              down={busy ? undefined : down}
              consumeClick={consumeClick}
            />
          </>
        )}
      </div>
      {gunDrag.drag &&
        draggedGun &&
        createPortal(
          <div
            className="idle-gear-ghost"
            style={{ transform: `translate(${gunDrag.drag.x}px, ${gunDrag.drag.y}px)` }}
            aria-hidden="true"
          >
            <GunSprite kind={draggedGun.kind} grade={draggedGun.grade} width={46} />
          </div>,
          document.body,
        )}
      {drag &&
        createPortal(
          <div
            className="idle-gear-ghost"
            style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
            aria-hidden="true"
          >
            <Portrait code={drag.item} grade={sorted.find((c) => c.code === drag.item)?.grade} />
          </div>,
          document.body,
        )}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
