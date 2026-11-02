import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { layersFor } from './pixel/layers'
import { Sprite } from './pixel/SpriteView'
import { displayName, headline, lifeLine, type ShareCard } from './share'

/** 공유 링크로 들어온 사람이 보는 결과 카드 (#197). 판을 이어 하지 않고, "나도 해 보기"로 처음 화면에 간다. */
export function SharedPage({ shareId }: { shareId: string }) {
  const [card, setCard] = useState<ShareCard | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    void api.GET('/api/shares/{shareId}', { params: { path: { shareId } } }).then(({ data }) => {
      if (!cancelled) {
        setCard(data ?? null)
        setMissing(!data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [shareId])

  const start = () => {
    window.location.assign('/')
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10" data-testid="shared-page">
      {missing && <p className="text-muted">공유된 결과를 찾을 수 없습니다.</p>}
      {card && (
        <article className="rounded border border-line bg-paper px-6 py-8 text-center">
          <p className="text-[11px] tracking-[0.3em] text-faint">투자자 시뮬레이터 · 인생 결과</p>
          <div className="mt-5 flex justify-center">
            <Sprite
              spec={layersFor(card.initialStats, card.finalStats, card.finalAge, card.sex)}
              size={128}
            />
          </div>
          <h1 className="mt-4 font-serif-kr text-3xl font-black text-ink">{displayName(card)}</h1>
          <p className={`mt-2 font-semibold ${card.finalAsset < 0 ? 'text-wine' : 'text-ink'}`}>
            {headline(card)}
          </p>
          {card.rank && <p className="mt-1 text-sm font-bold text-wine">순위표 {card.rank}위</p>}
          {card.investorTypeName && (
            <div className="mt-5 rounded bg-wine-soft px-4 py-3">
              <p className="font-serif-kr text-xl font-black text-wine">
                '{card.investorTypeName}' 투자자
              </p>
              {card.investorTypeDescription && (
                <p className="mt-1 text-[13px] text-muted">{card.investorTypeDescription}</p>
              )}
            </div>
          )}
          <p className="mt-4 text-[13px] text-muted">{lifeLine(card)}</p>
        </article>
      )}
      <button
        type="button"
        className="mt-6 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
        onClick={start}
        data-testid="shared-start"
      >
        나도 해 보기
      </button>
    </main>
  )
}

/** 주소가 /share/{id}면 그 ID. */
export function sharedIdFrom(pathname: string): string | null {
  const m = /^\/share\/([2-9a-zA-Z]{6,16})\/?$/.exec(pathname)
  return m ? m[1] : null
}
