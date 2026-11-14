import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import portraits from './assets/cat-portraits.png'
import { IdleIcon } from './icons'

/** 앱 아이콘과 같은 입체 질감의 정면 초상화. 색뿐 아니라 귀·무늬·표정도 구분한다. */
const CATS: Record<CatCode, number> = {
  sky: 1,
  mint: 2,
  lilac: 3,
  sunset: 4,
  night: 5,
  snow: 6,
}

/** 카드·출전 칸·뽑기 결과가 같은 얼굴을 사용한다. code가 없으면 사장냥이다. */
export function CatPortrait({ code, locked }: { code?: CatCode; locked?: boolean }) {
  const cell = code ? CATS[code] : 0
  return (
    <span className={`idle-cat-portrait ${locked ? 'is-locked' : ''}`} aria-hidden="true">
      <svg
        className="idle-cat-face"
        viewBox={`${cell % 4} ${Math.floor(cell / 4)} 1 1`}
        aria-hidden="true"
        focusable="false"
      >
        <image href={portraits} width="4" height="2" />
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
