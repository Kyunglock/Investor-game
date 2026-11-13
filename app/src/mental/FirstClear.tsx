import { useEffect, useEffectEvent, useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import './first-clear.css'

/** 별이 날아오는 시간 + 세 번째 별이 자리 잡은 뒤 여운. 저장 완료는 부모가 별도로 기다린다. */
export const FIRST_CLEAR_MS = 3400

export function FirstClear({ onComplete }: { onComplete: () => void }) {
  const [filled, setFilled] = useState(0)
  const complete = useEffectEvent(onComplete)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < 3; i++) {
      timers.push(setTimeout(() => sfx.whoosh(), 350 + i * 650))
      timers.push(
        setTimeout(
          () => {
            setFilled(i + 1)
            sfx.coin()
            haptic.medium()
            if (i === 2) sfx.fanfare()
          },
          800 + i * 650,
        ),
      )
    }
    timers.push(setTimeout(() => complete(), FIRST_CLEAR_MS))
    return () => timers.forEach(clearTimeout)
  }, [])
  return (
    <div className="first-clear" data-testid="first-clear" data-filled={filled}>
      <div className="first-clear-halo" aria-hidden="true" />
      <p className="first-clear-stage">STAGE 1-1</p>
      <h2>첫 돌파 성공!</h2>
      <div className="first-clear-stars" role="img" aria-label={`별 ${filled}개 획득`}>
        {[0, 1, 2].map((i) => (
          <span className="first-clear-slot" key={i} data-filled={filled > i}>
            <span aria-hidden="true">★</span>
            <b aria-hidden="true" style={{ animationDelay: `${350 + i * 650}ms` }}>
              ★
            </b>
            <i aria-hidden="true" style={{ animationDelay: `${800 + i * 650}ms` }} />
          </span>
        ))}
      </div>
      <p className="first-clear-caption" aria-live="polite">
        {filled === 3 ? '완벽한 첫 출발!' : '매도벽을 모두 돌파했어요'}
      </p>
    </div>
  )
}
