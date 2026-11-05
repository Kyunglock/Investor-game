import type { Grade } from '../../api/client'
import { usePixelArt } from '../game/pixelArt'
import { moveOf, wreathsFor } from './board'

/**
 * 이사 장면 (증권사 육성 설계 8.3절). 결산 뒤 회사 등급이 바뀌었을 때 한 번 보인다. 오르면 이삿짐 트럭·새 간판·개업 떡과 단골 인물이 보낸 축하 화환,
 * 떨어지면 짐을 줄여 작은 사무실로 옮긴다. 그림을 끄면 글만 보인다 (190번).
 */
export function MoveScene({
  before,
  after,
  year,
  onDone,
}: {
  before: Grade
  after: Grade
  year: number
  onDone: () => void
}) {
  const shown = usePixelArt((s) => s.shown)
  const move = moveOf(before, after)
  if (!move) {
    return null
  }
  const up = move === 'up'
  return (
    <section
      className="mt-4 animate-reveal rounded border border-gold p-4"
      data-testid="move-scene"
      data-move={move}
    >
      {shown && (
        <svg
          viewBox="0 0 64 20"
          className="block h-auto w-full"
          style={{ imageRendering: 'pixelated', shapeRendering: 'crispEdges' }}
          aria-hidden="true"
        >
          <rect x={0} y={0} width={64} height={17} fill="#cfe6e1" />
          <rect x={0} y={17} width={64} height={3} fill="#c9d3d8" />
          {/* 건물과 간판 */}
          <rect x={36} y={3} width={24} height={14} fill="#efe7dc" />
          <rect x={38} y={4} width={20} height={3} fill={up ? '#b2862b' : '#8d9199'} />
          <rect x={45} y={10} width={6} height={7} fill="#8a7560" />
          {/* 이삿짐 트럭 */}
          <rect x={4} y={9} width={16} height={7} fill={up ? '#2e7465' : '#6b6f76'} />
          <rect x={20} y={11} width={6} height={5} fill={up ? '#2e7465' : '#6b6f76'} />
          <rect x={21} y={12} width={3} height={2} fill="#dbeaf5" />
          <rect x={6} y={16} width={3} height={2} fill="#1d2626" />
          <rect x={20} y={16} width={3} height={2} fill="#1d2626" />
          {/* 짐: 오르면 가득, 떨어지면 몇 개 */}
          {(up ? [7, 11, 15] : [9]).map((x) => (
            <rect key={x} x={x} y={6} width={3} height={3} fill="#c08a6a" />
          ))}
          {/* 축하 화환 */}
          {up &&
            [29, 33].map((x) => (
              <g key={x}>
                <rect x={x - 1} y={8} width={4} height={4} fill="#8b2342" />
                <rect x={x} y={9} width={2} height={2} fill="#f0d58a" />
                <rect x={x} y={12} width={2} height={5} fill="#6f5a46" />
              </g>
            ))}
          {/* 개업 떡 */}
          {up && <rect x={40} y={15} width={4} height={2} fill="#f4f1ea" />}
        </svg>
      )}
      <p className="mt-2 text-[14px] font-semibold">
        {up
          ? `회사 등급이 올랐다 (${before} → ${after}). 이삿짐 트럭이 왔다. 새 간판을 달고 개업 떡을 돌렸다.`
          : `회사 등급이 떨어졌다 (${before} → ${after}). 짐을 줄여 작은 사무실로 옮겼다.`}
      </p>
      {up && (
        <ul className="mt-1 text-[13px]" data-testid="wreaths">
          {wreathsFor(year).map((sender) => (
            <li key={sender}>축 승급 — {sender} 올림</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onDone}
        className="mt-3 min-h-10 w-full rounded border border-pen text-[14px] font-semibold"
      >
        짐 정리 끝
      </button>
    </section>
  )
}
