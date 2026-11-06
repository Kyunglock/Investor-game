import { type CSSProperties, useState } from 'react'
import type { Grade } from '../../api/client'
import { PALETTE } from '../game/pixel/palette'
import { toRuns } from '../game/pixel/sprite'
import { buildingMap } from './BuildingArt'

/** 장면 크기(칸). 건물 그림 하나가 64×40이고, 길바닥은 40행부터다. */
const SCENE_W = 128
const SCENE_H = 48
const GROUND_Y = 40
/** 건물 그림의 길바닥 행(36)을 장면 길바닥에 맞춘다. */
const SPRITE_Y = GROUND_Y - 36
/** 우리 건물이 서 있다가 마지막에 서는 자리, 라이벌 건물의 자리 */
const OURS_X = -8
const GROWN_X = 32
const RIVAL_X = 64
/** 라이벌 건물이 부서지는 조각: 그림 안의 열 구간과 날아가는 쪽·기울기 */
const PIECES: { x: number; w: number; dx: number; rot: number }[] = [
  { x: 0, w: 22, dx: -6, rot: -28 },
  { x: 22, w: 8, dx: -2, rot: -12 },
  { x: 30, w: 8, dx: 3, rot: 18 },
  { x: 38, w: 8, dx: 7, rot: 34 },
  { x: 46, w: 18, dx: 12, rot: 50 },
]

/** 라이벌 건물은 우리 건물과 같은 그림을 잿빛으로 칠한다. */
const RIVAL_PALETTE: Record<string, string> = Object.fromEntries(
  Object.entries(PALETTE).map(([code, hex]) => {
    const n = Number.parseInt(hex.slice(1), 16)
    const l = 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)
    const c = (k: number) =>
      Math.round(Math.min(255, l * k))
        .toString(16)
        .padStart(2, '0')
    return [code, `#${c(0.78)}${c(0.8)}${c(0.92)}`]
  }),
)

function Sprite({ grade, palette = PALETTE }: { grade: Grade; palette?: Record<string, string> }) {
  return (
    <>
      {toRuns(buildingMap(grade, true), palette).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
    </>
  )
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 회사가 한 단계 오를 때의 장면 (decisions.md 243번). 우리 건물이 몸을 젖혔다가 옆의 라이벌 증권사 건물을 박치기하고("쾅!"), 라이벌 건물은 조각나
 * 무너지고, 우리 건물은 그 자리로 가서 새 등급의 건물로 커진다. 라이벌 건물은 새 등급의 건물을 잿빛으로 칠한 것이다(그 자리를 빼앗는다). 3.6초, 다시 볼 수
 * 있다. 움직임을 줄이는 설정이면 끝난 모습만.
 */
export function RivalSmash({
  before,
  after,
  rival,
  rivalGrade,
}: {
  before: Grade
  after: Grade
  rival: string
  /** 무너지는 라이벌 건물의 등급. 없으면 오른 뒤 우리 건물(그 자리를 빼앗는다). 올해의 라이벌은 그 회사의 건물이다 (275번). */
  rivalGrade?: Grade
}) {
  const [run, setRun] = useState(0)
  const still = reducedMotion()
  const anim = (name: string) => (still ? undefined : name)
  return (
    <div className="relative" data-testid="rival-smash">
      <svg
        key={run}
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        className={`block h-auto w-full rounded ${anim('smash-shake') ?? ''}`}
        style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
        role="img"
        aria-label={`우리 건물이 라이벌 ${rival} 건물을 박치기해 무너뜨리고 더 큰 건물로 커졌다`}
      >
        <defs>
          {PIECES.map((p) => (
            <clipPath key={p.x} id={`smash-piece-${run}-${p.x}`}>
              <rect x={p.x} y={0} width={p.w} height={40} />
            </clipPath>
          ))}
        </defs>
        <rect x={0} y={0} width={SCENE_W} height={GROUND_Y} fill="#cfe6e1" />
        <rect x={0} y={GROUND_Y} width={SCENE_W} height={SCENE_H - GROUND_Y} fill="#c9d3d8" />
        <rect x={0} y={GROUND_Y} width={SCENE_W} height={1} fill="#b9a995" />

        {!still && (
          <g transform={`translate(${RIVAL_X} ${SPRITE_Y})`}>
            {PIECES.map((p, i) => (
              <g
                key={p.x}
                clipPath={`url(#smash-piece-${run}-${p.x})`}
                className="smash-piece"
                style={
                  {
                    '--dx': `${p.dx}px`,
                    '--rot': `${p.rot}deg`,
                    animationDelay: `${i * 40}ms`,
                  } as CSSProperties
                }
                data-testid="rival-piece"
              >
                <Sprite grade={rivalGrade ?? after} palette={RIVAL_PALETTE} />
              </g>
            ))}
          </g>
        )}

        {!still && (
          <g transform={`translate(${OURS_X} ${SPRITE_Y})`}>
            <g className="smash-ours">
              <Sprite grade={before} />
            </g>
          </g>
        )}

        <g transform={`translate(${GROWN_X} ${SPRITE_Y})`}>
          <g className={anim('smash-grow')}>
            <Sprite grade={after} />
          </g>
        </g>

        {!still && (
          <>
            {[70, 82, 96, 108].map((x, i) => (
              <circle
                key={x}
                cx={x}
                cy={GROUND_Y - 2}
                r={4 + (i % 2) * 2}
                fill="#e9e4da"
                className="smash-dust"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
            <g className="smash-bang">
              <polygon
                points="74,8 80,14 88,6 88,16 98,16 90,22 98,30 86,26 82,34 78,26 68,28 74,20"
                fill="#e3b53a"
                stroke="#8b2342"
                strokeWidth={1}
              />
              <text
                x={83}
                y={23}
                textAnchor="middle"
                fontSize={8}
                fontWeight={900}
                fill="#8b2342"
                style={{ shapeRendering: 'auto' }}
              >
                쾅!
              </text>
            </g>
            {[
              [40, 10],
              [88, 6],
              [96, 26],
              [34, 28],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`} className="smash-spark">
                <rect x={x} y={y} width={1} height={5} fill="#e3b53a" />
                <rect x={x - 2} y={y + 2} width={5} height={1} fill="#e3b53a" />
              </g>
            ))}
          </>
        )}
      </svg>
      {!still && (
        <span
          className="smash-label pointer-events-none absolute top-1 right-1 rounded bg-ink/80 px-1.5 text-[11px] text-white"
          data-testid="rival-name"
        >
          라이벌 {rival}
        </span>
      )}
      {!still && (
        <button
          type="button"
          onClick={() => setRun(run + 1)}
          className="absolute bottom-1 left-1 rounded bg-white/80 px-1.5 text-[11px] text-muted underline"
        >
          다시 보기
        </button>
      )}
    </div>
  )
}
