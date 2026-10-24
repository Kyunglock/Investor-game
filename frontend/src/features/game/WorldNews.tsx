import { worldText } from './notices'
import { useGameStore } from './store'

/**
 * 세상 소식 배너: 전조·평범한 기사·헛소문·위기 회고. 놓치지 않게 화면 아래 가운데에 크게(위는 멈춤 버튼을 가린다), 닫거나 다음 소식이 올 때까지 남는다. 시간은 멈추지 않는다 (#24).
 * 전조와 기사는 꼬리표 없이 똑같이 보여 배너로 전조를 가려낼 수 없다 (decisions.md 38번).
 */
export function WorldNews() {
  const news = useGameStore((s) => s.worldNews)
  const dismiss = useGameStore((s) => s.dismissWorldNews)

  if (news.length === 0) {
    return null
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <section
        key={news[0].seq}
        aria-live="polite"
        aria-label="세상 소식"
        className="animate-reveal pointer-events-auto w-full max-w-[560px] rounded-md border-2 border-pen bg-paper px-4 py-3 text-pen shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        data-testid="world-news"
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-pen text-[24px] font-normal leading-none">📰 세상 소식</h2>
          <button
            type="button"
            aria-label="세상 소식 닫기"
            className="min-h-11 min-w-11 rounded-full text-lg text-pen-soft hover:bg-white"
            onClick={dismiss}
          >
            ✕
          </button>
        </div>
        <ul className="m-0 list-none space-y-1 p-0">
          {news.map((entry) => (
            <li key={entry.seq} className="font-note text-[15px] leading-6">
              {worldText(entry)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
