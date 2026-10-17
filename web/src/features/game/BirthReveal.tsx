import { useEffect, useState } from 'react'
import type { Game } from '../../api/client'
import { STAT_KEYS, STAT_LABELS, won } from './labels'
import { nickname } from './nickname'

/** 능력치 하나가 공개되는 간격과, 숫자가 0에서 올라가는 시간. */
const STEP_MS = 700
const COUNT_UP_MS = 500
const COUNT_UP_TICK_MS = 30

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/** 태어날 때 능력치를 안목 → 인내심 → 용기 → 줏대 → 운 순서로 하나씩 공개하고, 별명을 붙여 준다. */
export function BirthReveal({ game, onStart }: { game: Game; onStart: () => void }) {
  const [instant] = useState(reducedMotion)
  const [revealed, setRevealed] = useState(instant ? STAT_KEYS.length : 0)
  const done = revealed >= STAT_KEYS.length
  const nick = nickname(game.initialStats)

  // 다 공개되면 done이 바뀌면서 정리 함수가 타이머를 멈춘다.
  useEffect(() => {
    if (done) {
      return
    }
    const id = setInterval(() => setRevealed((n) => Math.min(n + 1, STAT_KEYS.length)), STEP_MS)
    return () => clearInterval(id)
  }, [done])

  return (
    <section
      className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-md"
      data-testid="birth-reveal"
    >
      <h2 className="text-center text-2xl font-bold">
        {done ? '당신이 태어났습니다' : '타고난 성격을 정하는 중…'}
      </h2>

      <ul className="mt-6 flex flex-col gap-3">
        {STAT_KEYS.map((key, index) => (
          <li key={key} className="flex items-center gap-3" data-testid={`reveal-${key}`}>
            <span className="w-14 text-slate-600">{STAT_LABELS[key]}</span>
            {index < revealed ? (
              <CountUpBar value={game.initialStats[key]} instant={instant} />
            ) : (
              <span className="flex-1 text-slate-300">?</span>
            )}
          </li>
        ))}
      </ul>

      {done && (
        <div className="animate-reveal mt-8 text-center">
          <p className="text-slate-500">부모님이 만들어 준 통장 {won(game.initialAsset)}</p>
          <p className="mt-4 text-sm text-slate-500">당신의 별명은</p>
          <p className="mt-1 text-3xl font-bold text-blue-600" data-testid="reveal-nickname">
            {nick.name}
          </p>
          <p className="mt-3 text-sm text-rose-700">약점: {nick.weaknessEffect}</p>
          <button
            type="button"
            className="mt-8 min-h-12 w-full rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700"
            onClick={onStart}
          >
            인생 시작하기
          </button>
        </div>
      )}
    </section>
  )
}

function CountUpBar({ value, instant }: { value: number; instant: boolean }) {
  const [shown, setShown] = useState(instant ? value : 0)

  useEffect(() => {
    if (instant) {
      return
    }
    const startedAt = Date.now()
    const id = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / COUNT_UP_MS)
      setShown(Math.round(value * progress))
      if (progress >= 1) {
        clearInterval(id)
      }
    }, COUNT_UP_TICK_MS)
    return () => clearInterval(id)
  }, [value, instant])

  return (
    <>
      <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full bg-blue-500" style={{ width: `${shown}%` }} />
      </span>
      <span className="animate-reveal w-10 text-right text-lg font-bold">{shown}</span>
    </>
  )
}
