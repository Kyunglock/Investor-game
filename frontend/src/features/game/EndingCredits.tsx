import { useMemo } from 'react'
import type { Game } from '../../api/client'
import { buildCredits, type CreditSection, type CreditTone } from './credits'
import { layersFor, type SpriteSpec } from './pixel/layers'
import { Vignette } from './pixel/Vignette'

const TONE_CLASS: Record<CreditTone, string> = {
  up: 'text-[#f0a090]',
  down: 'text-[#8fb4e8]',
  muted: 'text-white/55',
  accent: 'text-[#e8c777]',
}

/**
 * 엔딩 크레딧 (엔딩 설계 3절, decisions.md 129번). 어두운 화면에 인생의 장(章)들이 위에서 아래로 놓이고, 플레이어가 제 손으로 스크롤해 읽는다.
 * 저절로 올라가지 않는다. 맨 끝에 기록부로 가는 버튼이 있고, 건너뛰기는 언제든 가능하다.
 */
export function EndingCredits({ game, onDone }: { game: Game; onDone: () => void }) {
  const sections = useMemo(() => buildCredits(game), [game])
  // 그림 속 '나'는 진행 화면과 같은 장식(타고난 강점)·약점 표시를 단다.
  const me = useMemo(() => {
    const { sex, adornment, mark } = layersFor(game.initialStats, game.stats, game.endAge, game.sex)
    return { sex, adornment, mark }
  }, [game])

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#141a1a] text-white"
      data-testid="ending-credits"
      data-rolled="true"
    >
      <button
        type="button"
        className="absolute top-4 right-4 z-10 rounded border border-white/30 bg-[#141a1a]/80 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
        onClick={onDone}
        data-testid="credits-skip"
      >
        건너뛰기 →
      </button>
      <div className="h-full overflow-y-auto px-6 py-16" data-testid="credits-scroll">
        <Roll sections={sections} me={me} />
        <div className="flex justify-center pb-16">
          <DoneButton onDone={onDone} />
        </div>
      </div>
    </div>
  )
}

function Roll({ sections, me }: { sections: CreditSection[]; me: Omit<SpriteSpec, 'stage'> }) {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center gap-14 text-center">
      {sections.map((section, i) => (
        <section key={section.key} data-testid={`credits-${section.key}`}>
          {section.art && <Vignette art={section.art} me={me} />}
          <h2
            className={
              i === 0
                ? 'font-serif-kr text-3xl font-black sm:text-4xl'
                : 'mb-4 text-[11px] font-bold tracking-[0.3em] text-white/45 uppercase'
            }
          >
            {section.title}
          </h2>
          <ul className={`flex flex-col ${i === 0 ? 'mt-4 gap-1.5' : 'gap-3'}`}>
            {section.lines.map((line) => (
              <li
                key={`${section.key}-${line.text}`}
                className={line.tone ? TONE_CLASS[line.tone] : ''}
              >
                <p className={i === 0 ? 'text-base' : 'font-serif-kr text-lg leading-snug'}>
                  {line.text}
                </p>
                {line.sub && <p className="mt-0.5 text-sm text-white/60">{line.sub}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="h-[10vh]" />
    </div>
  )
}

function DoneButton({ onDone }: { onDone: () => void }) {
  return (
    <button
      type="button"
      className="min-h-12 w-full max-w-[320px] rounded bg-wine font-semibold text-white hover:opacity-90"
      onClick={onDone}
      data-testid="credits-done"
    >
      인생 기록부 보기
    </button>
  )
}
