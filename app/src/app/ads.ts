/**
 * 보상형 광고 (decisions.md 586번, #888). "광고 보기" 단추가 모두 이 함수를 거친다.
 *
 * 아직 광고를 붙이지 않았다: 누르면 광고 없이 바로 보상을 받는다. AdMob을 붙일 때 이 함수만 광고를 띄우고, 끝까지 봤으면 true를, 닫았거나 광고가
 * 없으면 false를 돌려주게 고친다. 부르는 쪽은 true일 때만 보상을 청한다.
 */
export type AdPlacement = 'rebirth' | 'active'

export async function watchRewardedAd(_placement: AdPlacement): Promise<boolean> {
  return true
}
