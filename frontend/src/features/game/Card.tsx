import type { ReactNode } from 'react'

interface Props {
  title?: string
  /** 제목 오른쪽의 작은 보조 설명 (예: "0–100", "한 칸 = 1년") */
  aside?: ReactNode
  children: ReactNode
  className?: string
  testId?: string
}

/** 흰 바탕, 가는 테두리, 6px 모서리의 기록부 카드 (설계 4.3절). */
export function Card({ title, aside, children, className = '', testId }: Props) {
  return (
    <section
      className={`rounded-md border border-line bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className}`}
      data-testid={testId}
    >
      {title && (
        <h2 className="mb-2.5 flex items-baseline justify-between text-[15px] font-bold">
          <span>{title}</span>
          {aside && <span className="text-[11px] font-normal text-faint">{aside}</span>}
        </h2>
      )}
      {children}
    </section>
  )
}
