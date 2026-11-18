import type { Company } from '@web/api/client'
import { DiamondPrice } from '@web/features/raising/DiamondIcon'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { AD_UNAVAILABLE, watchRewardedAd } from '../app/ads'
import { sfx } from '../fx/sound'
import { drawBadge } from '../mental/armory'
import { GunSprite } from '../mental/GunSprite'
import { type DrawResult, WeaponReveal } from '../mental/WeaponReveal'
import { CatPortrait as Portrait } from './CatPortrait'
import { type CatDraw, CatReveal } from './CatReveal'
import { CAT_ODDS } from './catGrade'
import { RewardPlacement } from './RewardPlacement'
import { ShopIcon } from './ShopIcon'
import { skillNames } from './skills'

type Kind = 'cat' | 'weapon'

/** 상점의 고양이·무기 뽑기. 다이아 1회 또는 종류별 하루 3회의 광고 뽑기를 제공한다. */
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
  const [watching, setWatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const adLeft = (kind === 'cat' ? company.adDraws?.catLeft : company.adDraws?.weaponLeft) ?? 0
  const canAd = ready && adLeft > 0
  const showing = Boolean(catReveal || gunReveal)
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
        setCatReveal({ id, result: null })
        const after = await useRaisingStore.getState().drawCat(ad)
        const got = after?.idle?.cats.find(
          (c) => c.level !== idle?.cats.find((old) => old.code === c.code)?.level,
        )
        if (!mounted.current) return
        if (!got) {
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
        setGunReveal({ id, result: null })
        await useRaisingStore.getState().drawWeapon(ad)
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
  const badge = drawBadge(company)
  const short = '다이아가 모자라요 · 출석·시즌패스·상점에서 얻어요'
  const note =
    kind === 'cat'
      ? drawn
        ? drawn.isNew
          ? `${drawn.cat.grade} 등급 ${drawn.cat.name} 합류!${drawn.cat.skills.length > 0 ? ` 고유 스킬 ${skillNames(drawn.cat)}` : ''}`
          : `${drawn.cat.name} Lv.${drawn.cat.level} · 화력 ${drawn.cat.damagePercent}%${drawn.cat.skills.length > 0 ? ` · ${skillNames(drawn.cat)} Lv.${drawn.cat.skillLevel}` : ''}`
        : canOne
          ? `${CAT_ODDS} · 또 나오면 레벨 업`
          : short
      : canOne
        ? 'F~A 등급이 나와요 · S부터는 합쳐서 얻어요'
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
              disabled={showing || busy || watching}
              data-testid={`draw-kind-${k}`}
              onClick={() => {
                sfx.tap()
                setKind(k)
              }}
            >
              <ShopIcon kind={k} />
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
            disabled={showing || busy || watching || !canOne}
            onClick={() => void (kind === 'cat' ? drawCat() : drawWeapon())}
          >
            1회 뽑기
            <small>
              <DiamondPrice amount={diamonds.draw} />
            </small>
          </button>
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
        </div>
      </section>
      <p className="idle-gacha-note">광고 뽑기는 고양이·무기 각각 하루 3회 · 한국 시간 자정 갱신</p>
      {error && <p role="alert">{error}</p>}
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
