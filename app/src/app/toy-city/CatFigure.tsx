import type { Grade } from '@web/api/client'
import { breedOf } from '@web/features/game/cat/look'
import { LADDER } from '@web/features/raising/grades'

/** 눈: 뜬 눈, 웃는 눈(팀장), 감은 눈(휴게실에서 조는 동료). */
export type CatEyes = 'open' | 'happy' | 'sleep'

/** 정장 색: 등급이 높으면 짙은 정장. 팀장도 짙은 정장을 입는다. */
export function suitOf(grade: Grade, leader = false): string {
  return leader || LADDER.indexOf(grade) >= 6 ? '#526780' : '#779a9a'
}

/**
 * 정장 입은 고양이 직원 한 마리 (viewBox 0 0 36 40). 메인 거리와 인력 관리의 사무실이 같이 그린다. 털빛은 번호로 정해진 품종(breedOf)을 따른다.
 * <g>라서 바깥 <svg> 안에 넣는다.
 */
export function CatFigure({
  id = 0,
  grade = 'F',
  eyes = 'open',
  suit,
}: {
  id?: number
  grade?: Grade
  eyes?: CatEyes
  /** 정장 색. 없으면 등급으로 정한다. */
  suit?: string
}) {
  const fur = breedOf(id).fur
  // 흰둥이·삼색이처럼 밝은 털은 밝은 벽에 묻히지 않게 얇은 테를 두른다.
  const light = [1, 3, 5].every((at) => Number.parseInt(fur.slice(at, at + 2), 16) >= 0xe0)
  return (
    <g>
      <path d="M8 39Q7 22 18 22t10 17" fill={suit ?? suitOf(grade)} />
      <path d="m14 24 4 5 4-5" fill="#fff9e9" />
      <path d="m17 29-2 7 3 3 3-3-2-7" fill="#e9af5b" />
      <path
        d="M5 14 4 2l11 7h6L32 2l-1 14q0 10-13 10T5 14"
        fill={fur}
        stroke={light ? '#d6c9b2' : 'none'}
        strokeWidth=".8"
      />
      <path d="m7 5 5 5-5 2m22-7-5 5 5 2" fill="#eaa99a" />
      {eyes === 'open' && (
        <>
          <circle cx="12" cy="17" r="1.3" fill="#40424b" />
          <circle cx="24" cy="17" r="1.3" fill="#40424b" />
        </>
      )}
      {eyes !== 'open' && (
        <path
          d={eyes === 'happy' ? 'M10 18q2-3 4 0M22 18q2-3 4 0' : 'M10 17h4M22 17h4'}
          fill="none"
          stroke="#40424b"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      )}
      <path
        d="m16 21 2 1 2-1"
        fill="none"
        stroke="#80645c"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </g>
  )
}
