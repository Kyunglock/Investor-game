import type { Grade } from '../../api/client'
import { INK } from '../game/cat/draw'
import { Overlay } from '../game/Overlay'
import { BuildingArt } from './BuildingArt'
import { moveOf, wreathsFor } from './board'
import { newlyOpened } from './LockedDesks'
import { officeName } from './office'
import { RivalSmash } from './RivalSmash'
import { useRaisingStore } from './store'

/**
 * 이사 장면 (증권사 육성 설계 8.3절). 결산 뒤 회사 등급이 바뀌었을 때 한 번 보인다. 글은 등급 대신 건물로 말한다 (238번). 오르면 우리 건물이 옆 건물을
 * 박치기로 무너뜨리고 그 자리에서 커지는 장면(243번)과 단골 인물이 보낸 축하 화환,
 * 떨어지면 짐을 줄여 작은 사무실로 옮긴다. 그림은 벡터 건물(343번)이다.
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
  const company = useRaisingStore((s) => s.company)
  const move = moveOf(before, after)
  // 커지면서 새로 열린 자리 (#393): 무엇을 하는 자리인지 한 줄씩 알려 준다.
  const opened = move === 'up' ? newlyOpened(company, before, after) : []
  if (!move) {
    return null
  }
  const up = move === 'up'
  const from = officeName(before)
  const to = officeName(after)
  // 회사 등급 대신 건물로 말한다 (238번): 건물이 바뀌면 이사, 같은 건물이면 사무실을 넓히거나 줄인다.
  // 오르면 옆 건물을 박치기로 무너뜨리고 그 자리에서 커진다 (243번). 라이벌 회사를 걷어낸 뒤(288번)로는 이름 없는 옆 건물이다.
  const rival = '옆 건물'
  // 새 건물은 몇 해에 걸쳐 지어 완공 때 옮긴다 (#347): 박치기 대신 가림막이 걷히며 새 건물이 아래에서 솟아오른다.
  const built = up && from !== to
  const line =
    from !== to
      ? up
        ? `공사가 끝났다! 가림막을 걷자 새 건물이 모습을 드러냈다: ${from} → ${to}. 새 간판을 달고 개업 떡을 돌렸다.`
        : `짐을 줄여 작은 사무실로 옮겼다: ${from} → ${to}.`
      : up
        ? `옆 건물을 들이받아 무너뜨리고 사무실을 넓혔다(${to}). 새 책상이 들어오고 떡을 돌렸다.`
        : `사무실을 줄였다(${to}). 책상 몇 개를 내놓았다.`
  return (
    <Overlay>
      <section
        className="animate-pop rounded border-2 border-gold bg-card p-4 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-label={up ? '건물이 커졌다' : '건물이 줄었다'}
        data-testid="move-scene"
        data-move={move}
      >
        {built && (
          <div className="relative overflow-hidden" data-testid="build-complete">
            <div className="build-complete">
              <BuildingArt grade={after} />
            </div>
            <div className="curtain-off absolute inset-x-[20%] bottom-[10%] top-[35%] rounded-sm bg-[#2f5d50]/90" />
          </div>
        )}
        {up && !built && <RivalSmash before={before} after={after} rival={rival} />}
        {!up && (
          <svg viewBox="0 0 128 40" className="block h-auto w-full rounded-xl" aria-hidden="true">
            <rect x={0} y={0} width={128} height={34} fill="#dff1f7" />
            <rect x={0} y={34} width={128} height={6} fill="#d9cfbf" />
            <line x1={0} y1={34} x2={128} y2={34} stroke={INK} strokeWidth={0.8} />
            {/* 작은 건물과 간판 */}
            <rect
              x={76}
              y={8}
              width={44}
              height={26}
              rx={2.5}
              fill="#f6efe2"
              stroke={INK}
              strokeWidth={1.2}
            />
            <rect
              x={80}
              y={11}
              width={36}
              height={5}
              rx={1.5}
              fill="#9ab8d3"
              stroke={INK}
              strokeWidth={0.9}
            />
            <rect
              x={92}
              y={22}
              width={9}
              height={12}
              rx={1.5}
              fill="#a98464"
              stroke={INK}
              strokeWidth={0.9}
            />
            {/* 이삿짐 트럭 */}
            <rect
              x={8}
              y={14}
              width={34}
              height={16}
              rx={2.5}
              fill="#8fcf86"
              stroke={INK}
              strokeWidth={1.2}
            />
            <rect
              x={42}
              y={19}
              width={14}
              height={11}
              rx={2}
              fill="#ffd16b"
              stroke={INK}
              strokeWidth={1.2}
            />
            <rect
              x={45}
              y={21}
              width={7}
              height={4.5}
              rx={1}
              fill="#dbeaf3"
              stroke={INK}
              strokeWidth={0.8}
            />
            <circle cx={16} cy={31} r={3.4} fill="#4a3528" />
            <circle cx={16} cy={31} r={1.3} fill="#d9cfbf" />
            <circle cx={48} cy={31} r={3.4} fill="#4a3528" />
            <circle cx={48} cy={31} r={1.3} fill="#d9cfbf" />
            {/* 짐을 줄여 상자 하나 */}
            <rect
              x={20}
              y={6}
              width={9}
              height={8}
              rx={1.2}
              fill="#e8b48a"
              stroke={INK}
              strokeWidth={0.9}
            />
          </svg>
        )}
        <p className="mt-2 text-[14px] font-semibold">{line}</p>
        {opened.length > 0 && (
          <div
            className="mt-2 rounded border border-gold bg-gold/10 px-2 py-1.5"
            data-testid="unlocked"
          >
            <p className="text-[13px] font-semibold text-gold">새로 열렸다!</p>
            <ul className="mt-0.5 grid gap-0.5 text-[12px]">
              {opened.map((d) => (
                <li key={d.code}>
                  <b>{d.name}</b> · {d.description}
                </li>
              ))}
            </ul>
          </div>
        )}
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
          확인 · 짐 정리 끝
        </button>
      </section>
    </Overlay>
  )
}
