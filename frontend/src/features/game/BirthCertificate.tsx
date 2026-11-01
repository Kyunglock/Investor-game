import { useEffect, useState } from 'react'
import type { Game } from '../../api/client'
import { Document } from './Document'
import { GradeBadge } from './GradeBadge'
import { SEX_LABELS, STAT_KEYS, STAT_LABELS, won, yearOf } from './labels'
import { nickname } from './nickname'
import { layersFor } from './pixel/layers'
import { Sprite } from './pixel/SpriteView'
import { NAME_MAX_LENGTH, validName } from './playerName'

/** 능력치 하나가 공개되는 간격과, 숫자가 0에서 올라가는 시간. */
const STEP_MS = 700
const COUNT_UP_MS = 500
const COUNT_UP_TICK_MS = 30

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * 출생 신고서 (설계 5.6절). 능력치를 안목 → 인내심 → 용기 → 줏대 → 운 순서로 하나씩 공개한다. 이름은 사용자가 적는다 (decisions.md 135번).
 * 다 공개된 뒤 이름을 적어야 삶을 시작할 수 있다.
 */
export function BirthCertificate({
  game,
  onStart,
}: {
  game: Game
  /** 이름을 서버에 적고 시작한다. 실패하면 이유를 돌려준다 */
  onStart: (name: string) => Promise<string | null>
}) {
  const [instant] = useState(reducedMotion)
  const [revealed, setRevealed] = useState(instant ? STAT_KEYS.length : 0)
  const done = revealed >= STAT_KEYS.length
  const nick = nickname(game.initialStats)
  const [name, setName] = useState(game.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = async () => {
    if (!validName(name) || saving) {
      return
    }
    setSaving(true)
    setError(await onStart(name))
    setSaving(false)
  }

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
      <label className="block">
        <span className="text-[11px] text-faint">이름</span>
        <input
          type="text"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          placeholder="이 아이의 이름을 적어 주세요"
          autoComplete="off"
          className="mt-0.5 block w-full border-0 border-b-2 border-line bg-transparent px-0 py-1 font-serif-kr text-[28px] font-black leading-tight text-ink placeholder:text-[18px] placeholder:font-normal placeholder:text-faint focus:border-wine focus:outline-none"
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && done) {
              void start()
            }
          }}
          data-testid="name-input"
          aria-label="이름"
        />
      </label>
      {!done && <p className="mt-1 text-[12px] text-faint">타고난 성격을 정하는 중…</p>}
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
          {error && (
            <p role="alert" className="mt-3 text-[12px] text-wine">
              {error}
            </p>
          )}
          <button
            type="button"
            className="mt-5 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!validName(name) || saving}
            onClick={() => void start()}
            data-testid="start-life"
          >
            {validName(name) ? '삶을 시작하기' : '이름을 적으면 시작할 수 있어요'}
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
