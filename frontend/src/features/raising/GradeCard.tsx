import { type ReactNode, useId } from 'react'
import type { Grade } from '../../api/client'
import { EMPLOYEE_LADDER } from './grades'

/**
 * 캐릭터 카드의 등급 티어 (decisions.md 294번): 게임 아이템 등급처럼 등급마다 테두리와 등급표가 다르다. F·E 무쇠 → D·C 구리 → B·A 은 → S·SS·SSS 금 →
 * X·XX·XXX 사파이어 → Z·ZZ·ZZZ 황금빛 → XS·XSS·GOD 무지개빛(홀로그램). 금부터는 빛이 흐르고, 사파이어부터는 빛이 번진다. 문장은 티어마다 월계수·날개·왕관을 더하며, 색은 index.css의
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

/**
 * 등급표 크기: full은 카드 모서리의 방패와 티어 이름·보석 수, sm은 작은 방패만(미니맵 칸), md는 글줄 안에서 눈에 띄는 방패(결산서의 팀장, 금부터
 * 빛이 흐르고 번진다, 397번), inline은 글줄 안에 끼우는 작은 방패(이름 앞).
 */
export type BadgeSize = 'full' | 'sm' | 'md' | 'inline'

const BADGE_WIDTH: Record<BadgeSize, number> = { full: 56, sm: 30, md: 26, inline: 18 }

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
  const id = `gem-${useId().replace(/:/g, '')}`
  const ornate = rank >= 4
  const royal = rank >= 6
  const marks =
    tier === 'holo'
      ? EMPLOYEE_LADDER.indexOf(grade) - EMPLOYEE_LADDER.indexOf('XS') + 1
      : Math.min(3, grade.length)
  const body =
    tier === 'gold'
      ? 'M28 13 A18 18 0 1 1 27.99 13 Z'
      : tier === 'blue'
        ? 'M28 10 L44 20 L44 39 L28 51 L12 39 L12 20 Z'
        : royal
          ? 'M28 15 L43 21 L41 39 L28 49 L15 39 L13 21 Z'
          : tier === 'bronze'
            ? 'M17 5 H39 L50 16 V43 L39 55 H17 L6 43 V16 Z'
            : tier === 'silver'
              ? 'M28 2 L51 15 L47 40 L28 57 L9 40 L5 15 Z'
              : 'M28 3 L51 10 V30 C51 43 40 53 28 57 C16 53 5 43 5 30 V10 Z'
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
            <path d={body} />
          </clipPath>
          <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.48" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 장식도 viewBox 안에 두어 카드·이름 줄의 기존 점유 폭을 넘지 않는다. */}
        {ornate && (
          <g className="gem-regalia" strokeLinejoin="round">
            {tier === 'gold' && (
              <>
                <path
                  d="M19 50 C2 43 1 26 9 18 M37 50 C54 43 55 26 47 18"
                  fill="none"
                  strokeWidth="1.6"
                />
                {[0, 1, 2, 3].map((i) => (
                  <g key={i}>
                    <ellipse
                      cx={6 + i * 0.6}
                      cy={23 + i * 7}
                      rx="2.2"
                      ry="4"
                      transform={`rotate(-35 ${6 + i * 0.6} ${23 + i * 7})`}
                    />
                    <ellipse
                      cx={50 - i * 0.6}
                      cy={23 + i * 7}
                      rx="2.2"
                      ry="4"
                      transform={`rotate(35 ${50 - i * 0.6} ${23 + i * 7})`}
                    />
                  </g>
                ))}
                <path d="M28 1 L30 6 L36 6 L31 10 L33 15 L28 12 L23 15 L25 10 L20 6 L26 6 Z" />
              </>
            )}
            {rank >= 5 && (
              <>
                <path d="M16 23 L2 14 L4 27 L16 34 M40 23 L54 14 L52 27 L40 34" />
                <path d="M15 33 L2 27 L6 39 L18 43 M41 33 L54 27 L50 39 L38 43" />
                {royal && <path d="M17 42 L5 38 L11 49 L23 51 M39 42 L51 38 L45 49 L33 51" />}
              </>
            )}
            {royal && (
              <>
                <path d="M17 15 L14 5 L23 9 L28 1 L33 9 L42 5 L39 15 Z" />
                <path d="M16 50 L10 57 L23 55 L28 59 L33 55 L46 57 L40 50 Z" />
                <path d="M17 16 H39" fill="none" strokeWidth="2" />
              </>
            )}
            {tier === 'holo' && (
              <>
                <ellipse
                  cx="28"
                  cy="31"
                  rx="26"
                  ry="22"
                  fill="none"
                  strokeWidth=".8"
                  opacity=".65"
                />
                <path d="M2 7 L4 3 L6 7 L10 9 L6 11 L4 15 L2 11 L0 9 Z M50 9 L52 5 L54 9 L56 11 L54 13 L52 17 L50 13 L48 11 Z" />
              </>
            )}
          </g>
        )}
        <path
          d={body}
          className="gem-rim"
          strokeWidth={ornate ? 2 : 2.2}
          strokeLinejoin="round"
          fill={`url(#${id}-body)`}
        />
        <path d={body} fill={`url(#${id}-gloss)`} />
        <path
          d={body}
          fill="none"
          className="gem-inner"
          strokeWidth="1"
          transform="translate(28 31) scale(.86) translate(-28 -31)"
        />
        {ornate && size !== 'inline' && (
          <g className="gem-regalia">
            {Array.from({ length: marks }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 훈장 표식의 개수
              <path key={i} d={`M${28 + (i - (marks - 1) / 2) * 6} 40 l2 3 -2 3 -2 -3 Z`} />
            ))}
          </g>
        )}
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
          y={ornate ? 36 : 38}
          textAnchor="middle"
          className={`gem-text font-mono-num ${grade.length > 2 ? 'text-[14px]' : grade.length > 1 ? 'text-[18px]' : 'text-[23px]'}`}
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

/** 결산서의 팀원 등급 줄 (decisions.md 397번): "외 N명" 대신 팀원 등급을 작은 방패로 높은 것부터(S · A · C). 팀원이 없으면 아무것도 없다. */
export function MemberGrades({ grades }: { grades: Grade[] }) {
  if (grades.length === 0) {
    return null
  }
  return (
    <span
      className="inline-flex items-center"
      role="img"
      aria-label={`팀원 등급 ${grades.join(' · ')}`}
      data-testid="member-grades"
    >
      {grades.map((grade, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 같은 등급이 여럿일 수 있고 줄은 한 번 그리면 그대로다
        <GradeBadge key={i} grade={grade} size="inline" />
      ))}
    </span>
  )
}
