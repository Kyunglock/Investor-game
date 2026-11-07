import { memo } from 'react'
import type { Grade } from '../../api/client'
import { INK } from '../game/cat/draw'
import { OFFICE_NAMES, TIER_ORDER, TIER_SHORT, type Tier, tierOf } from './office'

/**
 * 건물 그림 (decisions.md 238·343번). 도트가 아니라 고양이 그림(341번)과 같은 규칙의 벡터다: 갈색 가는 윤곽 하나, 파스텔 면, 둥근 모서리.
 * 128×80 상자에 그리고 길바닥은 72행이다(공사 중 그림 ConstructionArt가 같은 상자 위에 얹힌다). 단계(Tier)마다 건물 하나: 반지하 빌라 → 상가 2층 → 작은 빌딩 →
 * 여의도 빌딩 → 빌딩 통째 → 사옥 → 랜드마크 타워. 불 켜진 창이 우리 자리다.
 */
export const BUILDING_W = 128
export const BUILDING_H = 80
export const BUILDING_GROUND = 72

const SKY = '#dff1f7'
const GROUND = '#d9cfbf'
const LIT = '#ffd98a'
const DARK = '#bcd6ea'
const STROKE = 1.3

type Win = { x: number; y: number; w: number; h: number; lit?: boolean; r?: number }

function Windows({ wins }: { wins: Win[] }) {
  return (
    <>
      {wins.map((w) => (
        <rect
          key={`${w.x}-${w.y}`}
          x={w.x}
          y={w.y}
          width={w.w}
          height={w.h}
          rx={w.r ?? 1}
          fill={w.lit ? LIT : DARK}
          stroke={INK}
          strokeWidth={0.9}
        />
      ))}
    </>
  )
}

/** 창을 격자로 늘어놓는다. lit은 불 켜진 행(위에서부터 0) 또는 전부. */
function grid(
  x: number,
  y: number,
  cols: number,
  rows: number,
  w: number,
  h: number,
  gx: number,
  gy: number,
  lit: number[] | 'all' | 'none',
): Win[] {
  const out: Win[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: x + c * (w + gx),
        y: y + r * (h + gy),
        w,
        h,
        lit: lit === 'all' ? true : lit === 'none' ? false : lit.includes(r),
      })
    }
  }
  return out
}

function Box({
  x,
  y,
  w,
  h,
  fill,
  r = 2.5,
}: {
  x: number
  y: number
  w: number
  h: number
  fill: string
  r?: number
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      fill={fill}
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinejoin="round"
    />
  )
}

function Door({ x, y, w = 7, h = 10 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={1.5}
        fill="#a98464"
        stroke={INK}
        strokeWidth={0.9}
      />
      <circle cx={x + w - 2} cy={y + h / 2} r={0.7} fill={INK} />
    </>
  )
}

function Tree({ x }: { x: number }) {
  const g = BUILDING_GROUND
  return (
    <>
      <rect
        x={x - 1.2}
        y={g - 9}
        width={2.4}
        height={9}
        rx={1}
        fill="#a98464"
        stroke={INK}
        strokeWidth={0.8}
      />
      <ellipse
        cx={x}
        cy={g - 13}
        rx={6}
        ry={6.5}
        fill="#8fcf86"
        stroke={INK}
        strokeWidth={STROKE}
      />
      <ellipse cx={x - 2} cy={g - 16} rx={1.6} ry={1} fill="rgba(255,255,255,.4)" />
    </>
  )
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={0.95}>
      <ellipse cx={0} cy={0} rx={7} ry={4} fill="#fff" />
      <ellipse cx={5} cy={-1.5} rx={5} ry={4} fill="#fff" />
      <ellipse cx={-5} cy={-1} rx={4.5} ry={3.2} fill="#fff" />
    </g>
  )
}

/** 작은 간판: 고양이 발바닥 점 하나 + 띠. */
function Sign({ x, y, w, col = '#ff9fc0' }: { x: number; y: number; w: number; col?: string }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={5} rx={1.5} fill={col} stroke={INK} strokeWidth={0.9} />
      <circle cx={x + 3} cy={y + 2.5} r={1.1} fill={INK} />
      {w > 12 && <rect x={x + 6} y={y + 1.7} width={w - 8} height={1.6} rx={0.8} fill="#fff" />}
    </>
  )
}

/** 뒷배경의 먼 건물들(연한 윤곽만). */
function FarCity({ tops }: { tops: [number, number, number][] }) {
  return (
    <>
      {tops.map(([x, w, top]) => (
        <rect
          key={x}
          x={x}
          y={top}
          width={w}
          height={BUILDING_GROUND - top}
          fill="#cfe0ea"
          stroke="#a8bfcc"
          strokeWidth={0.8}
        />
      ))}
    </>
  )
}

/** 단계별 건물 본체. 바닥(72)에 발을 붙인다. */
export function BuildingShape({ tier }: { tier: Tier }) {
  const g = BUILDING_GROUND
  switch (tier) {
    case 'basement':
      // 3층 빌라: 길바닥에 반쯤 묻힌 창 하나(우리)에 불이 켜져 있다.
      return (
        <>
          <Box x={38} y={g - 42} w={52} h={46} fill="#f3e3c8" />
          <Box x={36} y={g - 45} w={56} h={5} fill="#e8a87c" r={1.5} />
          <Windows wins={grid(45, g - 37, 3, 2, 9, 7, 5, 6, 'none')} />
          <Door x={60} y={g - 12} h={12} />
          {/* 반지하 창: 길바닥에 반쯤 묻힘, 쇠창살 */}
          <rect
            x={43}
            y={g - 5}
            width={11}
            height={7}
            rx={1}
            fill={LIT}
            stroke={INK}
            strokeWidth={0.9}
          />
          <line x1={46.5} y1={g - 5} x2={46.5} y2={g + 2} stroke={INK} strokeWidth={0.7} />
          <line x1={50.5} y1={g - 5} x2={50.5} y2={g + 2} stroke={INK} strokeWidth={0.7} />
          <Sign x={44} y={g - 11} w={9} col="#ffd16b" />
          <Tree x={20} />
          <Tree x={108} />
        </>
      )
    case 'shop':
      // 상가 2층: 1층 가게들, 2층 한 칸이 우리.
      return (
        <>
          <Box x={30} y={g - 36} w={68} h={40} fill="#f6efe2" />
          <Box x={28} y={g - 38} w={72} h={4} fill="#9ab8d3" r={1.5} />
          <Windows wins={grid(36, g - 30, 4, 1, 11, 9, 4, 0, 'none')} />
          <rect
            x={36}
            y={g - 30}
            width={11}
            height={9}
            rx={1}
            fill={LIT}
            stroke={INK}
            strokeWidth={0.9}
          />
          <Sign x={34} y={g - 36} w={16} />
          <Sign x={66} y={g - 36} w={14} col="#9ed08f" />
          <Box x={34} y={g - 17} w={24} h={16} fill="#dbe9f3" r={1.5} />
          <Box x={64} y={g - 17} w={24} h={16} fill="#ffe4ec" r={1.5} />
          <Door x={92} y={g - 12} h={12} />
          <Tree x={14} />
          <Tree x={114} />
        </>
      )
    case 'small':
      // 작은 빌딩 5층: 한 층(3층)이 통째로 우리.
      return (
        <>
          <FarCity
            tops={[
              [8, 14, g - 30],
              [104, 18, g - 26],
            ]}
          />
          <Box x={40} y={g - 56} w={48} h={60} fill="#e9eef4" />
          <Box x={38} y={g - 58} w={52} h={4} fill="#7d93ad" r={1.5} />
          <Windows wins={grid(46, g - 52, 3, 5, 10, 7, 3, 3, [2])} />
          <Sign x={44} y={g - 32} w={6} col="#ffd16b" />
          <Door x={60} y={g - 11} w={8} h={11} />
          <Tree x={24} />
        </>
      )
    case 'yeouido':
      // 여의도 빌딩: 유리 타워 몇 층이 우리.
      return (
        <>
          <FarCity
            tops={[
              [6, 16, g - 36],
              [100, 22, g - 44],
              [22, 12, g - 28],
            ]}
          />
          <Box x={44} y={g - 66} w={40} h={70} fill="#dfeaf3" />
          <Box x={42} y={g - 68} w={44} h={4} fill="#5f7c9e" r={1.5} />
          <Windows wins={grid(48, g - 62, 3, 8, 10, 5, 3, 2.3, [3, 4])} />
          <Door x={60} y={g - 10} w={8} h={10} />
          <Tree x={30} />
          <Tree x={100} />
        </>
      )
    case 'whole':
      // 빌딩 통째로: 모든 층에 불, 꼭대기 간판.
      return (
        <>
          <FarCity
            tops={[
              [6, 16, g - 36],
              [100, 22, g - 44],
              [22, 12, g - 28],
            ]}
          />
          <Box x={44} y={g - 66} w={40} h={70} fill="#dfeaf3" />
          <Box x={42} y={g - 68} w={44} h={4} fill="#5f7c9e" r={1.5} />
          <Sign x={52} y={g - 65} w={24} />
          <Windows wins={grid(48, g - 57, 3, 7, 10, 5, 3, 2.3, 'all')} />
          <Door x={60} y={g - 10} w={8} h={10} />
          <Tree x={30} />
          <Tree x={100} />
        </>
      )
    case 'hq':
      // 우리 이름이 붙은 사옥: 넓고 높은 타워, 큰 간판, 로비.
      return (
        <>
          <FarCity
            tops={[
              [4, 18, g - 40],
              [104, 20, g - 50],
              [24, 12, g - 34],
            ]}
          />
          <Box x={38} y={g - 70} w={52} h={74} fill="#eef1f6" />
          <Box x={36} y={g - 72} w={56} h={4} fill="#4b5878" r={1.5} />
          <Sign x={48} y={g - 66} w={32} col="#ff9fc0" />
          <Windows wins={grid(43, g - 58, 4, 7, 10, 4.6, 2.6, 2.4, 'all')} />
          <Box x={42} y={g - 12} w={44} h={12} fill="#cfe0ea" r={1.5} />
          <Door x={60} y={g - 10} w={8} h={10} />
          <Tree x={24} />
          <Tree x={106} />
        </>
      )
    case 'landmark':
      // 랜드마크 타워: 구름보다 높은 첨탑.
      return (
        <>
          <FarCity
            tops={[
              [2, 20, g - 44],
              [106, 20, g - 52],
              [24, 14, g - 36],
            ]}
          />
          <path
            d={`M50 ${g + 4} L50 ${g - 52} Q50 ${g - 60} 56 ${g - 63} L64 ${g - 66} L72 ${g - 63} Q78 ${g - 60} 78 ${g - 52} L78 ${g + 4} Z`}
            fill="#e4ecf7"
            stroke={INK}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
          <line x1={64} y1={g - 66} x2={64} y2={g - 69} stroke={INK} strokeWidth={1.2} />
          <circle cx={64} cy={g - 70} r={1.4} fill="#ffd16b" stroke={INK} strokeWidth={0.8} />
          <Windows wins={grid(54, g - 54, 2, 9, 8, 3.6, 4, 2, 'all')} />
          <Cloud x={34} y={g - 50} s={0.8} />
          <Cloud x={96} y={g - 58} s={0.7} />
          <Box x={46} y={g - 12} w={36} h={12} fill="#cfe0ea" r={1.5} />
          <Door x={60} y={g - 10} w={8} h={10} />
        </>
      )
  }
}

/** 하늘·길바닥·구름을 포함한 한 장면. tone='grey'면 잿빛(남의 건물). */
export function BuildingScene({
  tier,
  bare = false,
  tone = 'color',
}: {
  tier: Tier
  /** 하늘·길바닥 없이 건물만 */
  bare?: boolean
  tone?: 'color' | 'grey'
}) {
  const g = BUILDING_GROUND
  return (
    <g style={tone === 'grey' ? { filter: 'saturate(0) brightness(1.08)' } : undefined}>
      {!bare && (
        <>
          <rect x={0} y={0} width={BUILDING_W} height={g} fill={SKY} />
          <Cloud x={20} y={14} />
          <Cloud x={104} y={22} s={0.8} />
          <rect x={0} y={g} width={BUILDING_W} height={BUILDING_H - g} fill={GROUND} />
          <line x1={0} y1={g} x2={BUILDING_W} y2={g} stroke={INK} strokeWidth={1} />
        </>
      )}
      <BuildingShape tier={tier} />
    </g>
  )
}

function BuildingLadder({ tier }: { tier: Tier }) {
  const at = TIER_ORDER.indexOf(tier)
  return (
    <ol
      className="mt-2 flex flex-wrap items-center gap-x-0.5 gap-y-1 text-[11px]"
      aria-label="건물 사다리"
      data-testid="building-ladder"
    >
      {TIER_ORDER.map((t, i) => (
        <li
          key={t}
          className={`flex items-center gap-0.5 ${i > at + 1 ? 'opacity-40' : ''}`}
          aria-current={i === at ? 'step' : undefined}
        >
          {i > 0 && (
            <span className="text-muted" aria-hidden="true">
              ›
            </span>
          )}
          <span
            className={`rounded-sm px-1 leading-5 ${
              i === at
                ? 'bg-wine font-bold text-white'
                : i < at
                  ? 'bg-line-soft text-muted line-through'
                  : 'border border-line text-ink'
            }`}
          >
            {TIER_SHORT[t]}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** 회사 화면의 건물 (238번): 회사 등급 글자 대신 지금 쓰는 건물을 그림으로 보이고, 아래에 건물 사다리. */
export const BuildingArt = memo(function BuildingArt({
  grade,
  ladder = true,
}: {
  grade: Grade
  ladder?: boolean
}) {
  const tier = tierOf(grade)
  return (
    <div data-testid="building" data-tier={tier}>
      <svg
        viewBox={`0 0 ${BUILDING_W} ${BUILDING_H}`}
        className="mx-auto mt-2 block h-auto w-full max-w-[360px] overflow-hidden rounded-xl border-2 border-ink/70"
        role="img"
        aria-label={OFFICE_NAMES[tier]}
      >
        <BuildingScene tier={tier} />
      </svg>
      {ladder && <BuildingLadder tier={tier} />}
    </div>
  )
})
