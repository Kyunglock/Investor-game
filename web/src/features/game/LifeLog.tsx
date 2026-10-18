import type { Game } from '../../api/client'
import { Card } from './Card'
import { type LogLine, type LogTone, logLines } from './log'

const VISIBLE = 30

const TONE_CLASS: Record<LogTone, string> = {
  neutral: '',
  birth: 'bg-teal-soft',
  decision: '',
  flipped: 'bg-teal-soft',
  growth: 'text-teal',
  end: 'bg-wine-soft',
  offer: '',
}

/** 최근 순 인생 기록 (설계 5.5절). 30줄이 넘으면 나머지는 접는다. */
export function LifeLog({ game, title = '인생 기록' }: { game: Game; title?: string }) {
  const lines = logLines(game)
  const shown = lines.slice(0, VISIBLE)
  const rest = lines.slice(VISIBLE)

  return (
    <Card title={title} aside="최근 순" testId="life-log">
      <ul className="m-0 list-none p-0">
        {shown.map((line, i) => (
          <Line key={line.seq} line={line} kind={game.log[game.log.length - 1 - i]?.kind} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="mt-1 text-xs text-muted">
          <summary className="cursor-pointer py-1">더 보기 ({rest.length}줄)</summary>
          <ul className="m-0 list-none p-0">
            {rest.map((line, i) => (
              <Line
                key={line.seq}
                line={line}
                kind={game.log[game.log.length - 1 - VISIBLE - i]?.kind}
              />
            ))}
          </ul>
        </details>
      )}
    </Card>
  )
}

function Line({ line, kind }: { line: LogLine; kind?: string }) {
  const decision = line.tone === 'decision' || line.tone === 'flipped'
  return (
    <li
      className={`animate-slide-in grid grid-cols-[34px_1fr] gap-2 border-b border-line-soft px-1 py-2 text-[13px] last:border-b-0 ${TONE_CLASS[line.tone]}`}
      data-testid="life-log-line"
      data-kind={kind}
    >
      <span className="pt-0.5 font-mono-num text-[11px] text-faint">
        {decision && <span className="mr-0.5 text-wine">▸</span>}
        {line.age}세
      </span>
      <span>
        {line.pill && (
          <span className="mr-1 inline-block rounded-full border border-teal px-1.5 text-[10px] text-teal">
            {line.pill}
          </span>
        )}
        {line.text}
      </span>
    </li>
  )
}
