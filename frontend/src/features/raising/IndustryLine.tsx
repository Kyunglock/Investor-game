import type { Company } from '../../api/client'

/**
 * 업계 순위 (#351): 실제 유저 회사끼리 같은 연차의 연말 자본으로 견준 자리. 이름은 없다. 한 해도 마치지 않았으면 보이지 않는다.
 */
export function IndustryLine({
  company,
  className = '',
}: {
  company: Company
  className?: string
}) {
  const industry = company.industry
  if (!industry) {
    return null
  }
  const top = Math.max(1, Math.ceil((industry.rank * 100) / industry.total))
  return (
    <p className={`text-[12px] ${className}`} data-testid="industry">
      업계 순위 · 같은 {industry.year}년 차 회사 {industry.total.toLocaleString('ko-KR')}곳 가운데{' '}
      <b className={industry.rank === 1 ? 'text-gold' : ''}>
        {industry.rank === 1 ? '1위!' : `${industry.rank.toLocaleString('ko-KR')}위`}
      </b>{' '}
      <span className="opacity-70">(상위 {top}%)</span>
    </p>
  )
}
