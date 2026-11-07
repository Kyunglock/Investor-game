import { type CSSProperties, useState } from 'react'
import type { Grade } from '../../api/client'
import { INK } from '../game/cat/draw'
import { BUILDING_GROUND, BUILDING_W, BuildingScene } from './BuildingArt'
import { tierOf } from './office'

/** 장면 크기. 건물 그림 하나가 64×40을 차지하고(그림 128×80을 반으로 줄인다), 길바닥은 40행부터다. */
const SCENE_W = 128
const SCENE_H = 48
const GROUND_Y = 40
const SPRITE_SCALE = 64 / BUILDING_W
/** 건물 그림의 길바닥 행을 장면 길바닥에 맞춘다. */
const SPRITE_Y = GROUND_Y - BUILDING_GROUND * SPRITE_SCALE
/** 우리 건물이 서 있다가 마지막에 서는 자리, 옆 건물의 자리 */
const OURS_X = -8
const GROWN_X = 32
const RIVAL_X = 64
/** 옆 건물이 부서지는 조각: 그림 안의 열 구간과 날아가는 쪽·기울기 */
const PIECES: { x: number; w: number; dx: number; rot: number }[] = [
  { x: 0, w: 22, dx: -6, rot: -28 },
  { x: 22, w: 8, dx: -2, rot: -12 },
  { x: 30, w: 8, dx: 3, rot: 18 },
  { x: 38, w: 8, dx: 7, rot: 34 },
  { x: 46, w: 18, dx: 12, rot: 50 },
]

function Sprite({ grade, grey = false }: { grade: Grade; grey?: boolean }) {
  return (
    <g transform={`scale(${SPRITE_SCALE})`}>
      <BuildingScene tier={tierOf(grade)} bare tone={grey ? 'grey' : 'color'} />
    </g>
  )
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 회사가 한 단계 오를 때의 장면 (decisions.md 243·343번). 우리 건물이 몸을 젖혔다가 옆 건물을 박치기하고("쾅!"), 옆 건물은 조각나
 * 무너지고, 우리 건물은 그 자리로 가서 새 등급의 건물로 커진다. 옆 건물은 새 등급의 건물을 잿빛으로 칠한 것이다(그 자리를 빼앗는다). 3.6초, 다시 볼 수
 * 있다. 움직임을 줄이는 설정이면 끝난 모습만. 그림은 벡터 건물(BuildingArt)이다.
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
  /** 무너지는 옆 건물의 등급. 없으면 오른 뒤 우리 건물(그 자리를 빼앗는다). */
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
        className={`block h-auto w-full rounded-xl ${anim('smash-shake') ?? ''}`}
        role="img"
        aria-label={`우리 건물이 ${rival}을 박치기해 무너뜨리고 더 큰 건물로 커졌다`}
      >
        <defs>
          {PIECES.map((p) => (
            <clipPath key={p.x} id={`smash-piece-${run}-${p.x}`}>
              <rect x={p.x} y={-10} width={p.w} height={50} />
            </clipPath>
          ))}
        </defs>
        <rect x={0} y={0} width={SCENE_W} height={GROUND_Y} fill="#dff1f7" />
        <rect x={0} y={GROUND_Y} width={SCENE_W} height={SCENE_H - GROUND_Y} fill="#d9cfbf" />
        <line x1={0} y1={GROUND_Y} x2={SCENE_W} y2={GROUND_Y} stroke={INK} strokeWidth={0.6} />

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
                <Sprite grade={rivalGrade ?? after} grey />
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
                fill="#efe9dd"
                stroke={INK}
                strokeWidth={0.5}
                className="smash-dust"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
            <g className="smash-bang">
              <polygon
                points="74,8 80,14 88,6 88,16 98,16 90,22 98,30 86,26 82,34 78,26 68,28 74,20"
                fill="#ffd16b"
                stroke={INK}
                strokeWidth={1}
                strokeLinejoin="round"
              />
              <text x={83} y={23} textAnchor="middle" fontSize={8} fontWeight={900} fill={INK}>
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
                <rect x={x} y={y} width={1} height={5} rx={0.5} fill="#ffd16b" />
                <rect x={x - 2} y={y + 2} width={5} height={1} rx={0.5} fill="#ffd16b" />
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
          {rival}
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
