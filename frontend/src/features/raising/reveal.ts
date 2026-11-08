import type { CSSProperties } from 'react'

/**
 * 결산서 줄이 차례로 드러나는 시각표 (decisions.md 240·396번, 연말 결산서와 분기 실적). 부를 때마다 그 줄의 드러남을 돌려주고, 다음 줄은 ms만큼 늦게
 * 드러난다. staged가 아니면(지난 결산 탭 등) 그냥 보인다.
 */
export function revealer(staged: boolean, step: number) {
  let at = 0
  return (ms = step): { className: string; style?: CSSProperties } => {
    if (!staged) {
      return { className: '' }
    }
    const style = { animationDelay: `${at}ms`, animationFillMode: 'both' as const }
    at += ms
    return { className: 'animate-reveal', style }
  }
}
