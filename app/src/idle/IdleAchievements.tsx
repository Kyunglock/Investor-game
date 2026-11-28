import type { Company } from '@web/api/client'
import { DiamondIcon } from '@web/features/raising/DiamondIcon'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useEffectEvent, useState } from 'react'
import { Sheet } from '../app/Sheet'
import { useAppUi } from '../app/ui'
import { sfx } from '../fx/sound'
import { IdleIcon } from './icons'

type Goal = NonNullable<Company['achievements']>['list'][number]

/**
 * 업적 (decisions.md 708번): 돌파 화면 오른쪽, 전투 통계 단추 위의 우승컵 단추와 업적 시트. 한 번뿐인 목표를 단계별로 깨면 다이아를 받는다. 받을 업적이
 * 있으면 단추에 그 수를 단다.
 */
export function IdleAchievements({ company }: { company: Company }) {
  const [open, setOpen] = useState(false)
  const board = company.achievements
  if (!board) return null
  return (
    <>
      <button
        type="button"
        className="idle-achieve-shortcut"
        aria-label={board.ready > 0 ? `업적 받을 것 ${board.ready}개` : '업적'}
        data-testid="idle-achievements"
        onClick={() => {
          sfx.tap()
          setOpen(true)
        }}
      >
        <IdleIcon name="trophy" />
        {board.ready > 0 && (
          <b className="idle-quick-count" data-testid="achievements-badge" aria-hidden="true">
            {board.ready}
          </b>
        )}
      </button>
      {open && <AchievementsSheet company={company} onClose={() => setOpen(false)} />}
    </>
  )
}

function AchievementsSheet({ company, onClose }: { company: Company; onClose: () => void }) {
  const board = company.achievements
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [got, setGot] = useState<number | null>(null)
  const dismiss = useEffectEvent(onClose)
  useEffect(() => {
    const before = useAppUi.getState().modalBack
    useAppUi.getState().setModalBack(() => dismiss())
    return () => useAppUi.getState().setModalBack(before)
  }, [])
  if (!board) return null
  const claim = async (code?: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    const after = await useRaisingStore.getState().claimAchievement(code)
    setBusy(false)
    if (!after) {
      setError(useRaisingStore.getState().error ?? '연결이 끊겼어요. 다시 시도해 주세요.')
      return
    }
    sfx.cash()
    setGot(after.achievements?.lastDiamonds ?? 0)
  }
  // 받을 것이 있는 업적을 위로, 다 깬 업적을 아래로.
  const order = (g: Goal) => (g.ready ? 0 : g.done ? 2 : 1)
  const list = [...board.list].sort((a, b) => order(a) - order(b))
  return (
    <Sheet
      title="업적"
      onClose={onClose}
      testId="achievements"
      className="idle-sheet idle-pass-sheet"
    >
      <p className="idle-subtitle">목표를 이루면 다이아를 받아요. 환생해도 사라지지 않아요</p>
      {got != null && got > 0 && (
        <p className="idle-pass-got" role="status" data-testid="achievements-got">
          <b>다이아 {got.toLocaleString()}개</b> 받았어요
        </p>
      )}
      {error && (
        <p className="idle-pass-error" role="alert">
          {error}
        </p>
      )}
      {board.ready > 0 && (
        <button
          type="button"
          className="idle-pass-all"
          disabled={busy}
          onClick={() => void claim()}
          data-testid="achievements-claim-all"
        >
          모두 받기 <small className="idle-pass-all-count">{board.ready}개</small>
        </button>
      )}
      <ul className="idle-pass-missions idle-achievements" data-testid="achievements-list">
        {list.map((g) => {
          const state = g.ready ? 'ready' : g.done ? 'done' : 'todo'
          return (
            <li
              key={g.code}
              className={`is-${state}`}
              data-testid="achievement"
              data-code={g.code}
              data-state={state}
            >
              <span className="idle-pass-mission-name">
                {g.title}
                <small className="idle-achievement-tier">
                  {' '}
                  {Math.min(g.tier + 1, g.tiers)}/{g.tiers}단계
                </small>
              </span>
              <span className="idle-pass-mission-count">
                {g.count.toLocaleString()}/{g.target.toLocaleString()}
              </span>
              {state === 'ready' ? (
                <button
                  type="button"
                  className="idle-pass-mission-claim"
                  disabled={busy}
                  onClick={() => void claim(g.code)}
                  data-testid="achievement-claim"
                >
                  받기 <DiamondIcon /> {g.diamonds}
                </button>
              ) : (
                <b className="idle-pass-mission-points">
                  {state === 'done' ? (
                    '완료'
                  ) : (
                    <>
                      <DiamondIcon /> {g.diamonds}
                    </>
                  )}
                </b>
              )}
              <div
                className="idle-pass-bar"
                role="progressbar"
                aria-label={`${g.title} 진행도`}
                aria-valuemin={0}
                aria-valuemax={g.target}
                aria-valuenow={g.count}
              >
                <i style={{ width: `${Math.min(1, g.count / Math.max(1, g.target)) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
