import type { Grade } from '@web/api/client'
import atlas from './assets/cat-atlas.png'

/** 승인된 2D 아틀라스의 네 품종. 직원 ID로 외형을 고정한다. */
export function OfficeCat({ id = 3, grade = 'F' }: { id?: number; grade?: Grade }) {
  const column = Math.abs(id) % 4
  return (
    <g data-grade={grade}>
      <svg
        aria-hidden="true"
        x="-1"
        y="-7"
        width="38"
        height="49"
        viewBox={`${column * 540} 0 540 720`}
      >
        <image href={atlas} width="2160" height="720" />
      </svg>
    </g>
  )
}
