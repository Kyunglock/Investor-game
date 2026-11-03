import { create } from 'zustand'

/**
 * 한 판은 한 창만 (#189). 창(브라우저 탭)마다 무작위 ID를 만들어 모든 요청에 X-Client-Id로 싣는다.
 * 같은 브라우저 안에서는 Web Locks로 "주 창" 하나만 시계를 돌리고, 다른 창·기기가 판을 넘겨받으면 서버가 409로 알려 준다.
 */
export const CLIENT_ID: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** primary: 이 창이 판을 진행한다. tab: 같은 브라우저의 다른 탭이, device: 다른 창이나 기기가 진행 중이라 이 창은 보기 전용. */
export type WindowRole = 'primary' | 'tab' | 'device'

export const useWindowRole = create<{ role: WindowRole }>(() => ({ role: 'primary' }))

const LOCK = 'investor-game-clock'

function locks(): LockManager | null {
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null
}

/** 자물쇠를 잡으면 창이 닫히거나 빼앗길 때까지 쥐고 있는다. 잡았으면 true. 빼앗기면 보기 전용이 된다. */
function hold(steal: boolean): Promise<boolean> {
  const manager = locks()
  if (!manager) {
    // Web Locks가 없는 브라우저는 서버의 409에만 기댄다.
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    manager
      .request(LOCK, steal ? { steal: true } : { ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve(false)
          return
        }
        resolve(true)
        await new Promise<never>(() => {})
      })
      .catch(() => {
        // 다른 탭이 "이 창에서 이어하기"로 자물쇠를 빼앗았다.
        useWindowRole.setState({ role: 'tab' })
      })
  })
}

let first: Promise<WindowRole> | null = null

/** 창을 열 때 한 번: 자물쇠가 비어 있으면 이 창이 주 창이다. */
export function windowReady(): Promise<WindowRole> {
  if (!first) {
    first = hold(false).then((got) => {
      const role: WindowRole = got ? 'primary' : 'tab'
      useWindowRole.setState({ role })
      return role
    })
  }
  return first
}

/** "이 창에서 이어하기": 다른 탭의 자물쇠를 빼앗아 주 창이 된다. 서버에 알리는 것(claim)은 부르는 쪽이 한다. */
export async function takeOver(): Promise<void> {
  if (useWindowRole.getState().role === 'tab' || locks() === null) {
    await hold(true)
  }
  useWindowRole.setState({ role: 'primary' })
}

/** 서버가 409 OTHER_WINDOW를 돌려주면: 다른 창이나 기기가 판을 넘겨받았다. */
export function lostToOtherWindow(): void {
  if (useWindowRole.getState().role === 'primary') {
    useWindowRole.setState({ role: 'device' })
  }
}
