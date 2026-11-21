import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { useId } from 'react'
import faces from './assets/cat-face-rects.json'
import facesUrl from './assets/cat-faces.webp'
import type { CatGrade } from './catGrade'
import './s-cat.css'
import { IdleIcon } from './icons'

/** 카드 초상화 아틀라스(scripts/catFaceAtlas.py가 만든다). 전투 원본 대신 이 작은 그림 하나만 받는다. */
export const CAT_FACES_URL = facesUrl
const FACES: Record<string, { x: number; y: number; w: number; h: number }> = faces.faces

/** 카드·출전 칸·뽑기 결과가 같은 얼굴을 사용한다. code가 없으면 사장냥이다. */
export function CatPortrait({
  code,
  grade,
  locked,
}: {
  code?: CatCode
  grade?: CatGrade
  locked?: boolean
}) {
  const clipId = useId()
  const rect = (code && FACES[code]) || FACES.boss
  return (
    <span
      className={`idle-cat-portrait ${locked ? 'is-locked' : ''}`}
      data-starlight={(grade === 'S' && !locked) || undefined}
      aria-hidden="true"
    >
      <svg
        className="idle-cat-face"
        viewBox={`${rect.x} ${rect.y} ${rect.w} ${rect.h}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} />
          </clipPath>
        </defs>
        <image
          clipPath={`url(#${clipId})`}
          href={facesUrl}
          width={faces.width}
          height={faces.height}
          preserveAspectRatio="none"
        />
      </svg>
      {locked && <IdleIcon name="lock" />}
    </span>
  )
}

type Cat = NonNullable<Company['idle']>['cats'][number]

/** 이 고양이 총의 특성: 서버가 준 연사·치명타 배율을 그대로 읽는다. 공격력 특성은 damagePercent에 이미 들어 있다. */
export function catTrait(cat: Cat) {
  const parts = [
    cat.firePercent > 100 && `연사 +${cat.firePercent - 100}%`,
    cat.criticalPercent > 100 && `치명타 피해 +${cat.criticalPercent - 100}%`,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '공격력 특화'
}
