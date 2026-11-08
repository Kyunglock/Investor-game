import type { Company, Grade } from '@web/api/client'
import { LADDER } from '@web/features/raising/grades'

export const gradeIndex = (grade: Grade) => Math.max(0, LADDER.indexOf(grade))
export const expansionSide = (after: Grade) => (gradeIndex(after) % 2 === 1 ? 'left' : 'right')

/** Geometry is presentation only. Capacity always comes from the server. */
export function officeGeometry(grade: Grade, seats: number) {
  const count = Math.max(1, Math.floor(seats))
  const columns = Math.min(6, Math.max(4, Math.ceil(Math.sqrt(count))))
  const rows = Math.ceil(count / columns)
  const width = Math.max(170, columns * 38 + 18) + gradeIndex(grade) * 4
  const height = rows * 86 + 104
  const center = 195 - (gradeIndex(grade) % 2) * 6
  const x = center - width / 2
  const scale = Math.min(1, 265 / (height + 31), 245 / width)
  const positions = Array.from({ length: Math.max(0, seats) }, (_, i) => {
    const row = Math.floor(i / columns)
    const onRow = Math.min(columns, count - row * columns)
    return {
      x: x + 15 + ((width - 30) / onRow) * ((i % columns) + 0.5) - 18,
      y: 560 - 120 - row * 86,
    }
  })
  return { x, width, height, rows, center, scale, positions }
}

export function growthProgress(company: Company): { percent: number; label: string } {
  const plan = company.upgrade
  if (plan?.left != null) {
    const percent = Math.min(
      100,
      Math.max(0, ((plan.years - plan.left) / Math.max(1, plan.years)) * 100),
    )
    return { percent, label: `공사 중 · 완공까지 ${plan.left}년` }
  }
  if (!plan)
    return {
      percent: 100,
      label: company.status === 'ENDED' ? '지난 회사의 기록' : '최고 단계에 도착했어요',
    }
  const percent = Math.min(100, Math.max(0, (company.capital / Math.max(1, plan.needed)) * 100))
  return {
    percent,
    label: plan.affordable
      ? '준비 완료 · 건물을 키울 수 있어요'
      : `다음 확장까지 ${Math.floor(percent)}%`,
  }
}

const RIVALS = [
  '치즈증권',
  '삼색캐피탈',
  '턱시도자산',
  '페르시안금융',
  '골든캣홀딩스',
  '노르웨이펀드',
  '러시안블루증권',
]
export function rivalName(grade: Grade, side: 'left' | 'right') {
  const n = gradeIndex(grade)
  const i = side === 'left' ? 2 * Math.ceil(n / 2) : 1 + 2 * Math.floor(n / 2)
  return RIVALS[i % RIVALS.length]
}
