import { type Grade, gradeOf, gradeTone } from './grade'

/** 등급 배지. 점수를 받아 등급을 매기고 색을 입힌다 (decisions.md 24번). */
export function GradeBadge({ score, className = '' }: { score: number; className?: string }) {
  const grade: Grade = gradeOf(score)
  return (
    <span
      className={`inline-block min-w-[30px] rounded-sm px-1 text-center font-mono-num text-[10px] font-bold leading-4 ${gradeTone(grade)} ${className}`}
      data-testid="grade"
    >
      {grade}
    </span>
  )
}
