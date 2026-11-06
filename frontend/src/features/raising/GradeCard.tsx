import type { ReactNode } from 'react'
import type { Grade } from '../../api/client'
import { EMPLOYEE_LADDER } from './grades'

/**
 * 캐릭터 카드의 등급 티어 (decisions.md 294번): 게임 아이템 등급처럼 등급마다 테두리와 등급표가 다르다. F·E 무쇠 → D·C 구리 → B·A 은 → S·SS·SSS 금 →
 * X·XX·XXX 사파이어 → Z·ZZ·ZZZ 황금빛 → XS·XSS·GOD 무지개빛(홀로그램). 금부터는 빛이 흐르고, 사파이어부터는 빛이 번진다. 모양은 index.css의
 * `.grade-card`·`.grade-gem`과 티어 클래스가 그린다.
 */
export type Tier = 'common' | 'bronze' | 'silver' | 'gold' | 'blue' | 'royal' | 'holo'

export function tierOf(grade: Grade): Tier {
  const at = EMPLOYEE_LADDER.indexOf(grade)
  const from = (g: Grade) => at >= EMPLOYEE_LADDER.indexOf(g)
  if (from('XS')) {
    return 'holo'
  }
  if (from('Z')) {
    return 'royal'
  }
  if (from('X')) {
    return 'blue'
  }
  if (from('S')) {
    return 'gold'
  }
  if (from('B')) {
    return 'silver'
  }
  return from('D') ? 'bronze' : 'common'
}

export const TIER_NAMES: Record<Tier, string> = {
  common: '무쇠',
  bronze: '구리',
  silver: '은',
  gold: '금',
  blue: '사파이어',
  royal: '황금빛',
  holo: '무지개빛',
}

/** 티어마다 보석 수: 무쇠 1 … 무지개빛 7. 등급표 아래에 작은 보석으로 찍힌다. */
export const TIER_RANK: Record<Tier, number> = {
  common: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  blue: 5,
  royal: 6,
  holo: 7,
}

/** 금부터는 테두리에 빛이 흐르고 등급표에 윤이 지나간다. */
export function shines(tier: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK.gold
}

/** 카드와 등급표가 쓰는 클래스: 티어 클래스는 index.css에서 색·질감·빛을 정한다. */
export function tierClass(tier: Tier): string {
  return `tier-${tier}${shines(tier) ? ' tier-shine' : ''}`
}

/**
 * 캐릭터 카드 (decisions.md 294·301번): 티어의 금속 테두리(베벨·안쪽 빛)와 티어 색이 번진 바탕, 왼쪽 위 방패 등급표. 공채 지원자 카드와 직원 상세 카드가
 * 같이 쓴다. as로 li·section 등을 고른다. compact면 테두리가 얇고 등급표가 작다(사무실 미니맵 칸).
 */
export function GradeCard({
  grade,
  as: Tag = 'div',
  className = '',
  children,
  badgeLabel,
  compact = false,
  ...rest
}: {
  grade: Grade
  as?: 'div' | 'li' | 'section'
  className?: string
  children: ReactNode
  /** 등급표 아래 작은 글자에 붙는 말. "특급"만 적고 나머지는 티어 이름만 보인다. */
  badgeLabel?: string
  compact?: boolean
} & Partial<Record<`data-${string}` | 'aria-label', string | undefined>>) {
  const tier = tierOf(grade)
  return (
    <Tag
      className={`grade-card ${compact ? 'grade-card-sm' : ''} ${tierClass(tier)} ${className}`}
      data-tier={tier}
      {...rest}
    >
      <GradeBadge grade={grade} label={badgeLabel} size={compact ? 'sm' : 'full'} />
      {children}
    </Tag>
  )
}

/** 등급표 크기: full은 카드 모서리의 방패와 티어 이름·보석 수, sm은 작은 방패만(미니맵 칸), inline은 글줄 안에 끼우는 작은 방패(이름 앞). */
export type BadgeSize = 'full' | 'sm' | 'inline'

const BADGE_WIDTH: Record<BadgeSize, number> = { full: 56, sm: 30, inline: 18 }

/**
 * 방패 보석 안에 등급 글자: 위가 밝게 비치고 아래가 어두운 보석 질감, 글자는 새긴 듯 그림자. full이면 그 아래 티어 이름과 보석 수. 모양은 viewBox로 그려
 * 크기가 달라도 같은 비율이다.
 */
export function GradeBadge({
  grade,
  label,
  size = 'full',
}: {
  grade: Grade
  label?: string
  size?: BadgeSize
}) {
  const tier = tierOf(grade)
  const rank = TIER_RANK[tier]
  const id = `gem-${tier}`
  const width = BADGE_WIDTH[size]
  return (
    <span
      className={`grade-gem ${size === 'full' ? '' : `grade-gem-${size}`} ${tierClass(tier)}`}
      data-testid="grade-badge"
      data-grade={grade}
      data-tier={tier}
      data-size={size}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 56 60"
        width={width}
        height={Math.round((width * 60) / 56)}
        className="block"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" className="gem-stop-light" />
            <stop offset="0.5" className="gem-stop-base" />
            <stop offset="1" className="gem-stop-dark" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <path d="M28 6 L48 12 V30 C48 41 39 50 28 54 C17 50 8 41 8 30 V12 Z" />
          </clipPath>
          <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.48" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 방패: 바깥 어두운 테, 보석 몸통, 위쪽 광택 */}
        <path
          d="M28 2 L52 9 V30 C52 44 41 54 28 58 C15 54 4 44 4 30 V9 Z"
          className="gem-rim"
          strokeWidth={2.2}
          strokeLinejoin="round"
          fill={`url(#${id}-body)`}
        />
        <path
          d="M28 6 L48 12 V30 C48 41 39 50 28 54 C17 50 8 41 8 30 V12 Z"
          fill={`url(#${id}-gloss)`}
        />
        <path
          d="M28 6 L48 12 V30 C48 41 39 50 28 54 C17 50 8 41 8 30 V12 Z"
          fill="none"
          className="gem-inner"
          strokeWidth={0.8}
          opacity={0.6}
        />
        {shines(tier) && size !== 'inline' && (
          <rect
            x={-20}
            y={4}
            width={10}
            height={52}
            fill="#fff"
            opacity={0.55}
            transform="skewX(-18)"
            clipPath={`url(#${id}-clip)`}
          >
            <animate
              attributeName="x"
              values="-20;80;80"
              keyTimes="0;0.35;1"
              dur="3s"
              repeatCount="indefinite"
            />
          </rect>
        )}
        <text
          x="28"
          y={grade.length > 2 ? 36 : 38}
          textAnchor="middle"
          className={`gem-text font-mono-num ${grade.length > 2 ? 'text-[17px]' : 'text-[24px]'}`}
          fontWeight={700}
        >
          {grade}
        </text>
      </svg>
      {size === 'full' && (
        <>
          <span className="grade-gem-name">
            {label === '특급' ? '특급 · ' : ''}
            {TIER_NAMES[tier]}
          </span>
          <span className="grade-gem-rank">
            {Array.from({ length: rank }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 보석 수만 센다
              <i key={i} />
            ))}
          </span>
        </>
      )}
    </span>
  )
}
