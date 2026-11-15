import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  awayText,
  OFFLINE_SEEN_KEY,
  rate,
  readOfflineSeen,
  saveOfflineSeen,
  shouldShowOffline,
} from './income'

const offline = { at: 1_700_000_000_000, seconds: 3600, earned: 5000, capped: false }

/** 저장소를 가짜로 둔다. */
function stubStorage(saved?: string) {
  const store = new Map<string, string>()
  if (saved !== undefined) store.set(OFFLINE_SEEN_KEY, saved)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  })
  return store
}

afterEach(() => vi.unstubAllGlobals())

describe('자리를 비운 동안 번 돈 알림 (#803)', () => {
  it('받은 것이 없으면 알리지 않고, 처음 온 기기에는 알린다', () => {
    expect(shouldShowOffline(null, null)).toBe(false)
    expect(shouldShowOffline(undefined, 5)).toBe(false)
    expect(shouldShowOffline(offline, null)).toBe(true)
  })

  it('확인한 at과 같으면 다시 알리지 않고, at이 바뀌면 한 번 더 알린다', () => {
    expect(shouldShowOffline(offline, offline.at)).toBe(false)
    expect(shouldShowOffline({ ...offline, at: offline.at + 1 }, offline.at)).toBe(true)
  })

  it('확인한 at을 기기에 남기고 다시 읽는다', () => {
    const store = stubStorage()
    expect(readOfflineSeen()).toBeNull()
    saveOfflineSeen(offline.at)
    expect(store.get(OFFLINE_SEEN_KEY)).toBe(String(offline.at))
    expect(readOfflineSeen()).toBe(offline.at)
    expect(shouldShowOffline(offline, readOfflineSeen())).toBe(false)
  })

  it('저장값이 깨졌거나 저장소가 막혀도 알림은 뜬다', () => {
    stubStorage('엉뚱한 값')
    expect(readOfflineSeen()).toBeNull()
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(readOfflineSeen()).toBeNull()
    expect(() => saveOfflineSeen(1)).not.toThrow()
    expect(shouldShowOffline(offline, readOfflineSeen())).toBe(true)
  })

  it('비운 시간은 시간·분으로 적는다', () => {
    expect(awayText(8 * 3600)).toBe('8시간')
    expect(awayText(3600 + 25 * 60 + 59)).toBe('1시간 25분')
    expect(awayText(12 * 60)).toBe('12분')
    expect(awayText(59)).toBe('1분 미만')
    expect(awayText(-5)).toBe('1분 미만')
  })
})

describe('초당 수입 표기 (#803)', () => {
  it('작은 수입은 소수 첫째 자리까지, 큰 수입은 금액 표기로', () => {
    expect(rate(0.44)).toBe('0.4')
    expect(rate(12.5)).toBe('12.5')
    expect(rate(7)).toBe('7')
    expect(rate(950)).toBe('950')
    expect(rate(3500)).toBe('3.5a')
    expect(rate(0)).toBe('0')
  })
})
