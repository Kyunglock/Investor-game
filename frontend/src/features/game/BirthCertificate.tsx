import { useEffect, useState } from 'react'
import type { Game } from '../../api/client'
import { Document } from './Document'
import { GradeBadge } from './GradeBadge'
import { SEX_LABELS, STAT_KEYS, STAT_LABELS, won, yearOf } from './labels'
import { nickname } from './nickname'
import { layersFor } from './pixel/layers'
import { Sprite } from './pixel/SpriteView'

/** 능력치 하나가 공개되는 간격과, 숫자가 0에서 올라가는 시간. */
const STEP_MS = 700
const COUNT_UP_MS = 500
const COUNT_UP_TICK_MS = 30

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 출생 신고서 (설계 5.6절). 능력치를 안목 → 인내심 → 용기 → 줏대 → 운 순서로 하나씩 공개하고 별명을 붙여 준다.
 */
export function BirthCertificate({ game, onStart }: { game: Game; onStart: () => void }) {
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
    <Document
      title="출생 신고"
      number={`No. KOR-${yearOf(game.startAge)}-${game.gameId.slice(0, 7)}`}
      testId="birth-reveal"
    >
      <p className="text-[11px] text-faint">이름</p>
      <h2 className="font-serif-kr text-[32px] font-black leading-tight">
        {done ? (
          <span data-testid="reveal-nickname">{nick.name}</span>
        ) : (
          <span className="text-faint">타고난 성격을 정하는 중…</span>
        )}
      </h2>
      <p className="mt-2 text-[13px] text-muted">
        {yearOf(game.startAge)}년, {game.startAge}세,{' '}
        <span data-testid="birth-sex">{SEX_LABELS[game.sex]}</span>.{' '}
        {game.initialAsset > 0
          ? `능력치 5개와 통장 ${won(game.initialAsset)}을 가지고 인생을 시작합니다.`
          : '능력치 5개와 빈 통장으로 인생을 시작합니다. 20세부터 아르바이트로 돈을 법니다.'}
      </p>

      <ul className="mt-5 flex flex-col gap-2.5 border-t border-line-soft pt-4">
        {STAT_KEYS.map((key, index) => (
          <li
            key={key}
            className="grid grid-cols-[52px_1fr_72px] items-center gap-3"
            data-testid={`reveal-${key}`}
          >
            <span className="text-[13px]">{STAT_LABELS[key]}</span>
            {index < revealed ? (
              <CountUpBar value={game.initialStats[key]} instant={instant} />
            ) : (
              <>
                <span className="h-2 rounded-sm bg-line-soft" />
                <span className="text-right font-mono-num text-faint">?</span>
              </>
            )}
          </li>
        ))}
      </ul>

      {done && (
        <div className="animate-reveal mt-6 border-t border-line-soft pt-5">
          <div className="flex items-center gap-4">
            <Sprite
              spec={layersFor(game.initialStats, game.initialStats, game.startAge, game.sex)}
              size={64}
              className="border border-line bg-bg"
            />
            <p className="text-[13px] font-bold text-wine">
              약점: {STAT_LABELS[nick.weakness]} — {nick.weaknessEffect}
            </p>
          </div>
          <p className="mt-4 border-l-[3px] border-teal bg-teal-soft px-3 py-2 text-[13px]">
            선택은 당신이 하지만, 실행은 당신의 성격이 합니다.
          </p>
          <button
            type="button"
            className="mt-5 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
            onClick={onStart}
          >
            삶을 시작하기
          </button>
        </div>
      )}
    </Document>
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
      <span className="h-2 overflow-hidden rounded-sm bg-line-soft">
        <span className="block h-full bg-teal" style={{ width: `${shown}%` }} />
      </span>
      <span className="flex items-center justify-end gap-1.5">
        {shown >= value && <GradeBadge score={value} className="animate-reveal" />}
        <span className="animate-reveal w-6 text-right font-mono-num text-base font-semibold">
          {shown}
        </span>
      </span>
    </>
  )
}
