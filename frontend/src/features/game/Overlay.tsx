import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * 화면을 어둡게 하고 카드를 가운데 띄운다. 뉴스처럼 '중대 결정'일 때만 쓴다 (설계 5.3절). body에 바로 그린다: 공문서 카드의 등장 애니메이션(transform)
 * 안에 있으면 fixed가 화면이 아니라 그 카드에 붙는다.
 */
export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[rgba(30,40,40,0.45)] px-4 py-10 sm:items-center">
      <div className="animate-reveal w-full max-w-[520px]">{children}</div>
    </div>,
    document.body,
  )
}
