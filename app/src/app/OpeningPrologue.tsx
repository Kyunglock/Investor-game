import { type ReactNode, useState } from 'react'
import breakthrough from './assets/prologue-breakthrough.webp'
import drop from './assets/prologue-drop.webp'
import market from './assets/prologue-market.webp'
import './opening-prologue.css'

const panels = [
  { image: market, alt: '투매 급증. 파란 매도벽 앞에 주저앉은 고양이들. “다들 팔고 있어…”' },
  {
    image: drop,
    alt: '사장냥이 하늘에서 떨어지는 주황색 무기를 올려다본다. “어? 이게 왜 여기서?”',
  },
  { image: breakthrough, alt: '“얘들아, 가자!” 세 고양이가 함께 파란 벽돌을 깨고 뛰어나온다.' },
]

export function OpeningPrologue({
  companyId,
  firstVisit,
  children,
}: {
  companyId: string
  firstVisit: boolean
  children: ReactNode
}) {
  const key = `investor-game.prologue:${companyId}`
  const [page, setPage] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(key))
      return Number.isInteger(saved) && saved >= 0 && saved <= panels.length ? saved : 0
    } catch {
      return 0
    }
  })
  const panel = panels[page]
  if (!firstVisit || !panel) return children
  const next = () => {
    setPage(page + 1)
    try {
      localStorage.setItem(key, String(page + 1))
    } catch {
      // 저장 공간을 쓸 수 없어도 프롤로그를 마치고 게임에 들어갈 수 있다.
    }
  }
  return (
    <main className="opening-prologue" aria-label="첫 매도벽 프롤로그">
      <span
        aria-hidden="true"
        className="opening-prologue-backdrop"
        style={{ backgroundImage: `url(${panel.image})` }}
      />
      <button type="button" onClick={next} className="opening-prologue-page">
        <img src={panel.image} alt={panel.alt} />
        <span className="opening-prologue-nav">
          <span className="opening-prologue-progress">
            <span className="sr-only">
              {panels.length}컷 중 {page + 1}번째
            </span>
            {panels.map((item, index) => (
              <i key={item.image} data-current={index === page} />
            ))}
          </span>
          <strong>{page === panels.length - 1 ? '첫 매도벽 돌파' : '다음 컷'} ▸</strong>
        </span>
      </button>
    </main>
  )
}
