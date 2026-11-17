import { Capacitor } from '@capacitor/core'

/**
 * 보상형 광고 (decisions.md 586·589번, #888). "광고 보기" 단추가 모두 이 함수를 거친다.
 *
 * 안드로이드 앱에서는 AdMob 보상형 광고를 띄운다(`@capacitor-community/admob`). 끝까지 보고 닫으면 'rewarded', 중간에 닫으면 'closed', 광고를
 * 불러오지 못했으면 'unavailable'이다. 부르는 쪽은 'rewarded'일 때만 보상을 청한다.
 *
 * 광고를 띄울 수 없는 곳(브라우저로 연 화면, 광고 플러그인이 없는 예전 앱)에서는 광고 없이 'rewarded'를 돌려준다: 광고 SDK는 앱에만 있다.
 */
export type AdPlacement = 'rebirth' | 'active'
export type AdResult = 'rewarded' | 'closed' | 'unavailable'

/** 광고를 불러오지 못했을 때 화면에 띄우는 말. */
export const AD_UNAVAILABLE = '광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'

/** 구글이 주는 시험용 보상형 광고 단위: 실제 광고 단위를 넣지 않은 빌드는 시험 광고를 띄운다. */
const TEST_UNIT = 'ca-app-pub-3940256099942544/5224354917'

/** 광고 단위 번호 꼴: ca-app-pub-숫자/숫자. */
export function rewardedUnit(value: string | undefined): { adId: string; isTesting: boolean } {
  const unit = value?.trim() ?? ''
  return /^ca-app-pub-\d+\/\d+$/.test(unit) && unit !== TEST_UNIT
    ? { adId: unit, isTesting: false }
    : { adId: TEST_UNIT, isTesting: true }
}

/** 이 화면이 광고를 띄울 수 있는가: 안드로이드 앱이고 광고 플러그인이 든 빌드다. */
export function adsAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AdMob')
}

let started: Promise<typeof import('@capacitor-community/admob')> | null = null
/** 광고 SDK는 처음 쓸 때 한 번만 켠다. 브라우저에서는 이 모듈을 받지도 않는다. */
function plugin() {
  started ??= import('@capacitor-community/admob').then(async (module) => {
    await module.AdMob.initialize()
    return module
  })
  started.catch(() => {
    started = null
  })
  return started
}

let loading: Promise<boolean> | null = null
/** 광고 하나를 미리 받아 둔다. 받았으면 true. 이미 받는 중이거나 받아 둔 것이 있으면 그것을 쓴다. */
function load(): Promise<boolean> {
  loading ??= plugin()
    .then(({ AdMob }) =>
      AdMob.prepareRewardVideoAd(rewardedUnit(import.meta.env.VITE_ADMOB_REWARDED_ID)),
    )
    .then(
      () => true,
      () => false,
    )
  return loading
}

/** 단추를 누르자마자 광고가 뜨도록 미리 받아 둔다. 광고를 띄울 수 없는 곳에서는 아무 일도 하지 않는다. */
export function preloadRewardedAd() {
  if (adsAvailable()) void load()
}

/** 광고가 닫힌 직후 이만큼은 늦게 오는 "끝까지 봤다" 알림을 기다린다. */
const REWARD_WAIT_MS = 400

export async function watchRewardedAd(_placement: AdPlacement): Promise<AdResult> {
  if (!adsAvailable()) return 'rewarded'
  // 미리 받아 둔 광고가 없거나 받다가 실패했으면 한 번 더 받아 본다.
  if (!(await load())) {
    loading = null
    if (!(await load())) {
      loading = null
      return 'unavailable'
    }
  }
  // 받아 둔 광고는 한 번만 쓴다.
  loading = null
  try {
    const { AdMob, RewardAdPluginEvents } = await plugin()
    // 보상은 광고가 닫힌 뒤에 준다: 끝까지 봤는지는 닫히기 전의 알림으로 안다. 중간에 닫으면 보상 알림 없이 닫힘만 온다.
    let rewarded = false
    let finish: (result: AdResult) => void = () => {}
    const result = new Promise<AdResult>((resolve) => {
      finish = resolve
    })
    const listeners = await Promise.all([
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true
      }),
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        setTimeout(() => finish(rewarded ? 'rewarded' : 'closed'), REWARD_WAIT_MS)
      }),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish('unavailable')),
    ])
    AdMob.showRewardVideoAd().then(
      () => {
        rewarded = true
      },
      // 띄우지 못했다. 닫아서 거절된 것(새 플러그인)은 닫힘 알림이 마무리한다.
      (error: { code?: string }) => {
        if (error?.code !== 'REWARDED_AD_CANCELLED') finish('unavailable')
      },
    )
    try {
      return await result
    } finally {
      for (const listener of listeners) void listener.remove()
    }
  } catch {
    return 'unavailable'
  } finally {
    // 다음 광고를 미리 받아 둔다.
    void load()
  }
}
