import type { Company } from '@web/api/client'
import { type CSSProperties, useEffect, useState } from 'react'

/**
 * 살아 있는 거리 (#597, decisions.md 432번): 메인 화면 거리 그림 위에 얹는 움직임. 분기가 없어져(#803) 날씨는 늘 맑고, 계절은 실제 달력의 달을
 * 따른다(봄 꽃잎·여름 햇살·가을 낙엽·겨울 눈). 구름이 흐르고, 행인 고양이·자동차가 길을 지나간다(회사가 클수록 더 많이). 비·먹구름 그림은 날씨
 * 값만 바꾸면 다시 쓸 수 있게 남겨 둔다.
 *
 * 성능(#586과 같은 원칙): 모두 HTML 요소의 transform·opacity 애니메이션이라 브라우저가 합성 층에서 돌리고 SVG를 다시 그리지 않는다. 요소는 스무 개
 * 남짓, 앱이 뒤로 가거나 화면이 가려지면 멈추고, 움직임 줄이기면 그리지 않는다. 누르는 것을 막지 않는다(pointer-events: none).
 */
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** 날씨: 손익을 가르는 분기가 없어져 늘 맑다 (#803). */
export function weatherOf(): Weather {
  return 'sunny'
}

/** 달(1~12)을 계절로: 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울. */
export function seasonOf(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

/** 지나가는 것의 수: 회사 등급이 오를수록 거리가 붐빈다(2~6). */
export function passersOf(grade: string): number {
  const ladder = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']
  const at = ladder.indexOf(grade)
  return Math.min(6, 2 + Math.floor((at < 0 ? ladder.length : at) / 2))
}

const FALL: Record<Season, { count: number; glyph: string } | null> = {
  spring: { count: 9, glyph: '🌸' },
  summer: null,
  autumn: { count: 8, glyph: '🍂' },
  winter: { count: 12, glyph: '❄' },
}

/** 지나가는 것들: 행인 고양이 둘과 차 둘을 번갈아. */
const WALKERS = ['🐈', '🚕', '🐈‍⬛', '🛵', '🐈', '🚙'] as const

function useVisible() {
  const [visible, setVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  )
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

export function StreetLife({ company, paused = false }: { company: Company; paused?: boolean }) {
  const visible = useVisible()
  const reduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return null
  const weather = weatherOf()
  const season = seasonOf(new Date().getMonth() + 1)
  const fall = FALL[season]
  const rain = weather === 'rain' ? 14 : weather === 'storm' ? 22 : 0
  const walkers = passersOf(company.grade)
  return (
    <div
      className="toy-life"
      aria-hidden="true"
      data-testid="street-life"
      data-weather={weather}
      data-season={season}
      data-paused={paused || !visible || undefined}
    >
      <div className="toy-life-sky" />
      {weather === 'sunny' && <div className="toy-life-sun" />}
      {[0, 1, 2].map((i) => (
        <div
          key={`cloud-${i}`}
          className="toy-life-cloud"
          style={
            {
              top: `${14 + i * 7}%`,
              '--dur': `${48 + i * 17}s`,
              '--delay': `${-i * 19}s`,
            } as CSSProperties
          }
        />
      ))}
      {Array.from({ length: walkers }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 행인 자리다.
          key={`walk-${i}`}
          className={`toy-life-walker${i % 2 ? ' is-left' : ''}`}
          style={
            {
              '--lane': `${23 - (i % 2) * 1.6}%`,
              '--dur': `${13 + i * 3.7}s`,
              '--delay': `${-i * 5.3}s`,
            } as CSSProperties
          }
          data-testid="street-walker"
        >
          {WALKERS[i % WALKERS.length]}
        </span>
      ))}
      {fall &&
        Array.from({ length: fall.count }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 꽃잎·낙엽·눈 자리다.
            key={`fall-${i}`}
            className="toy-life-fall"
            style={
              {
                left: `${(i * 37) % 100}%`,
                '--dur': `${9 + (i % 4) * 2.3}s`,
                '--delay': `${-i * 1.7}s`,
              } as CSSProperties
            }
          >
            {fall.glyph}
          </span>
        ))}
      {Array.from({ length: rain }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 빗줄기 자리다.
          key={`rain-${i}`}
          className="toy-life-rain"
          style={
            {
              left: `${(i * 29) % 100}%`,
              '--dur': `${0.9 + (i % 3) * 0.25}s`,
              '--delay': `${-i * 0.13}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
