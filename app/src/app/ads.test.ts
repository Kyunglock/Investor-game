import { beforeEach, describe, expect, it, vi } from 'vitest'

const native = { on: true, plugin: true }
const listeners = new Map<string, () => void>()
/** 광고가 뜬 뒤에 일어나는 일: 알림 이름을 차례로 낸다. */
let script: string[] = []
const admob = {
  initialize: vi.fn(async () => {}),
  prepareRewardVideoAd: vi.fn(async (_options: { adId: string; isTesting: boolean }) => ({})),
  showRewardVideoAd: vi.fn(() => {
    queueMicrotask(() => {
      for (const event of script) listeners.get(event)?.()
    })
    // 8.2 플러그인은 끝까지 봤을 때만 풀리고, 중간에 닫으면 끝나지 않는다.
    return script.includes('onRewardedVideoAdReward')
      ? Promise.resolve({ type: 'reward', amount: 1 })
      : new Promise<never>(() => {})
  }),
  addListener: vi.fn(async (event: string, listener: () => void) => {
    listeners.set(event, listener)
    return { remove: vi.fn(async () => {}) }
  }),
}

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.on,
    isPluginAvailable: () => native.plugin,
  },
}))
vi.mock('@capacitor-community/admob', () => ({
  AdMob: admob,
  RewardAdPluginEvents: {
    Rewarded: 'onRewardedVideoAdReward',
    Dismissed: 'onRewardedVideoAdDismissed',
    FailedToShow: 'onRewardedVideoAdFailedToShow',
  },
}))

async function ads() {
  vi.resetModules()
  return import('./ads')
}

describe('보상형 광고 (586·589번)', () => {
  beforeEach(() => {
    native.on = true
    native.plugin = true
    listeners.clear()
    script = ['onRewardedVideoAdReward', 'onRewardedVideoAdDismissed']
    for (const mock of Object.values(admob)) mock.mockClear()
    admob.prepareRewardVideoAd.mockImplementation(async () => ({}))
  })

  it('브라우저나 광고 플러그인이 없는 앱에서는 광고 없이 바로 받는다', async () => {
    native.on = false
    expect(await (await ads()).watchRewardedAd('rebirth')).toBe('rewarded')
    native.on = true
    native.plugin = false
    expect(await (await ads()).watchRewardedAd('active')).toBe('rewarded')
    expect(admob.initialize).not.toHaveBeenCalled()
  })

  it('앱에서는 광고를 끝까지 보고 닫아야 받고, 다음 광고를 미리 받아 둔다', async () => {
    const { watchRewardedAd } = await ads()
    expect(await watchRewardedAd('rebirth')).toBe('rewarded')
    expect(admob.initialize).toHaveBeenCalledTimes(1)
    expect(admob.showRewardVideoAd).toHaveBeenCalledTimes(1)
    expect(admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2)
  })

  it('중간에 닫으면 받지 못한다', async () => {
    script = ['onRewardedVideoAdDismissed']
    expect(await (await ads()).watchRewardedAd('active')).toBe('closed')
  })

  it('광고를 불러오지 못하면 한 번 더 받아 보고, 그래도 안 되면 알린다', async () => {
    admob.prepareRewardVideoAd.mockRejectedValue(new Error('no fill'))
    expect(await (await ads()).watchRewardedAd('active')).toBe('unavailable')
    expect(admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2)
    expect(admob.showRewardVideoAd).not.toHaveBeenCalled()
  })

  it('띄우다 실패하면 받지 못한다', async () => {
    script = ['onRewardedVideoAdFailedToShow']
    expect(await (await ads()).watchRewardedAd('rebirth')).toBe('unavailable')
    admob.showRewardVideoAd.mockRejectedValueOnce(new Error('not prepared'))
    expect(await (await ads()).watchRewardedAd('rebirth')).toBe('unavailable')
  })

  it('미리 받아 둔 광고를 쓴다', async () => {
    const { preloadRewardedAd, watchRewardedAd } = await ads()
    preloadRewardedAd()
    expect(await watchRewardedAd('rebirth')).toBe('rewarded')
    // 미리 한 번, 보고 난 뒤 다음 것 한 번.
    expect(admob.prepareRewardVideoAd).toHaveBeenCalledTimes(2)
  })

  it('광고 단위가 없거나 꼴이 틀리면 구글의 시험 광고를 쓴다', async () => {
    const { rewardedUnit } = await ads()
    expect(rewardedUnit(undefined).isTesting).toBe(true)
    expect(rewardedUnit('1234').isTesting).toBe(true)
    expect(rewardedUnit(' ca-app-pub-1234567890123456/1234567890 ')).toEqual({
      adId: 'ca-app-pub-1234567890123456/1234567890',
      isTesting: false,
    })
  })
})
