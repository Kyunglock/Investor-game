import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/** 진동 (decisions.md 310번). 앱에서는 Capacitor 햅틱, 브라우저에서는 navigator.vibrate. 안 되면 조용히 지나간다. */
const native = () => Capacitor.isNativePlatform()

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 지원하지 않는 브라우저
  }
}

export const haptic = {
  light: () =>
    native() ? void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}) : vibrate(10),
  medium: () =>
    native() ? void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}) : vibrate(20),
  heavy: () =>
    native()
      ? void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {})
      : vibrate([30, 30, 40]),
  /** 멘탈 카드의 전설이 터질 때 (393번): 세게 두 번, 길게. */
  burst: () => {
    if (!native()) {
      vibrate([60, 40, 120])
      return
    }
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {})
    setTimeout(() => void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}), 110)
  },
  success: () =>
    native()
      ? void Haptics.notification({ type: NotificationType.Success }).catch(() => {})
      : vibrate([15, 40, 15]),
  error: () =>
    native()
      ? void Haptics.notification({ type: NotificationType.Error }).catch(() => {})
      : vibrate([40, 30, 40]),
}
