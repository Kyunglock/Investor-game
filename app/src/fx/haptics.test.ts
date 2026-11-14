import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const impact = vi.fn(() => Promise.resolve())
const notification = vi.fn(() => Promise.resolve())
let isNative = false

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNative } }))
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact, notification },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
  NotificationType: { Success: 'SUCCESS', Error: 'ERROR' },
}))

const KEY = 'investor-app.haptic'

/** 저장소와 진동을 가짜로 두고 모듈을 새로 읽는다(저장값은 모듈을 읽을 때 한 번 본다). */
async function load(saved?: string) {
  const store = new Map<string, string>()
  if (saved !== undefined) store.set(KEY, saved)
  const vibrate = vi.fn()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  })
  vi.stubGlobal('navigator', { vibrate })
  vi.resetModules()
  const mod = await import('./haptics')
  return { ...mod, store, vibrate }
}

describe('진동 끄기 (521번, #792)', () => {
  beforeEach(() => {
    isNative = false
    impact.mockClear()
    notification.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('기본은 켜짐이다', async () => {
    const { haptic, isHapticOff, vibrate } = await load()
    expect(isHapticOff()).toBe(false)
    haptic.light()
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('끄면 브라우저의 모든 진동이 아무것도 하지 않는다', async () => {
    const { haptic, setHapticOff, vibrate } = await load()
    setHapticOff(true)
    for (const fn of Object.values(haptic)) fn()
    vi.runAllTimers()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('끄면 앱(Capacitor)의 모든 진동도 아무것도 하지 않는다', async () => {
    isNative = true
    const { haptic, setHapticOff } = await load()
    setHapticOff(true)
    for (const fn of Object.values(haptic)) fn()
    vi.runAllTimers()
    expect(impact).not.toHaveBeenCalled()
    expect(notification).not.toHaveBeenCalled()
  })

  it('burst 도중에 끄면 두 번째 진동도 내지 않는다', async () => {
    isNative = true
    const { haptic, setHapticOff } = await load()
    haptic.burst()
    expect(impact).toHaveBeenCalledTimes(1)
    setHapticOff(true)
    vi.runAllTimers()
    expect(impact).toHaveBeenCalledTimes(1)
  })

  it('켜져 있으면 앱에서 burst가 두 번 진동한다', async () => {
    isNative = true
    const { haptic } = await load()
    haptic.burst()
    vi.runAllTimers()
    expect(impact).toHaveBeenCalledTimes(2)
  })

  it('끈 것이 저장되고, 다시 열어도 꺼져 있다', async () => {
    const first = await load()
    first.setHapticOff(true)
    expect(first.store.get(KEY)).toBe('off')
    const again = await load('off')
    expect(again.isHapticOff()).toBe(true)
    again.haptic.heavy()
    expect(again.vibrate).not.toHaveBeenCalled()
    again.setHapticOff(false)
    expect(again.store.get(KEY)).toBe('on')
    again.haptic.heavy()
    expect(again.vibrate).toHaveBeenCalledWith([30, 30, 40])
  })
})
