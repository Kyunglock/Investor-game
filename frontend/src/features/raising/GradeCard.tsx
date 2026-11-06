import type { CSSProperties, ReactNode } from 'react'
import type { Grade } from '../../api/client'
import { EMPLOYEE_LADDER } from './grades'

/**
 * 캐릭터 카드의 등급 티어 (decisions.md 294번): 수집 카드처럼 등급마다 테두리와 등급표가 다르다. F·E 회색 → D·C 구리 → B·A 은 → S·SS·SSS 금 → X·XX·XXX
 * 파란빛 → Z·ZZ·ZZZ 금빛 → XS·XSS·GOD 무지개빛(홀로그램). 금부터는 빛이 흐른다.
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
  common: '회색',
  bronze: '구리',
  silver: '은',
  gold: '금',
  blue: '파란빛',
  royal: '금빛',
  holo: '무지개빛',
}

/** 테두리에 흐르는 색. 두 색 이상이면 비스듬한 그라데이션이다. */
const EDGE: Record<Tier, string[]> = {
  common: ['#b9c2bf', '#d7dcd8'],
  bronze: ['#b87333', '#e0a46b', '#8f5a25'],
  silver: ['#8c97a3', '#dfe6ec', '#7b8692'],
  gold: ['#b2862b', '#f1d27a', '#9a7120'],
  blue: ['#2d5da8', '#9cc3ff', '#22355c'],
  royal: ['#d4a017', '#fff1b8', '#b2862b', '#ffe08a'],
  holo: ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff6b6b'],
}

/** 등급표 글자색과 바탕. */
const BADGE: Record<Tier, { bg: string; fg: string }> = {
  common: { bg: 'linear-gradient(135deg, #c8cfcc, #a9b2ae)', fg: '#ffffff' },
  bronze: { bg: 'linear-gradient(135deg, #d08a4a, #8f5a25)', fg: '#ffffff' },
  silver: { bg: 'linear-gradient(135deg, #e6ecf1, #8c97a3)', fg: '#2a3238' },
  gold: { bg: 'linear-gradient(135deg, #f1d27a, #b2862b)', fg: '#3a2a08' },
  blue: { bg: 'linear-gradient(135deg, #6f9fe6, #22355c)', fg: '#ffffff' },
  royal: { bg: 'linear-gradient(135deg, #fff1b8, #d4a017 55%, #b2862b)', fg: '#3a2a08' },
  holo: {
    bg: 'linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77, #4d96ff, #c77dff)',
    fg: '#ffffff',
  },
}

/** 금부터는 테두리에 빛이 흐르고, 금빛·무지개빛은 은은한 그림자가 번진다. */
const SHINE: Record<Tier, boolean> = {
  common: false,
  bronze: false,
  silver: false,
  gold: true,
  blue: true,
  royal: true,
  holo: true,
}

const GLOW: Partial<Record<Tier, string>> = {
  blue: '0 0 0 1px rgba(45, 93, 168, 0.15), 0 4px 14px rgba(45, 93, 168, 0.25)',
  royal: '0 0 0 1px rgba(212, 160, 23, 0.2), 0 4px 16px rgba(212, 160, 23, 0.35)',
  holo: '0 0 0 1px rgba(199, 125, 255, 0.2), 0 4px 18px rgba(77, 150, 255, 0.3)',
}

/** 테두리를 그라데이션으로 그리는 스타일: 안쪽은 카드색, 테두리 띠만 색이 흐른다. */
export function frameStyle(tier: Tier): CSSProperties {
  const edge = EDGE[tier]
  return {
    border: '3px solid transparent',
    background: `linear-gradient(var(--card), var(--card)) padding-box, linear-gradient(135deg, ${edge.join(', ')}) border-box`,
    backgroundSize: SHINE[tier] ? 'auto, 300% 300%' : undefined,
    boxShadow: GLOW[tier],
  }
}

/**
 * 캐릭터 카드 (decisions.md 294번): 등급 티어의 테두리와 오른쪽 위 등급표. 공채 지원자 카드와 직원 상세 카드가 같이 쓴다. as로 li·section 등을 고른다.
 */
export function GradeCard({
  grade,
  as: Tag = 'div',
  className = '',
  children,
  badgeLabel,
  ...rest
}: {
  grade: Grade
  as?: 'div' | 'li' | 'section'
  className?: string
  children: ReactNode
  /** 등급표 위에 작게 붙는 말: "종합", "지원자". 없으면 등급만. */
  badgeLabel?: string
} & Partial<Record<`data-${string}` | 'aria-label', string | undefined>>) {
  const tier = tierOf(grade)
  return (
    <Tag
      className={`relative rounded-lg ${SHINE[tier] ? 'card-shine' : ''} ${className}`}
      style={frameStyle(tier)}
      data-tier={tier}
      {...rest}
    >
      <GradeBadge grade={grade} label={badgeLabel} />
      {children}
    </Tag>
  )
}

/** 오른쪽 위 등급표: 티어 색의 방패 모양 띠에 등급 글자. */
export function GradeBadge({ grade, label }: { grade: Grade; label?: string }) {
  const tier = tierOf(grade)
  const badge = BADGE[tier]
  return (
    <span
      className={`pointer-events-none absolute -top-px -right-px z-10 flex min-w-11 flex-col items-center rounded-tr-md rounded-bl-lg px-2 pt-0.5 pb-1 font-mono-num leading-none shadow-sm ${
        SHINE[tier] ? 'badge-shine' : ''
      }`}
      style={{ background: badge.bg, color: badge.fg }}
      data-testid="grade-badge"
      data-grade={grade}
      aria-hidden="true"
    >
      {label && <span className="text-[9px] font-semibold tracking-wide opacity-85">{label}</span>}
      <b className={grade.length > 2 ? 'text-[15px]' : 'text-[18px]'}>{grade}</b>
    </span>
  )
}
