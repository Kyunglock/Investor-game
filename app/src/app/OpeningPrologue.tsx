import { type ReactNode, useState } from 'react'
import { PrologueStage } from './PrologueStage'
import './opening-prologue.css'

const panels = [
  {
    speaker: '하늘냥',
    line: '다들 팔고 있어… 저 벽, 아까보다 높아졌어.',
    alt: '매도 주문이 몰리며 파란 매도벽이 세 고양이 앞에 쌓인다.',
  },
  { speaker: '사장냥', line: '어? 이게 왜 여기서?', alt: '사장냥 앞에 떨어지는 주황색 무기.' },
  {
    speaker: '사장냥',
    line: '얘들아, 가자!',
    alt: '사장냥이 벽을 깨고 세 고양이가 열린 길로 달려간다.',
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
      <button type="button" onClick={next} className="opening-prologue-page">
        <PrologueStage page={page} description={panel.alt} />
        <span className="prologue-dialogue" aria-live="polite">
          <b>{panel.speaker}</b>
          <span>{panel.line}</span>
        </span>
        <span className="opening-prologue-nav">
          <span className="opening-prologue-progress">
            <span className="sr-only">
              {panels.length}컷 중 {page + 1}번째
            </span>
            {panels.map((item, index) => (
              <i key={item.alt} data-current={index === page} />
            ))}
          </span>
          <strong>{page === panels.length - 1 ? '첫 매도벽 돌파' : '다음 컷'} ▸</strong>
        </span>
      </button>
    </main>
  )
}
