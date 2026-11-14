import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { STAGE_ASSETS } from '../mental/assets'
import { IdleIcon } from './icons'

/** 고양이마다 제 그림 (488·492·493번). 그림은 접힌 귀·장모 둘이고, 나머지는 빛깔(tone)로 가린다. */
const CATS: Record<CatCode, { art: string; tone?: string }> = {
  sky: { art: STAGE_ASSETS.fold },
  mint: { art: STAGE_ASSETS.fluffy },
  lilac: { art: STAGE_ASSETS.fold, tone: 'lilac' },
  sunset: { art: STAGE_ASSETS.fluffy, tone: 'sunset' },
  night: { art: STAGE_ASSETS.fold, tone: 'night' },
  snow: { art: STAGE_ASSETS.fluffy, tone: 'snow' },
}

/** 고양이 얼굴 칸. code가 없으면 사장냥이다. */
export function CatPortrait({ code, locked }: { code?: CatCode; locked?: boolean }) {
  const look = code ? CATS[code] : { art: STAGE_ASSETS.hero }
  return (
    <span
      className={`idle-cat-portrait ${locked ? 'is-locked' : ''} ${look.tone ? `is-${look.tone}` : ''}`}
      aria-hidden="true"
    >
      <img src={look.art} alt="" draggable={false} />
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
