import { type ReactNode, useId } from 'react'
import { magicTier } from '../mental/magic'
import type { SkillCode } from './skills'
import './skill-badge.css'

/** 스킬마다 고유 색 (#800): 물 파랑, 운석 주황·빨강, 번개 노랑, 충차 갈색. light는 그림, mid·dark는 바탕, line은 외곽선. */
const COLORS: Record<SkillCode, { light: string; mid: string; dark: string; line: string }> = {
  water: { light: '#e6f7ff', mid: '#5cc0ff', dark: '#1f72d8', line: '#103f86' },
  meteor: { light: '#fff0b8', mid: '#ff9a3d', dark: '#dc3b2a', line: '#7c1d12' },
  bolt: { light: '#fffbd0', mid: '#ffd633', dark: '#f09a00', line: '#7a4a00' },
  ram: { light: '#fbe8c2', mid: '#cf9257', dark: '#8a5326', line: '#4a2a10' },
}
/** 못 가진 스킬: 흑백. */
const GRAY = { light: '#e4dfd5', mid: '#cfc8ba', dark: '#a39b8c', line: '#6f685b' }
/** 테두리 (#800): 스킬 Lv.1은 스킬 색, Lv.2는 은, Lv.3부터는 금. */
const RIMS = [null, ['#f7fafd', '#a9b6c8'], ['#fff3b0', '#eaa91f']] as const

/** 운석 하나: 불꼬리와 달궈진 돌. */
function Meteor({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="tail" d="M-4.2-3.4 14.5-15 3.6 4.4Z" />
      <circle r="5.4" />
      <path className="mark" d="M-2.4-1.2a1.4 1.4 0 1 0 .1 0M1.6 1.6a1 1 0 1 0 .1 0" />
    </g>
  )
}

/** 스킬 그림: 레벨에 따라 세 단계로 달라진다 (magic.ts MagicTier). 48×48 칸의 가운데(24, 24)에 그린다. */
const GLYPHS: Record<SkillCode, Record<1 | 2 | 3, ReactNode>> = {
  water: {
    // 물방울
    1: (
      <>
        <path d="M24 13.5c4.2 5 6.6 8.4 6.6 11.6a6.6 6.6 0 0 1-13.2 0c0-3.2 2.4-6.6 6.6-11.6Z" />
        <path className="mark" d="M20.8 25.4a3.3 3.3 0 0 0 2.5 3.1" />
      </>
    ),
    // 물줄기
    2: (
      <>
        <path className="jet-line" d="M12.5 32.5c5.6 0 8.2-3.6 9.8-7.8s4-8 10.2-8.4" />
        <path className="jet" d="M12.5 32.5c5.6 0 8.2-3.6 9.8-7.8s4-8 10.2-8.4" />
        <circle cx="36" cy="12.6" r="1.8" />
        <circle cx="37.4" cy="19.6" r="1.4" />
        <circle cx="15.4" cy="21" r="1.9" />
      </>
    ),
    // 큰 물결
    3: (
      <>
        <path d="M5 40V30.5c2.4-9.4 8.8-16 17.4-16 6 0 10.4 3.2 11.8 8-2.4-1.6-5.6-1.5-7.4.4-1.9 2-1.5 5.2.8 6.8 2.6 1.8 6.4 1.2 8.6-.9 1.2 2.6 3.8 3.6 6.8 3.2V40Z" />
        <path className="mark" d="M11.5 30.5c1.6-5.4 5-9.4 9.6-10.6M16.5 33.5c.8-2.6 2.2-4.6 4-6" />
        <circle cx="35.5" cy="15" r="1.9" />
        <circle cx="38.6" cy="20.5" r="1.3" />
      </>
    ),
  },
  meteor: {
    1: <Meteor x={20.5} y={27.5} s={0.95} />,
    2: (
      <>
        <Meteor x={19.5} y={28.5} s={1.3} />
        <path className="spark" d="M30.5 13.5l4-2.8M34.6 21l3.2-2" />
      </>
    ),
    // 유성우
    3: (
      <>
        <Meteor x={29} y={20.5} s={0.72} />
        <Meteor x={15.5} y={24} s={0.72} />
        <Meteor x={24.5} y={33} s={0.86} />
      </>
    ),
  },
  bolt: {
    1: <path d="M26 13.5 18.2 25h4.4l-1.8 9.5L29.6 22h-4.8Z" />,
    2: <path d="M27.5 11.5 16.2 25.6h6.2l-2.6 11 12-15.4h-6.6Z" />,
    // 여러 갈래
    3: (
      <>
        <path d="M27.5 11 16.6 25.2h6l-2.6 11.4 11.8-15.6h-6.4Z" />
        <path d="M14.4 13.4 9.8 20h2.8l-1.2 5.2 5.2-7.2h-2.9Z" />
        <path d="M36.6 23.6 32.4 29.6h2.6l-1.1 4.8 4.9-6.7h-2.8Z" />
      </>
    ),
  },
  ram: {
    // 돌 충차
    1: (
      <>
        <path className="log" d="M13 21.2h15v6.4H13Z" />
        <path className="head" d="M28 19.8 35 24.4 28 29Z" />
        <path className="mark" d="M17.5 21.4v6M22.5 21.4v6" />
        <circle className="wheel" cx="17" cy="30.6" r="2.7" />
        <circle className="wheel" cx="25" cy="30.6" r="2.7" />
      </>
    ),
    // 바위 충차
    2: (
      <>
        <path className="log" d="M11 19.6h16.5v8.4H11Z" />
        <path className="head" d="M27.5 17.4 33 16.8l4.2 7.4L33 31l-5.5-.8Z" />
        <path className="mark" d="M15.6 19.8v8M21 19.8v8" />
        <circle className="wheel" cx="15.6" cy="31.6" r="3.2" />
        <circle className="wheel" cx="24.6" cy="31.6" r="3.2" />
      </>
    ),
    // 대지 충차
    3: (
      <>
        <path className="log" d="M8.6 18.6h17v9.6h-17Z" />
        <path className="head" d="M25.6 16 31.6 15l4.6 8.4-4.6 8.2-6-1Z" />
        <path className="mark" d="M13.4 18.8v9.2M19.4 18.8v9.2" />
        <circle className="wheel" cx="13.4" cy="32" r="3.4" />
        <circle className="wheel" cx="22.6" cy="32" r="3.4" />
        <path className="spark" d="M38.4 16.4l2.6-2.4M39.4 23.6h3.4M38.4 30.4l2.6 2.4" />
      </>
    ),
  },
}

/** 별 하나 (반지름 r). */
function star(cx: number, cy: number, r: number) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const d = i % 2 === 0 ? r : r * 0.46
    return `${(cx + Math.cos(a) * d).toFixed(2)} ${(cy + Math.sin(a) * d).toFixed(2)}`
  })
  return `M${points.join('L')}Z`
}

/**
 * 스킬 배지 (decisions.md 531번, #800): 둥근 틀 안에 스킬 그림을 넣는다. 스킬마다 고유 색이 있고, 레벨이 오르면 그림(물방울 → 물줄기 → 큰 물결
 * 등)과 테두리(스킬 색 → 은 → 금, Lv.4부터 햇살)와 아래의 별 수가 달라진다. 못 가진 스킬은 흑백에 자물쇠다. 작게(28px 미만) 그리면 별·반짝임을
 * 빼고 선을 굵게 해 뭉개지지 않게 한다.
 */
export function SkillBadge({
  skill,
  level = 1,
  size = 48,
  locked = false,
  label,
}: {
  skill: SkillCode
  /** 스킬 레벨 1~5. */
  level?: number
  /** 한 변의 길이(px). */
  size?: number
  locked?: boolean
  /** 화면 낭독기가 읽을 이름. 없으면 꾸밈으로 치고 읽지 않는다. */
  label?: string
}) {
  // 같은 화면에 배지가 여럿이라 그라데이션 이름이 겹치지 않게 한다. useId의 ':'는 url()에 못 쓴다.
  const id = `sb${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const lv = Math.max(1, Math.min(5, Math.round(level)))
  const tier = locked ? 1 : magicTier(lv)
  const small = size < 28
  const c = locked ? GRAY : COLORS[skill]
  const rim = locked ? null : RIMS[tier - 1]
  const line = small ? 2.4 : 1.5
  const rays = locked || small || lv < 4 ? 0 : lv === 4 ? 8 : 12
  /** 햇살은 별이 박힌 아래쪽을 비운다. */
  const rayAt = (i: number) => (360 / rays) * i
  const stars = locked || small ? 0 : lv
  return (
    <svg
      className={`skill-badge ${locked ? 'is-locked' : ''}`}
      data-testid="skill-badge"
      data-skill={skill}
      data-level={locked ? 0 : lv}
      // 작게 그릴 때는 햇살·별 자리를 잘라 그림을 키운다.
      viewBox={small ? '3 3 42 42' : '0 0 48 48'}
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}d`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={rim ? rim[0] : c.light} />
          <stop offset="1" stopColor={rim ? rim[1] : c.mid} />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor={c.light} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <circle cx="24" cy="24" r="15.4" />
        </clipPath>
      </defs>
      {/* Lv.4부터 테두리 밖으로 햇살이 돋는다. */}
      {rays > 0 && (
        <g fill="#ffd34d" stroke={c.line} strokeWidth="1.1">
          {Array.from({ length: rays }, (_, i) => i)
            .filter((i) => Math.abs(rayAt(i) - 180) > 62)
            .map((i) => (
              <path key={i} d="M20.4 6.4 24 .5l3.6 5.9Z" transform={`rotate(${rayAt(i)} 24 24)`} />
            ))}
        </g>
      )}
      <circle cx="24" cy="24" r="20" fill={c.line} />
      <circle cx="24" cy="24" r={20 - line * 0.8} fill={`url(#${id}r)`} />
      <circle cx="24" cy="24" r="16.4" fill={c.line} />
      <circle cx="24" cy="24" r="15.4" fill={`url(#${id}d)`} />
      <g clipPath={`url(#${id}c)`}>
        <ellipse
          cx="18"
          cy="15"
          rx="11"
          ry="6"
          fill="#fff"
          opacity=".2"
          transform="rotate(-24 18 15)"
        />
        <g
          className={`skill-badge-glyph is-${skill}`}
          fill={`url(#${id}g)`}
          stroke={c.line}
          strokeWidth={line}
          strokeLinejoin="round"
          strokeLinecap="round"
          paintOrder="stroke"
          opacity={locked ? 0.45 : 1}
        >
          {GLYPHS[skill][tier]}
        </g>
      </g>
      {/* 스킬 레벨만큼 아래 테두리에 별이 박힌다. */}
      {stars > 0 && (
        <g
          fill="#ffe14d"
          stroke={c.line}
          strokeWidth="1"
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {Array.from({ length: stars }, (_, i) => {
            const a = Math.PI / 2 + (i - (stars - 1) / 2) * 0.4
            return (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: 별은 자리 번호가 곧 열쇠다.
                key={i}
                d={star(24 + Math.cos(a) * 19.4, 24 + Math.sin(a) * 19.4, 3.6)}
              />
            )
          })}
        </g>
      )}
      {!locked && !small && (
        <g className="skill-badge-glints" fill="#fff">
          <path d="M33.5 9.6l1 2.9 2.9 1-2.9 1-1 2.9-1-2.9-2.9-1 2.9-1Z" />
          <path d="M11.6 28.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" />
        </g>
      )}
      {locked && (
        <g
          stroke={GRAY.line}
          strokeWidth={small ? 2.2 : 1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M19.6 23.5v-3.3a4.4 4.4 0 0 1 8.8 0v3.3" fill="none" />
          <rect x="16.4" y="23" width="15.2" height="11" rx="2.6" fill="#fbf8f1" />
          {!small && <path d="M24 27.4v2.6" />}
        </g>
      )}
    </svg>
  )
}
