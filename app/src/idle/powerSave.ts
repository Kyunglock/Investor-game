import { create } from 'zustand'
import { setHapticHushed } from '../fx/haptics'
import { setHushed } from '../fx/sound'

/**
 * 절전 모드 (decisions.md 607번): 켜면 화면을 검게 덮고 전투 화면을 그리지 않으며, 전투는 낮은 빈도로 계속 돈다. 소리와 진동도 쉰다(설정의
 * 소리·진동 값은 바꾸지 않는다). 끄면 모두 돌아온다. 앱을 다시 열면 꺼진 채로 시작한다.
 */
export const usePowerSave = create<{ on: boolean; set: (on: boolean) => void }>((set) => ({
  on: false,
  set: (on) => {
    setHushed(on)
    setHapticHushed(on)
    set({ on })
    window.dispatchEvent(new CustomEvent('idle-power-save', { detail: on }))
  },
}))

/** 절전 모드에서 전투를 돌리는 빈도(초당 프레임). 그리지 않으므로 낮아도 된다. */
export const POWER_SAVE_FPS = 20

/** 절전 화면을 이만큼(ms) 안에 두 번 누르면 풀린다: 주머니 속에서 한 번 스친 것으로는 풀리지 않는다. */
export const WAKE_TAP_MS = 1500
