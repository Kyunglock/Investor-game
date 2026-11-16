import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { diamondText } from '@web/features/raising/gachaRules'

/** 상점 (decisions.md 541번): 서버가 주는 날마다의 상품. */
export type ShopItem = Company['shop']['items'][number]

/** 상품이 주는 것 한 줄: "다이아 20개" · "돈 87.3b · 수입 30분어치". */
export function giveText(item: ShopItem): string {
  if (item.giveDiamonds > 0) return `다이아 ${diamondText(item.giveDiamonds)}개`
  return `돈 ${money(item.giveMoney ?? 0)} · 수입 ${minutesText(item.giveIncomeMinutes)}어치`
}

/** 60분부터는 시간으로 적는다: 30분 · 2시간 · 1시간 30분. */
export function minutesText(minutes: number): string {
  if (minutes < 60) return `${minutes}분`
  const rest = minutes % 60
  return rest === 0 ? `${minutes / 60}시간` : `${Math.floor(minutes / 60)}시간 ${rest}분`
}

/** 살 수 없는 까닭: 오늘 다 샀다(sold), 다이아나 돈이 모자라다(short). 살 수 있으면 null. 테스트판의 무한 지갑은 모자라지 않다. */
export function shopBlock(company: Company, item: ShopItem): 'sold' | 'short' | null {
  if (item.left < 1) return 'sold'
  if (company.sandboxInfinite) return null
  if (company.diamonds.amount < item.priceDiamonds) return 'short'
  if ((item.priceMoney ?? 0) > company.capital) return 'short'
  return null
}

/** 오늘 받을 무료 상품이 남아 있다: 상점 탭에 점을 단다. */
export function freeLeft(company: Company): boolean {
  return company.shop.items.some((i) => i.left > 0 && i.priceDiamonds === 0 && !i.priceMoney)
}

/** 받은 것을 한 줄로: "다이아 50개" · "돈 3.5a". 둘 다면 가운뎃점으로 잇는다. */
export function rewardText(reward: { diamonds: number; money?: number | null }): string {
  const parts: string[] = []
  if (reward.diamonds > 0) parts.push(`다이아 ${diamondText(reward.diamonds)}개`)
  if ((reward.money ?? 0) > 0) parts.push(`돈 ${money(reward.money ?? 0)}`)
  return parts.join(' · ')
}
