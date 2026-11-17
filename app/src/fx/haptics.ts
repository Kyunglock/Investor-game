import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * 진동 (decisions.md 310번). 앱에서는 Capacitor 햅틱, 브라우저에서는 navigator.vibrate. 안 되면 조용히 지나간다.
 * 끄기(521번, #792)는 소리처럼 브라우저에 남는다. 단추는 매도벽 돌파 화면의 설정 창에 있다(522번). 꺼져 있으면 아래의 모든 진동이 아무것도 하지 않는다.
 */
const KEY = 'investor-app.haptic'

const native = () => Capacitor.isNativePlatform()

let off = (() => {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
})()

/** 절전 모드 (607번)에서 잠깐 쉰다: 설정의 진동 값은 그대로다. */
let hushed = false
export function setHapticHushed(on: boolean) {
  hushed = on
}

export function isHapticOff(): boolean {
  return off
}

export function setHapticOff(value: boolean) {
  off = value
  try {
    localStorage.setItem(KEY, value ? 'off' : 'on')
  } catch {
    // 저장이 안 되면 이번 화면에서만
  }
}

function vibrate(pattern: number | number[]) {
  if (off || hushed) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 지원하지 않는 브라우저
  }
}

function impact(style: ImpactStyle) {
  if (off || hushed) return
  void Haptics.impact({ style }).catch(() => {})
}

function notify(type: NotificationType) {
  if (off || hushed) return
  void Haptics.notification({ type }).catch(() => {})
}

export const haptic = {
  light: () => (native() ? impact(ImpactStyle.Light) : vibrate(10)),
  medium: () => (native() ? impact(ImpactStyle.Medium) : vibrate(20)),
  heavy: () => (native() ? impact(ImpactStyle.Heavy) : vibrate([30, 30, 40])),
  /** 멘탈 카드의 전설이 터질 때 (393번): 세게 두 번, 길게. */
  burst: () => {
    if (off || hushed) return
    if (!native()) {
      vibrate([60, 40, 120])
      return
    }
    impact(ImpactStyle.Heavy)
    // 두 번째 진동은 그 사이에 꺼졌으면 내지 않는다(impact가 다시 확인한다).
    setTimeout(() => impact(ImpactStyle.Heavy), 110)
  },
  success: () => (native() ? notify(NotificationType.Success) : vibrate([15, 40, 15])),
  error: () => (native() ? notify(NotificationType.Error) : vibrate([40, 30, 40])),
}
