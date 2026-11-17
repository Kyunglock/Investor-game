import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { DiamondPrice } from '@web/features/raising/DiamondIcon'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { IdleGacha } from './IdleGacha'
import { ShopIcon } from './ShopIcon'
import { freeLeft, giveText, rewardText, type ShopItem, shopBlock } from './shop'

/**
 * 상점 탭 (decisions.md 541번): 위에는 고양이·무기 뽑기(전에는 고양이 탭에 있었다), 아래에는 날마다의 상품이다. 실제 돈은 쓰지 않고 다이아와
 * 게임 돈으로만 산다. 값·남은 횟수·결과는 서버가 정한다.
 */
export function IdleShop({
  company,
  kind,
  onUse,
}: {
  company: Company
  kind?: 'cat' | 'weapon'
  onUse?: (kind: 'cat' | 'weapon', code: CatCode | null) => void
}) {
  const [buying, setBuying] = useState(false)
  const [got, setGot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const buy = async (item: ShopItem) => {
    if (buying) return
    setBuying(true)
    setError(null)
    sfx.tap()
    try {
      const after = await useRaisingStore.getState().buyShopItem(item.code)
      const receipt = after?.shop.lastReceipt
      if (!after || !receipt) {
        setError(useRaisingStore.getState().error ?? '연결이 끊겼어요. 다시 시도해 주세요.')
        return
      }
      haptic.light()
      sfx.levelUp()
      setGot(`${item.name}: ${rewardText(receipt)} 받았어요`)
    } finally {
      setBuying(false)
    }
  }
  return (
    <div className="idle-shop">
      <div className="idle-shop-wallet">
        <span>게임 재화 전용</span>
        <b>{money(company.capital)}</b>
        <DiamondPrice amount={company.diamonds.amount} />
      </div>
      <IdleGacha company={company} initialKind={kind} onCat={() => {}} onUse={onUse} />
      <div className="idle-shop-daily">
        <h4>오늘의 상품</h4>
        <span>매일 자정 갱신</span>
      </div>
      {freeLeft(company) && <p className="idle-shop-free-note">오늘의 무료 선물이 기다려요!</p>}
      {company.shop.items.map((item) => {
        const block = shopBlock(company, item)
        return (
          <article
            className="idle-stat idle-shop-item"
            key={item.code}
            data-testid="shop-item"
            data-code={item.code}
            data-free={item.priceDiamonds === 0 && !item.priceMoney}
            data-sold={block === 'sold'}
          >
            <span className="idle-stat-icon" aria-hidden="true">
              <ShopIcon kind={item.priceDiamonds === 0 && !item.priceMoney ? 'gift' : 'gems'} />
            </span>
            <div className="idle-stat-info">
              <b>{item.name}</b>
              <small>{giveText(item)}</small>
              <p>
                오늘 {item.left} / {item.dailyLimit}번 남음
              </p>
            </div>
            <button
              type="button"
              className="idle-buy"
              data-testid="shop-buy"
              disabled={buying || block !== null}
              onClick={() => void buy(item)}
            >
              {block === 'sold'
                ? '내일 또'
                : item.priceDiamonds === 0 && !item.priceMoney
                  ? '받기'
                  : '사기'}
              <small>
                {item.priceDiamonds > 0 ? (
                  <DiamondPrice amount={item.priceDiamonds} />
                ) : item.priceMoney ? (
                  money(item.priceMoney)
                ) : (
                  '무료'
                )}
              </small>
            </button>
          </article>
        )
      })}
      {got && (
        <p className="idle-shop-got" role="status" data-testid="shop-got">
          {got}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
