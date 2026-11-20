import { type ReactNode, useState } from 'react'
import breakthrough from './assets/prologue-breakthrough.webp'
import drop from './assets/prologue-drop.webp'
import market from './assets/prologue-market.webp'
import pickup from './assets/prologue-pickup.webp'
import sellWall from './assets/prologue-sell-wall.webp'
import './opening-prologue.css'

const panels = [
  {
    image: sellWall,
    alt: '고양이전자 하락 전광판이 사악하게 웃고, 매도 쪽지가 성벽 사이의 세 고양이 위로 흩날린다.',
  },
  { image: market, alt: '“몰려온다!” 거대한 매도벽 아래로 패닉셀과 투매 몬스터가 밀려온다.' },
  { image: drop, alt: '툭! 사장냥의 발앞에 주황색 총이 떨어진다.' },
  { image: pickup, alt: '투매 몬스터가 다가오자 사장냥이 바닥에서 총을 집어 든다.' },
  {
    image: breakthrough,
    alt: '“매도벽을 뚫자!” 동료들이 몬스터를 막는 사이 사장냥이 벽을 깨자 다음 매도벽으로 가는 길이 열린다.',
  },
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
  const key = `investor-game.prologue.v3:${companyId}`
  const [page, setPage] = useState(() => {
    try {
      const current = localStorage.getItem(key)
      if (current === null) {
        const fourPanelSave = localStorage.getItem(`investor-game.prologue.v2:${companyId}`)
        if (fourPanelSave !== null) {
          const page = Number(fourPanelSave)
          return Number.isInteger(page) && page >= 1 && page <= 4 ? page + 1 : 0
        }
        const previous = localStorage.getItem(`investor-game.prologue:${companyId}`)
        if (previous === '3') return panels.length
        if (previous === '2') return 4
        return previous === '1' ? 2 : 0
      }
      const saved = Number(current)
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
      <button type="button" onClick={next} className="opening-prologue-page">
        <img src={panel.image} alt={panel.alt} />
        <span className="opening-prologue-nav">
          <span>
            {page + 1} / {panels.length}
          </span>
          <strong>{page === panels.length - 1 ? '첫 매도벽 돌파' : '다음 컷'} ▸</strong>
        </span>
      </button>
    </main>
  )
}
