import type { Grade } from '../../api/client'
import { gradeLabel, gradeTier } from './grades'

/**
 * 등급 배지 (decisions.md 287번). 등급마다 모양이 다르다: 층(F~D·C~A·S~SSS·EX~EX++·★~★★★)마다 색과 바탕이 바뀌고,
 * 층 안에서는 단계가 오를수록 테두리와 빛이 진해진다. ★★★는 금빛이 천천히 반짝인다(움직임 줄이기면 멈춘다). 생김새는 index.css의 .grade-badge.
 */
export function GradeBadge({ grade, size = 'md' }: { grade: Grade; size?: 'sm' | 'md' | 'lg' }) {
  const { tier, step } = gradeTier(grade)
  return (
    <span
      className="grade-badge"
      data-tier={tier}
      data-step={step}
      data-size={size}
      data-grade={grade}
      data-testid="grade-badge"
    >
      {gradeLabel(grade)}
    </span>
  )
}
