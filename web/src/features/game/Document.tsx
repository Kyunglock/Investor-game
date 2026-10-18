import type { ReactNode } from 'react'

interface Props {
  title: string
  /** 머리띠 오른쪽의 일련번호 같은 모노 글자 */
  number?: string
  children: ReactNode
  testId?: string
}

/** 출생 신고서, 인생 기록부처럼 한 장의 공문서 모양 (설계 5.6절). */
export function Document({ title, number, children, testId }: Props) {
  return (
    <section
      className="animate-reveal mx-auto w-full max-w-[640px] overflow-hidden rounded-md border border-line bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
      data-testid={testId}
    >
      <header className="flex items-center justify-between bg-wine px-5 py-2.5 text-white">
        <span className="text-sm font-bold">{title}</span>
        {number && <span className="font-mono-num text-xs">{number}</span>}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}
