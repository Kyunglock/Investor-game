import { useId } from 'react'
import { ARENA_FRAME, arenaMap } from '../mental/arenaMaps'
import { STAGE_ASSETS } from '../mental/assets'
import armedBoss from '../mental/assets/hero-upward.png'

// 전투 아틀라스에서 해당 자세의 투명 여백을 제외한 영역.
const frames = {
  boss: [STAGE_ASSETS.heroPoses, 1254, 1254, '93 23 259 368'],
  sky: [STAGE_ASSETS.skyPoses, 1254, 1254, '879 847 307 396'],
  snow: [STAGE_ASSETS.snowPoses, 1254, 1254, '92 13 263 381'],
  armed: [armedBoss, 1199, 1312, '243 165 657 972'],
  block: [STAGE_ASSETS.wallBlocks, 1254, 1254, '75 712 479 473'],
  gun: [STAGE_ASSETS.weapons, 1536, 1024, '424 393 303 220'],
} as const

const columns = [0, 1, 2, 3, 4, 5]
const rows = [0, 1, 2]

export function PrologueStage({ page, description }: { page: number; description: string }) {
  const id = useId()
  const art = (name: keyof typeof frames, x: number, y: number, w: number, h: number) => (
    <use href={`#${id}-${name}`} x={x} y={y} width={w} height={h} />
  )
  return (
    <div className="prologue-field">
      <svg
        aria-hidden="true"
        className="prologue-map"
        viewBox={`${arenaMap(1).x} ${ARENA_FRAME.y} ${ARENA_FRAME.width} ${ARENA_FRAME.height}`}
        preserveAspectRatio="xMidYMid slice"
        overflow="hidden"
      >
        <image href={STAGE_ASSETS.arenaMaps} width="1881" height="836" />
      </svg>
      <svg className="prologue-stage" viewBox="0 0 360 550" role="img" aria-label={description}>
        <defs>
          {Object.entries(frames).map(([name, [url, width, height, box]]) => (
            <symbol key={name} id={`${id}-${name}`} viewBox={box} overflow="hidden">
              <image href={url} width={width} height={height} />
            </symbol>
          ))}
        </defs>
        <g key={page}>
          {rows.map((row) => (
            <g
              key={row}
              className={page === 0 ? 'prologue-wall-arrive' : undefined}
              style={{ animationDelay: `${(2 - row) * 280}ms` }}
            >
              {columns.map((col) => (
                <g
                  key={col}
                  className={
                    page === 2 && col > 0 && col < 5
                      ? col < 3
                        ? 'prologue-block-left'
                        : 'prologue-block-right'
                      : undefined
                  }
                >
                  {art('block', col * 58 + 7, 90 + row * 48, 57, 55)}
                </g>
              ))}
            </g>
          ))}
          <g className={page === 2 ? 'prologue-team-run' : undefined}>
            {art('sky', 48, 319, 76, 98)}
            {art('snow', 243, 316, 76, 101)}
            {art(page === 2 ? 'armed' : 'boss', 124, 345, 112, 148)}
          </g>
          {page === 1 && <g className="prologue-drop">{art('gun', 143, 258, 85, 62)}</g>}
          {page === 2 && (
            <circle
              className="prologue-shot"
              cx="214"
              cy="354"
              r="7"
              fill="#fff1a4"
              stroke="#ff9e28"
              strokeWidth="3"
            />
          )}
        </g>
      </svg>
    </div>
  )
}
