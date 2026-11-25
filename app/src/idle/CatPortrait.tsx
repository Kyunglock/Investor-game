import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { useId } from 'react'
import faces from './assets/cat-face-rects.json'
import facesUrl from './assets/cat-faces.webp'
import abyss from './assets/portrait-abyss.webp'
import aurora from './assets/portrait-aurora.webp'
import dune from './assets/portrait-dune.webp'
import flora from './assets/portrait-flora.webp'
import frost from './assets/portrait-frost.webp'
import ruby from './assets/portrait-ruby.webp'
import silver from './assets/portrait-silver.webp'
import star from './assets/portrait-star.webp'
import veil from './assets/portrait-veil.webp'
import wisteria from './assets/portrait-wisteria.webp'
import type { CatGrade } from './catGrade'
import { IdleIcon } from './icons'

/** 카드 초상화 아틀라스(scripts/catFaceAtlas.py가 만든다). 전투 원본 대신 이 작은 그림 하나만 받는다. */
export const CAT_FACES_URL = facesUrl
/** 따로 그린 초상화가 있는 고양이. 식빵 그림이 없는 고양이는 공방에서도 이 그림을 쓴다(LoafCat.tsx). */
export const SPECIAL_PORTRAITS: Partial<Record<CatCode, string>> = {
  star,
  silver,
  wisteria,
  frost,
  ruby,
  abyss,
  dune,
  veil,
  flora,
  aurora,
}
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
  const portrait = code && SPECIAL_PORTRAITS[code]
  const rect = (code && FACES[code]) || FACES.boss
  return (
    <span
      className={`idle-cat-portrait ${locked ? 'is-locked' : ''}`}
      data-starlight={((grade === 'S' || grade === 'SS') && !locked) || undefined}
      aria-hidden="true"
    >
      {portrait ? (
        <img className="idle-cat-face" src={portrait} alt="" draggable={false} />
      ) : (
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
      )}
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
