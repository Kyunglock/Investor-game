import type { Company } from '@web/api/client'
import { money } from '@web/features/game/labels'
import { DiamondIcon } from '@web/features/raising/DiamondIcon'
import { useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { LoafCat } from './LoafCat'
import './cat-bakery.css'

type Idle = NonNullable<Company['idle']>
type Cats = Idle['cats']

export function CatBakery({ idle, bakers }: { idle: Company['idle']; bakers: Cats }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const [receipt, setReceipt] = useState('')
  const bread = idle?.bread ?? 0
  const seconds = idle?.nextDiamondSeconds ?? 600
  const progress = idle?.bakingPercent ?? 0
  const sell = async () => {
    const store = useRaisingStore.getState()
    if (store.busy || !bread) return
    setReceipt('')
    await store.sellBread()
    if (!useRaisingStore.getState().error) {
      sfx.tap()
      haptic.light()
      setReceipt('꾸러미를 팔았어요. 판매 보상을 지갑에 담았어요.')
    }
  }
  return (
    <section className="cat-bakery" aria-label="식빵 공방">
      <section className="bakery-window">
        <header>
          <h3>식빵 굽는 자리</h3>
          <span className="bakery-count">{bakers.length}마리</span>
        </header>
        <div className="bakery-sill">
          {bakers.length ? (
            <ul aria-label="식빵 굽는 고양이">
              {bakers.map((cat) => (
                <li key={cat.code}>
                  <LoafCat code={cat.code} />
                  <span>{cat.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              동료를 출전 칸에서 빼면
              <br />이 자리에서 식빵을 구워요.
            </p>
          )}
        </div>
        <div className="bakery-baking">
          <div>
            <strong>다음 식빵</strong>
            <span>{progress}%</span>
          </div>
          <progress aria-label="다음 식빵 굽기" max={100} value={progress} />
          <small>쉬는 고양이 한 마리당 5분에 식빵 1개</small>
        </div>
      </section>
      <section className="bakery-counter">
        <header>
          <span className={`bakery-basket ${bread ? 'is-filled' : ''}`} aria-hidden="true" />
          <h3>식빵 꾸러미</h3>
          <span className="bakery-stock">{bread}개</span>
        </header>
        <div className="bakery-rewards">
          <div>
            <small>판매 금액</small>
            <strong>{money(idle?.bundlePrice ?? 0)}</strong>
            <small>
              매도벽 {idle?.wall ?? 1}단계 · 개당 {money((idle?.wall ?? 1) * 100)}
            </small>
          </div>
          <div>
            <small>판매 다이아</small>
            <strong>
              <DiamondIcon /> {idle?.bundleDiamonds ?? 0}개
            </strong>
            <small>공방 가동 30분당 4개</small>
          </div>
        </div>
        <div className="bakery-countdown">
          <span>다음 다이아</span>
          <b>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </b>
        </div>
        <button
          className="bakery-sell"
          type="button"
          disabled={busy || !bread}
          onClick={() => void sell()}
        >
          꾸러미 팔기
        </button>
        {receipt && (
          <p className="bakery-receipt" role="status">
            {receipt}
          </p>
        )}
      </section>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
