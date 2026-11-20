import type { Company } from '@web/api/client'
import { DiamondPrice } from '@web/features/raising/DiamondIcon'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { AD_UNAVAILABLE, watchRewardedAd } from '../app/ads'
import { sfx } from '../fx/sound'
import { TEN } from '../mental/armory'
import { GunSprite } from '../mental/GunSprite'
import { TenBonus, type TenCard, TenReveal } from '../mental/TenReveal'
import { type DrawResult, WeaponReveal } from '../mental/WeaponReveal'
import { shinyWeapon, weaponRevealPlan } from '../mental/weaponRevealPlan'
import { CatPortrait as Portrait } from './CatPortrait'
import { type CatDraw, CatReveal } from './CatReveal'
import { bestDraw, CAT_ODDS, catRevealPlan, shinyCat } from './catGrade'
import { RewardPlacement } from './RewardPlacement'
import { ShopIcon } from './ShopIcon'
import { skillNames } from './skills'

type Kind = 'cat' | 'weapon'

/** 상점의 고양이·무기 뽑기. 다이아 1회·10회 연속(639번) 또는 종류별 하루 3회의 광고 뽑기를 제공한다. */
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
  const [watching, setWatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drawn, setDrawn] = useState<CatDraw | null>(null)
  const [tutorialReveal, setTutorialReveal] = useState(false)
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
  const tutorialStep = idle?.onboarding?.step
  const tutorialDraw =
    (kind === 'cat' && tutorialStep === 2) || (kind === 'weapon' && tutorialStep === 4)
  const awaitingTutorialDraw = tutorialStep === 2 || tutorialStep === 4
  const canOne =
    ready && (tutorialDraw || (!awaitingTutorialDraw && diamonds.amount >= diamonds.draw))
  // 10회 연속 (639번): 안내 중에는 없다.
  const canTen = ready && !awaitingTutorialDraw && diamonds.amount >= diamonds.tenDraw
  const adLeft = (kind === 'cat' ? company.adDraws?.catLeft : company.adDraws?.weaponLeft) ?? 0
  const canAd = ready && adLeft > 0 && !awaitingTutorialDraw && !tutorialReveal
  const showing = Boolean(catReveal || gunReveal || ten)
  /** 한 번에 하나만 뽑는다. 뽑는 동안 화면이 닫혀도 끝까지 간다. */
  const once = async (can: boolean, run: (id: number) => Promise<void>, fail: () => void) => {
    if (drawing.current || useRaisingStore.getState().busy || !can) return
    drawing.current = true
    setError(null)
    sfx.stamp()
    try {
      await run(Date.now())
    } catch {
      if (mounted.current) {
        fail()
        setError('뽑기를 완료하지 못했어요. 다시 시도해 주세요.')
      }
    } finally {
      drawing.current = false
    }
  }
  const watch = async (placement: 'cat-draw' | 'weapon-draw') => {
    setWatching(true)
    try {
      const result = await watchRewardedAd(placement)
      if (!mounted.current) return false
      if (result === 'unavailable') setError(AD_UNAVAILABLE)
      if (result === 'closed') setError('광고를 끝까지 보면 무료로 뽑을 수 있어요.')
      return result === 'rewarded'
    } finally {
      if (mounted.current) setWatching(false)
    }
  }
  const drawCat = (ad = false) =>
    once(
      ad ? canAd : canOne,
      async (id) => {
        if (ad && !(await watch('cat-draw'))) return
        setTutorialReveal(tutorialDraw)
        setCatReveal({ id, result: null })
        if (tutorialDraw) await useRaisingStore.getState().tutorial('draw-cat', 2)
        const after = tutorialDraw
          ? useRaisingStore.getState().company
          : await useRaisingStore.getState().drawCat(ad)
        const got = after?.idle?.cats.find((c) =>
          tutorialDraw
            ? c.code === 'night'
            : c.level !== idle?.cats.find((old) => old.code === c.code)?.level,
        )
        if (!mounted.current) return
        if (!got || useRaisingStore.getState().error) {
          setCatReveal(null)
          setError(useRaisingStore.getState().error ?? '뽑기를 완료하지 못했어요.')
          return
        }
        const result = { cat: got, isNew: got.level === 1 }
        setCatReveal({ id, result })
        setDrawn(result)
        onCat(got.code)
      },
      () => setCatReveal(null),
    )
  const drawWeapon = (ad = false) =>
    once(
      ad ? canAd : canOne,
      async (id) => {
        if (ad && !(await watch('weapon-draw'))) return
        setTutorialReveal(tutorialDraw)
        setGunReveal({ id, result: null })
        if (tutorialDraw) await useRaisingStore.getState().tutorial('draw-weapon', 4)
        else await useRaisingStore.getState().drawWeapon(ad)
        const state = useRaisingStore.getState()
        const last = state.company?.armory?.lastDraw
        const weapon = state.company?.weapons?.find(
          (w) => w.kind === last?.kind && w.grade === last.grade,
        )
        if (mounted.current && state.error) setError(state.error)
        if (mounted.current)
          setGunReveal(
            !state.error && last && weapon ? { id, result: { draw: last, weapon } } : null,
          )
      },
      () => setGunReveal(null),
    )
  // 10회 연속 (517·639번): 한 번에 tenCount마리. 같은 고양이가 또 나오면 차례로 레벨이 오른다.
  const drawTenCats = () =>
    once(
      canTen,
      async (id) => {
        setCatReveal(null)
        setTen({ id, kind: 'cat', cards: null })
        const after = await useRaisingStore.getState().drawCat(false, TEN)
        if (!mounted.current) return
        const draws = after?.idle?.lastDraws ?? []
        const cats = after?.idle?.cats ?? []
        if (draws.length < 1 || useRaisingStore.getState().error) {
          setTen(null)
          setError(useRaisingStore.getState().error ?? '뽑기를 완료하지 못했어요.')
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
              jackpot: d.grade === 'S',
            }
          }),
        })
        // 알림과 '팀 편성하기'는 마지막 장이 아니라 가장 좋은 고양이를 가리킨다 (#911).
        const best = bestDraw(draws)
        const cat = cats.find((c) => c.code === best?.code)
        if (best && cat) {
          setDrawn({ cat, isNew: best.isNew })
          onCat(cat.code)
        }
      },
      () => setTen(null),
    )
  const drawTenWeapons = () =>
    once(
      canTen,
      async (id) => {
        setGunReveal(null)
        setTen({ id, kind: 'weapon', cards: null })
        await useRaisingStore.getState().drawWeapon(false, TEN)
        const state = useRaisingStore.getState()
        const draws = state.company?.armory?.lastDraws ?? []
        if (!mounted.current) return
        if (state.error) setError(state.error)
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
                    jackpot: shinyWeapon(d.grade) && d.grade !== 'A',
                  }
                }),
              }
            : null,
        )
      },
      () => setTen(null),
    )
  const note = tutorialDraw
    ? kind === 'cat'
      ? '첫 동료 · A등급 밤냥 확정'
      : '첫 무기 · B등급 기관단총 확정'
    : kind === 'cat'
      ? `${CAT_ODDS} · 또 나오면 레벨 업 · 10회 뽑기는 ${diamonds.tenCount}마리`
      : `F~A 등급이 나와요 · S부터는 합쳐서 얻어요 · 10회 뽑기는 ${diamonds.tenCount}개`
  const resultNote = drawn
    ? drawn.isNew
      ? `${drawn.cat.grade} 등급 ${drawn.cat.name} 합류!${drawn.cat.skills.length > 0 ? ` 고유 스킬 ${skillNames(drawn.cat)}` : ''}`
      : `${drawn.cat.name} Lv.${drawn.cat.level} · 화력 ${drawn.cat.damagePercent}%${drawn.cat.skills.length > 0 ? ` · ${skillNames(drawn.cat)} Lv.${drawn.cat.skillLevel}` : ''}`
    : null
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
              disabled={showing || busy || watching}
              data-testid={`draw-kind-${k}`}
              onClick={() => {
                sfx.tap()
                setKind(k)
              }}
            >
              <ShopIcon kind={k} />
              {k === 'cat' ? '고양이 뽑기' : '무기 뽑기'}
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
        {kind === 'cat' && resultNote && (
          <p className="idle-gacha-note" role="status">
            {resultNote}
          </p>
        )}
        <div className="idle-gacha-row">
          <small className="idle-gacha-note" data-testid="draw-note">
            {note}
          </small>
          <button
            type="button"
            className="idle-buy"
            data-testid={kind === 'cat' ? 'cat-draw' : 'weapon-draw'}
            disabled={showing || busy || watching || !canOne}
            onClick={() => void (kind === 'cat' ? drawCat() : drawWeapon())}
          >
            {tutorialDraw ? '무료 1회 뽑기' : '1회 뽑기'}
            <small>
              {tutorialDraw ? '첫 출근 선물 · 비용 없음' : <DiamondPrice amount={diamonds.draw} />}
            </small>
            {!canOne && (
              <small data-testid="draw-paid-short">
                {awaitingTutorialDraw ? '안내된 뽑기를 선택해 주세요' : '다이아 부족'}
              </small>
            )}
          </button>
          {!awaitingTutorialDraw && (
            <button
              type="button"
              className="idle-buy idle-buy-ten"
              data-testid={kind === 'cat' ? 'cat-draw-ten' : 'weapon-draw-ten'}
              disabled={showing || busy || watching || !canTen}
              onClick={() => void (kind === 'cat' ? drawTenCats() : drawTenWeapons())}
            >
              10회 뽑기
              <TenBonus count={diamonds.tenCount} />
              <small>
                <DiamondPrice amount={diamonds.tenDraw} />
              </small>
              {!canTen && <small>다이아 부족</small>}
            </button>
          )}
          {!awaitingTutorialDraw && (
            <button
              type="button"
              className="idle-buy idle-buy-ad"
              data-testid={kind === 'cat' ? 'cat-draw-ad' : 'weapon-draw-ad'}
              disabled={showing || busy || watching || !canAd}
              onClick={() => void (kind === 'cat' ? drawCat(true) : drawWeapon(true))}
            >
              {watching ? '광고 시청 중…' : adLeft > 0 ? '광고로 1회 뽑기' : '오늘 뽑기 완료'}
              <small>
                오늘 {adLeft} / {company.adDraws?.dailyLimit ?? 3}회 남음
              </small>
            </button>
          )}
        </div>
      </section>

      {!awaitingTutorialDraw && (
        <>
          <p className="idle-gacha-note" data-testid="draw-ad-status">
            {canAd
              ? `광고로 무료 뽑기 가능 · 오늘 ${adLeft}회 남음`
              : '오늘 광고 뽑기 완료 · 한국 시간 자정에 다시 만나요'}
          </p>
          <p className="idle-gacha-note">
            광고 뽑기는 고양이·무기 각각 하루 3회 · 한국 시간 자정 갱신
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {ten && (
        <TenReveal
          key={ten.id}
          label={ten.kind === 'cat' ? '고양이 10회 뽑기' : '무기 10회 뽑기'}
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
                className="ten-reveal-use"
                data-testid={`${ten.kind}-ten-use`}
                onClick={() => {
                  setTen(null)
                  onUse(ten.kind, drawn?.cat.code ?? null)
                }}
              >
                {ten.kind === 'cat' ? '팀 편성하기' : '무기 장착·합성하기'} ▸
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
          canAgain={canOne && !tutorialReveal}
          repeat={
            tutorialReveal
              ? undefined
              : {
                  left: adLeft,
                  limit: company.adDraws?.dailyLimit ?? 3,
                  watching,
                  busy,
                  error,
                  onAd: () => void drawCat(true),
                }
          }
          useAction={
            tutorialReveal ? (
              <div className="weapon-reveal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setCatReveal(null)
                    onUse?.('cat', 'night')
                  }}
                >
                  밤냥 출전시키러 가기
                </button>
              </div>
            ) : catReveal.result && onUse ? (
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
          onClose={() => {
            if (!watching && !busy) {
              setCatReveal(null)
              if (tutorialReveal) onUse?.('cat', 'night')
            }
          }}
          onAgain={() => void drawCat()}
        />
      )}
      {gunReveal && (
        <WeaponReveal
          key={gunReveal.id}
          result={gunReveal.result}
          price={diamonds.draw}
          canAgain={canOne && !tutorialReveal}
          repeat={
            tutorialReveal
              ? undefined
              : {
                  left: adLeft,
                  limit: company.adDraws?.dailyLimit ?? 3,
                  watching,
                  busy,
                  error,
                  onAd: () => void drawWeapon(true),
                }
          }
          useAction={
            tutorialReveal ? (
              <div className="weapon-reveal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setGunReveal(null)
                    onUse?.('weapon', 'night')
                  }}
                >
                  밤냥에게 무기 끌어놓기
                </button>
              </div>
            ) : gunReveal.result && onUse ? (
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
          onClose={() => {
            if (!watching && !busy) {
              setGunReveal(null)
              if (tutorialReveal) onUse?.('weapon', 'night')
            }
          }}
          onAgain={() => void drawWeapon()}
        />
      )}
    </>
  )
}
