/** 최근 12달 가격을 작은 선으로. 값이 하나면 수평선이다. */
export function Sparkline({
  values,
  width = 90,
  height = 26,
  className = '',
}: {
  values: number[]
  width?: number
  height?: number
  className?: string
}) {
  if (values.length === 0) {
    return null
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : 0
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`,
    )
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="최근 12달 가격"
    >
      <polyline fill="none" stroke="var(--teal)" strokeWidth={1.5} points={points} />
    </svg>
  )
}
