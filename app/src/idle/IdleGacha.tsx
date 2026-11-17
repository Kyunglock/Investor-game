import type { Company } from '@web/api/client'
import { DiamondPrice } from '@web/features/raising/DiamondIcon'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { sfx } from '../fx/sound'
import { drawBadge, TEN } from '../mental/armory'
import { GunSprite } from '../mental/GunSprite'
import { TenBonus, type TenCard, TenReveal } from '../mental/TenReveal'
import { type DrawResult, WeaponReveal } from '../mental/WeaponReveal'
import { shinyWeapon, weaponRevealPlan } from '../mental/weaponRevealPlan'
import { CatPortrait as Portrait } from './CatPortrait'
import { type CatDraw, CatReveal } from './CatReveal'
import { CAT_ODDS, catRevealPlan, shinyCat } from './catGrade'
import { RewardPlacement } from './RewardPlacement'
import { skillNames } from './skills'

type Kind = 'cat' | 'weapon'

/**
 * 뽑기 (decisions.md 508·517·526·530번): 고양이 뽑기와 무기 뽑기를 한 자리에서 고른다. 상점 탭에 있다(541번). 둘 다 다이아로 뽑고 값도 같다(한 번 draw, 10연차는
 * tenDraw에 tenCount개). 상자가 떨다 열리는 연출도 같다. 결과는 서버 응답의 스냅샷이다.
 */
export function IdleGacha({
  company,
  onCat,
  initialKind,
  onUse,
}: {
  company: Company
  /** 처음 보일 뽑기. 무기 탭에서 오면 무기 뽑기다 (540번). */
  initialKind?: Kind
  onUse?: (kind: Kind, code: CatCode | null) => void
  /** 고양이를 뽑았다. */
  onCat: (code: CatCode) => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const [kind, setKind] = useState<Kind>(initialKind ?? 'cat')
  const [catReveal, setCatReveal] = useState<{ id: number; result: CatDraw | null } | null>(null)
  const [gunReveal, setGunReveal] = useState<{ id: number; result: DrawResult | null } | null>(null)
  const [ten, setTen] = useState<{ id: number; kind: Kind; cards: TenCard[] | null } | null>(null)
  const [drawn, setDrawn] = useState<CatDraw | null>(null)
  const drawing = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const idle = company.idle
  // 뽑기 값은 서버가 준다 (526번).
  const diamonds = company.diamonds
  const ready = kind === 'cat' ? Boolean(idle) : Boolean(company.armory)
  const canOne = ready && diamonds.amount >= diamonds.draw
  const canTen = ready && diamonds.amount >= diamonds.tenDraw
  const showing = Boolean(catReveal || gunReveal || ten)
  /** 한 번에 하나만 뽑는다. 뽑는 동안 화면이 닫혀도 끝까지 간다. */
  const once = async (can: boolean, run: (id: number) => Promise<void>, fail: () => void) => {
    if (drawing.current || useRaisingStore.getState().busy || !can) return
    drawing.current = true
    sfx.stamp()
    try {
      await run(Date.now())
    } catch {
      if (mounted.current) fail()
    } finally {
      drawing.current = false
    }
  }
  const drawCat = () =>
    once(
      canOne,
      async (id) => {
        setCatReveal({ id, result: null })
        const after = await useRaisingStore.getState().drawCat()
        const got = after?.idle?.cats.find(
          (c) => c.level !== idle?.cats.find((old) => old.code === c.code)?.level,
        )
        if (!mounted.current) return
        if (!got) {
          setCatReveal(null)
          return
        }
        const result = { cat: got, isNew: got.level === 1 }
        setCatReveal({ id, result })
        setDrawn(result)
        onCat(got.code)
      },
      () => setCatReveal(null),
    )
  // 10연차 (517·526번): 한 번에 tenCount마리. 같은 고양이가 또 나오면 차례로 레벨이 오른다.
  const drawTenCats = () =>
    once(
      canTen,
      async (id) => {
        setCatReveal(null)
        setTen({ id, kind: 'cat', cards: null })
        const after = await useRaisingStore.getState().drawCat(TEN)
        if (!mounted.current) return
        const draws = after?.idle?.lastDraws ?? []
        const cats = after?.idle?.cats ?? []
        if (draws.length < 1) {
          setTen(null)
          return
        }
        setTen({
          id,
          kind: 'cat',
          cards: draws.map((d, i) => {
            const plan = catRevealPlan(d.grade, d.isNew)
            const info = cats.find((c) => c.code === d.code)
            return {
              key: `${i}-${d.code}`,
              art: <Portrait code={d.code} />,
              badge: `${d.grade} 등급 · Lv.${d.level}`,
              name: info?.name ?? d.code,
              note: d.isNew ? 'NEW!' : '레벨 업',
              isNew: d.isNew,
              color: plan.color,
              power: plan.power,
              sound: plan.sound,
              shiny: shinyCat(d.grade),
            }
          }),
        })
        const last = cats.find((c) => c.code === draws[draws.length - 1].code)
        if (last) {
          setDrawn({ cat: last, isNew: draws.some((d) => d.code === last.code && d.isNew) })
          onCat(last.code)
        }
      },
      () => setTen(null),
    )
  const drawWeapon = () =>
    once(
      canOne,
      async (id) => {
        setGunReveal({ id, result: null })
        await useRaisingStore.getState().drawWeapon()
        const state = useRaisingStore.getState()
        const last = state.company?.armory?.lastDraw
        const weapon = state.company?.weapons?.find(
          (w) => w.kind === last?.kind && w.grade === last.grade,
        )
        if (mounted.current)
          setGunReveal(
            !state.error && last && weapon ? { id, result: { draw: last, weapon } } : null,
          )
      },
      () => setGunReveal(null),
    )
  const drawTenWeapons = () =>
    once(
      canTen,
      async (id) => {
        setGunReveal(null)
        setTen({ id, kind: 'weapon', cards: null })
        await useRaisingStore.getState().drawWeapon(TEN)
        const state = useRaisingStore.getState()
        const draws = state.company?.armory?.lastDraws ?? []
        if (!mounted.current) return
        setTen(
          !state.error && draws.length > 0
            ? {
                id,
                kind: 'weapon',
                cards: draws.map((d, i) => {
                  const plan = weaponRevealPlan(d.grade)
                  return {
                    key: `${i}-${d.kind}-${d.grade}`,
                    art: <GunSprite kind={d.kind} grade={d.grade} width={58} />,
                    badge: `${d.gradeName} 등급`,
                    name: d.name,
                    note: d.isNew ? 'NEW!' : '재료 +1',
                    isNew: d.isNew,
                    color: plan.color,
                    power: plan.power,
                    sound: d.grade,
                    shiny: shinyWeapon(d.grade),
                  }
                }),
              }
            : null,
        )
      },
      () => setTen(null),
    )
  const badge = drawBadge(company)
  const short = '다이아가 모자라요 · 출석·시즌패스·상점에서 얻어요'
  const note =
    kind === 'cat'
      ? drawn
        ? drawn.isNew
          ? `${drawn.cat.grade} 등급 ${drawn.cat.name} 합류!${drawn.cat.skills.length > 0 ? ` 고유 스킬 ${skillNames(drawn.cat)}` : ''}`
          : `${drawn.cat.name} Lv.${drawn.cat.level} · 화력 ${drawn.cat.damagePercent}%${drawn.cat.skills.length > 0 ? ` · ${skillNames(drawn.cat)} Lv.${drawn.cat.skillLevel}` : ''}`
        : canOne
          ? `${CAT_ODDS} · 또 나오면 레벨 업 · 10연차는 ${diamonds.tenCount}마리`
          : short
      : canOne
        ? `F~A 등급이 나와요 · S부터는 합쳐서 얻어요 · 10연차는 ${diamonds.tenCount}개`
        : short
  return (
    <>
      <section className="idle-gacha" data-testid="cat-gacha" data-kind={kind}>
        <div className="idle-gacha-kinds" role="tablist" aria-label="뽑기 종류">
          {(['cat', 'weapon'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              className="idle-gacha-kind"
              aria-selected={kind === k}
              data-testid={`draw-kind-${k}`}
              onClick={() => {
                sfx.tap()
                setKind(k)
              }}
            >
              {k === 'cat' ? '고양이 뽑기' : '무기 뽑기'}
              {/* 무기 뽑기 배지 (526번): 가진 다이아로 뽑을 수 있는 횟수. */}
              {k === 'weapon' && badge && (
                <b className="idle-tab-badge" data-testid="weapon-draw-badge">
                  <span className="sr-only">뽑을 수 있는 횟수 </span>
                  {badge}
                </b>
              )}
            </button>
          ))}
        </div>
        <div className="idle-gacha-machine" aria-hidden="true">
          <div className="idle-gacha-window">
            {kind === 'cat' ? (
              <>
                <div className="idle-gacha-capsule">
                  <Portrait code="sky" />
                </div>
                <div className="idle-gacha-capsule">
                  <Portrait code="mint" />
                </div>
                <div className="idle-gacha-capsule">
                  <Portrait code="lilac" />
                </div>
              </>
            ) : (
              <>
                <div className="idle-gacha-capsule">
                  <GunSprite kind="pistol" grade="F" width={64} />
                </div>
                <div className="idle-gacha-capsule">
                  <GunSprite kind="rifle" grade="C" width={76} />
                </div>
                <div className="idle-gacha-capsule">
                  <GunSprite kind="shotgun" grade="A" width={64} />
                </div>
              </>
            )}
          </div>
          <p>{kind === 'cat' ? '새로운 동료를 만나보세요!' : '나만의 무기를 찾아보세요!'}</p>
        </div>
        <div className="idle-gacha-row">
          <small className="idle-gacha-note" data-testid="draw-note">
            {note}
          </small>
          <button
            type="button"
            className="idle-buy"
            data-testid={kind === 'cat' ? 'cat-draw' : 'weapon-draw'}
            disabled={showing || busy || !canOne}
            onClick={() => void (kind === 'cat' ? drawCat() : drawWeapon())}
          >
            1회 뽑기
            <small>
              <DiamondPrice amount={diamonds.draw} />
            </small>
          </button>
          <button
            type="button"
            className="idle-buy idle-buy-ten"
            data-testid={kind === 'cat' ? 'cat-draw-ten' : 'weapon-draw-ten'}
            disabled={showing || busy || !canTen}
            onClick={() => void (kind === 'cat' ? drawTenCats() : drawTenWeapons())}
          >
            10연차
            <TenBonus count={diamonds.tenCount} />
            <small>
              <DiamondPrice amount={diamonds.tenDraw} />
            </small>
          </button>
        </div>
      </section>
      {ten && (
        <TenReveal
          key={ten.id}
          label={ten.kind === 'cat' ? '고양이 10연차' : '무기 10연차'}
          testId={ten.kind === 'cat' ? 'cat-ten' : 'weapon-ten'}
          icon={ten.kind === 'cat' ? '🐾' : '★'}
          loading={
            ten.kind === 'cat'
              ? `고양이 ${diamonds.tenCount}마리를 데려오는 중…`
              : `무기 ${diamonds.tenCount}개를 가져오는 중…`
          }
          cards={ten.cards}
          canAgain={canTen}
          againNote={<DiamondPrice amount={diamonds.tenDraw} />}
          useAction={
            onUse ? (
              <button
                type="button"
                onClick={() => {
                  setTen(null)
                  onUse(ten.kind, drawn?.cat.code ?? null)
                }}
              >
                {ten.kind === 'cat' ? '팀 편성하기' : '무기 장착·합성하기'}
              </button>
            ) : undefined
          }
          onClose={() => setTen(null)}
          onAgain={() => void (ten.kind === 'cat' ? drawTenCats() : drawTenWeapons())}
        />
      )}
      {catReveal && (
        <CatReveal
          key={catReveal.id}
          result={catReveal.result}
          price={diamonds.draw}
          canAgain={canOne}
          useAction={
            catReveal.result && onUse ? (
              <RewardPlacement
                company={company}
                reward={{ cat: catReveal.result.cat.code }}
                onDone={(code) => {
                  setCatReveal(null)
                  onUse('cat', code)
                }}
              />
            ) : undefined
          }
          onClose={() => setCatReveal(null)}
          onAgain={() => void drawCat()}
        />
      )}
      {gunReveal && (
        <WeaponReveal
          key={gunReveal.id}
          result={gunReveal.result}
          price={diamonds.draw}
          canAgain={canOne}
          useAction={
            gunReveal.result && onUse ? (
              <RewardPlacement
                company={company}
                reward={{ weapon: gunReveal.result.weapon }}
                onDone={(code) => {
                  setGunReveal(null)
                  onUse('weapon', code)
                }}
              />
            ) : undefined
          }
          onClose={() => setGunReveal(null)}
          onAgain={() => void drawWeapon()}
        />
      )}
    </>
  )
}
