import type { Grade } from '../../api/client'
import { withParticle } from '../game/labels'
import { usePixelArt } from '../game/pixelArt'
import { moveOf, rivalFor, wreathsFor } from './board'
import { officeName } from './office'
import { RivalSmash } from './RivalSmash'

/**
 * 이사 장면 (증권사 육성 설계 8.3절). 결산 뒤 회사 등급이 바뀌었을 때 한 번 보인다. 글은 등급 대신 건물로 말한다 (238번). 오르면 우리 건물이 라이벌 증권사
 * 건물을 박치기로 무너뜨리고 그 자리에서 커지는 장면(243번)과 단골 인물이 보낸 축하 화환,
 * 떨어지면 짐을 줄여 작은 사무실로 옮긴다. 그림을 끄면 글만 보인다 (190번).
 */
export function MoveScene({
  before,
  after,
  year,
  overtook = [],
  onDone,
}: {
  before: Grade
  after: Grade
  year: number
  /** 그해 앞지른 라이벌 (decisions.md 260번). 등급이 그대로여도 앞질렀으면 박치기 장면을 보인다. */
  overtook?: string[]
  onDone: () => void
}) {
  const shown = usePixelArt((s) => s.shown)
  const move = moveOf(before, after) ?? (overtook.length > 0 ? 'up' : null)
  if (!move) {
    return null
  }
  const up = move === 'up'
  const from = officeName(before)
  const to = officeName(after)
  // 회사 등급 대신 건물로 말한다 (238번): 건물이 바뀌면 이사, 같은 건물이면 사무실을 넓히거나 줄인다.
  // 실제로 앞지른 라이벌이 있으면 그 회사를 들이받는다 (260번).
  const rival = overtook[0] ?? rivalFor(year)
  // 오르면 라이벌 건물을 박치기로 무너뜨리고 그 자리에서 커진다 (243번).
  const line =
    before === after
      ? `라이벌 ${withParticle(rival, '을', '를')} 앞질렀다! 건물을 들이받아 무너뜨렸다.`
      : from !== to
        ? up
          ? `라이벌 ${rival} 건물을 들이받아 무너뜨리고 그 자리로 이사했다: ${from} → ${to}. 새 간판을 달고 개업 떡을 돌렸다.`
          : `짐을 줄여 작은 사무실로 옮겼다: ${from} → ${to}.`
        : up
          ? `라이벌 ${rival} 건물을 들이받아 무너뜨리고 사무실을 넓혔다(${to}). 새 책상이 들어오고 떡을 돌렸다.`
          : `사무실을 줄였다(${to}). 책상 몇 개를 내놓았다.`
  return (
    <section
      className="mt-4 animate-reveal rounded border border-gold p-4"
      data-testid="move-scene"
      data-move={move}
    >
      {shown && up && <RivalSmash before={before} after={after} rival={rival} />}
      {shown && !up && (
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
          <rect x={38} y={4} width={20} height={3} fill="#8d9199" />
          <rect x={45} y={10} width={6} height={7} fill="#8a7560" />
          {/* 이삿짐 트럭 */}
          <rect x={4} y={9} width={16} height={7} fill="#6b6f76" />
          <rect x={20} y={11} width={6} height={5} fill="#6b6f76" />
          <rect x={21} y={12} width={3} height={2} fill="#dbeaf5" />
          <rect x={6} y={16} width={3} height={2} fill="#1d2626" />
          <rect x={20} y={16} width={3} height={2} fill="#1d2626" />
          {/* 짐을 줄여 몇 개만 */}
          <rect x={9} y={6} width={3} height={3} fill="#c08a6a" />
        </svg>
      )}
      <p className="mt-2 text-[14px] font-semibold">{line}</p>
      {up && (
        <ul className="mt-1 text-[13px]" data-testid="wreaths">
          {wreathsFor(year).map((sender) => (
            <li key={sender}>축 발전 — {sender} 올림</li>
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
