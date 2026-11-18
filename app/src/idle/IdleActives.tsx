import type { Company } from '@web/api/client'
import { type ActiveCode, useRaisingStore } from '@web/features/raising/store'
import { useShownIdle } from '@web/features/raising/useIdleBattle'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppUi } from '../app/ui'
import './ad-skill-details.css'
import { AD_UNAVAILABLE, watchRewardedAd } from '../app/ads'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { ACTIVE_HINTS } from '../mental/actives'
import { ActiveBadge } from './ActiveBadge'

type Active = NonNullable<NonNullable<Company['idle']>['actives']>[number]

/**
 * 액티브 스킬 단추 (decisions.md 503번). 누르면 서버가 대기 시간을 보고 받아 주고, 받아 준 뒤에 전투가 효과를 낸다. 남은 대기 시간은 접속
 * 신호마다 서버가 다시 알려 준다.
 *
 * 오른쪽에는 장착한 고유 스킬이 선다 (587번): 스킬 탭에서 세 개까지 장착한다. 왼쪽에는 광고 스킬이 선다 (588번): 광고를 본 뒤에 쓴다. 광고를
 * 불러오지 못하면 알림을 띄운다 (589번, app/ads.ts).
 */
export function IdleActives({ company, connected }: { company: Company; connected: boolean }) {
  const [selectedAd, setSelectedAd] = useState<ActiveCode | null>(null)
  const running = useRef(false)
  const [pending, setPending] = useState<ActiveCode | null>(null)
  // 광고를 불러오지 못했을 때의 알림 (589번): 잠깐 떴다 사라진다.
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(timer)
  }, [notice])
  const idle = company.idle
  const actives = idle?.actives ?? []
  // 거래 정지는 화면이 벽을 부순 때 시작한다 (532번): 서버가 알기 전에도 단추가 잠긴다.
  const halted = useShownIdle(idle).circuitSeconds > 0
  const unique = actives.filter((active) => !active.ad && active.equipped)
  const ads = actives.filter((active) => active.ad)
  const activeAd = ads.find((active) => active.left > 0)
  const unavailable = (active: Active) => {
    if (active.left > 0) return `사용 중 · ${Math.ceil(active.left)}초 남음`
    if (active.ad && activeAd) return `${activeAd.name} 사용 중 · 동시에 하나만 쓸 수 있어요`
    if (!connected) return '연결을 확인하고 있어요'
    if (halted) return '거래 정지가 끝나면 쓸 수 있어요'
    if (active.readyIn > 0) return `${Math.ceil(active.readyIn)}초 뒤에 쓸 수 있어요`
    return null
  }
  const use = async (active: Active) => {
    if (running.current || unavailable(active)) return
    running.current = true
    setPending(active.code)
    setNotice(null)
    sfx.tap()
    haptic.light()
    try {
      if (active.ad) {
        const watched = await watchRewardedAd('active')
        if (watched !== 'rewarded') {
          setNotice(
            watched === 'unavailable'
              ? AD_UNAVAILABLE
              : '광고를 끝까지 보면 효과를 받을 수 있어요.',
          )
          return
        }
      }
      const ok = await useRaisingStore.getState().useActive(active.code, active.ad)
      if (ok) {
        window.dispatchEvent(new CustomEvent('idle-active', { detail: active.code }))
        setSelectedAd(null)
      } else
        setNotice(
          useRaisingStore.getState().error ?? '스킬을 사용하지 못했어요. 다시 시도해 주세요.',
        )
    } catch {
      setNotice(AD_UNAVAILABLE)
    } finally {
      running.current = false
      setPending(null)
    }
  }
  const selected = ads.find((active) => active.code === selectedAd)
  const button = (active: Active) => {
    const blockedByAd = active.ad && !!activeAd && activeAd.code !== active.code
    const wait = Math.ceil(active.readyIn)
    // 효과가 도는 동안에는 지속 시간, 그 뒤에는 재사용 대기를 원형 음영으로 나타낸다.
    const left = active.ad ? Math.ceil(active.left) : 0
    const remaining = left > 0 ? active.left : active.readyIn
    const total = left > 0 ? active.seconds : active.cooldown
    const shade = total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0
    return (
      <button
        key={active.code}
        type="button"
        data-testid={active.ad ? 'idle-ad-active' : 'idle-active'}
        data-code={active.code}
        data-ready={wait === 0 && !blockedByAd}
        data-on={left > 0 || undefined}
        disabled={
          pending !== null || (!active.ad && (!connected || halted || wait > 0 || left > 0))
        }
        aria-label={
          left > 0
            ? `${active.name} · ${left}초 남았어요`
            : blockedByAd
              ? `${active.name} · 다른 광고 스킬 사용 중`
              : wait > 0
                ? `${active.name} · ${wait}초 뒤에 쓸 수 있어요`
                : `${active.name} · ${ACTIVE_HINTS[active.code]}${active.ad ? ' · 광고 효과 자세히 보기' : ''}`
        }
        title={`${active.name} · ${ACTIVE_HINTS[active.code]}${active.ad ? ' · 광고 효과 자세히 보기' : ''}`}
        aria-busy={pending === active.code}
        onClick={() => {
          if (active.ad) {
            setNotice(null)
            setSelectedAd(active.code)
          } else void use(active)
        }}
      >
        <ActiveBadge code={active.code} />
        {shade > 0 && (
          <i
            className="idle-active-shade"
            aria-hidden="true"
            style={{ background: `conic-gradient(transparent ${1 - shade}turn, #21162e99 0)` }}
          />
        )}
        {pending === active.code && <span className="idle-active-pending" aria-hidden="true" />}
      </button>
    )
  }
  return (
    <>
      {selected && (
        <AdSkillDetails
          active={selected}
          blocked={unavailable(selected)}
          pending={pending !== null}
          notice={notice}
          onClose={() => {
            if (!running.current) setSelectedAd(null)
          }}
          onUse={() => void use(selected)}
        />
      )}
      {notice && !selected && (
        <p className="idle-ad-notice" role="alert" data-testid="idle-ad-notice">
          {notice}
        </p>
      )}
      {ads.length > 0 && (
        <div className="idle-actives idle-actives-ad" data-testid="idle-ad-actives">
          {ads.map(button)}
        </div>
      )}
      {unique.length > 0 && (
        <div className="idle-actives" data-testid="idle-actives">
          {unique.map(button)}
        </div>
      )}
    </>
  )
}

function AdSkillDetails({
  active,
  blocked,
  pending,
  notice,
  onClose,
  onUse,
}: {
  active: Active
  blocked: string | null
  pending: boolean
  notice: string | null
  onClose: () => void
  onUse: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const dismiss = useEffectEvent(onClose)
  useEffect(() => {
    const root = dialog.current
    const focus = document.activeElement as HTMLElement | null
    const previous = useAppUi.getState().modalBack
    const back = () => dismiss()
    useAppUi.getState().setModalBack(back)
    root?.showModal()
    return () => {
      root?.close()
      if (useAppUi.getState().modalBack === back) useAppUi.getState().setModalBack(previous)
      focus?.focus()
    }
  }, [])
  const duration = active.seconds % 60 === 0 ? `${active.seconds / 60}분` : `${active.seconds}초`
  return createPortal(
    <dialog
      ref={dialog}
      className="ad-skill-details"
      data-testid="ad-skill-details"
      aria-labelledby="ad-skill-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="ad-skill-details-icon">
        <ActiveBadge code={active.code} />
      </div>
      <h2 id="ad-skill-title">{active.name}</h2>
      <p>
        {ACTIVE_HINTS[active.code]} · {duration} 동안
      </p>
      <p>
        광고를 끝까지 보면 적용돼요.
        <br />
        광고 효과 3종 중 하나만 동시에 쓸 수 있어요.
      </p>
      {blocked && <p role="status">{blocked}</p>}
      {notice && <p role="alert">{notice}</p>}
      <button
        type="button"
        data-testid="ad-skill-confirm"
        disabled={pending || blocked !== null}
        onClick={onUse}
      >
        {pending ? '광고 시청 중…' : '광고 보고 사용하기'}
      </button>
      <button type="button" disabled={pending} onClick={onClose}>
        닫기
      </button>
    </dialog>,
    document.body,
  )
}
