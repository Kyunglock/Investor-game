import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'

/** 자리를 비운 동안 번 돈 (#803): 서버가 마지막으로 준 것이 응답마다 그대로 남아 온다. */
export type Offline = NonNullable<NonNullable<Company['idle']>['offline']>

/** 이 기기에서 확인을 누른 마지막 offline.at. 같은 at은 다시 띄우지 않는다. */
export const OFFLINE_SEEN_KEY = 'investor-app.offline-seen'

/**
 * 초당 수입을 적는다: 금액 표기(money)를 그대로 쓰되, 100 아래의 작은 수입은 소수 첫째 자리까지 보여 0으로 뭉개지지 않게 한다. 예: 0.4 · 12.5 · 950 ·
 * 3.5a.
 */
export function rate(perSecond: number): string {
  if (Number.isFinite(perSecond) && perSecond > 0 && perSecond < 100) {
    return String(Math.round(perSecond * 10) / 10)
  }
  return money(perSecond)
}

/** 확인한 at을 읽는다. 저장소를 못 쓰거나 값이 없으면 null. */
export function readOfflineSeen(): number | null {
  try {
    const saved = localStorage.getItem(OFFLINE_SEEN_KEY)
    if (saved == null) return null
    const at = Number(saved)
    return Number.isFinite(at) ? at : null
  } catch {
    return null
  }
}

export function saveOfflineSeen(at: number) {
  try {
    localStorage.setItem(OFFLINE_SEEN_KEY, String(at))
  } catch {
    /* 저장하지 못하면 이번 화면에서만 기억한다. */
  }
}

/**
 * 자리를 비운 동안 번 돈을 알릴 것인가: 받은 것이 있고, 그 at이 이 기기가 확인한 at과 다를 때 한 번. 처음 온 기기(seen이 null)에도 실제로 받은 돈이라
 * 알린다.
 */
export function shouldShowOffline(offline: Offline | null | undefined, seen: number | null) {
  return offline != null && offline.at !== seen
}

/** 비운 시간을 "N시간 M분"·"N시간"·"M분"으로. 1분이 안 되면 "1분 미만". */
export function awayText(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
  return m > 0 ? `${m}분` : '1분 미만'
}
