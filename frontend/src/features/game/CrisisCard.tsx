import type { Game, LogEntry } from '../../api/client'
import { logLine } from './log'
import { Overlay } from './Overlay'

/**
 * 지나간 폭락의 회고: "돌아보니 그때는 … 불황이었다"를 시간을 멈추는 alert 카드로. 토스트로 지나가면 놓쳐서다 (decisions.md 60번). 위기는 끝난 뒤에야
 * 이름이 붙는다 (38번).
 */
export function CrisisCard({
  entry,
  game,
  onDone,
}: {
  entry: LogEntry
  game: Game
  onDone: () => void
}) {
  const p = entry.payload as Record<string, unknown>
  const line = logLine(entry, game)
  return (
    <Overlay>
      <section
        className="rounded-md border border-line bg-card px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
        data-testid="crisis-card"
        aria-live="assertive"
      >
        <p className="text-[11px] font-bold text-wine">지나고 나서야 이름이 붙은 위기</p>
        <h2 className="mt-1 font-serif-kr text-xl font-black">
          {String(p.name ?? '')} · {p.severity === 'DEPRESSION' ? '대공황' : '불황'}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-wine">{line.text}</p>
        <button
          type="button"
          className="mt-4 min-h-12 w-full rounded bg-wine text-sm font-bold text-white hover:opacity-90"
          onClick={onDone}
          data-testid="crisis-done"
        >
          확인
        </button>
      </section>
    </Overlay>
  )
}
