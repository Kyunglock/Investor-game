import { useEffect, useState } from 'react'
import { api, type Game } from '../../api/client'
import type { components } from '../../api/schema'
import { Card } from './Card'
import { shortWon } from './labels'
import { NAME_MAX_LENGTH, playerName, validName } from './playerName'
import { useGameStore } from './store'

type Ranking = components['schemas']['Ranking']
type Entry = Ranking['entries'][number]

const ENDING_LABEL: Record<Entry['ending'], string> = {
  NORMAL: '은퇴',
  BANKRUPT: '파산',
  QUIT: '중단',
}

/**
 * 최종 자산 순위표 (decisions.md 141번). 끝난 판의 기록부 안에서, 이름을 적어 올리면 내 줄이 생기고 순위가 보인다. 올리는 사람만 공개되므로
 * 올리기 전에는 다른 사람의 줄만 있다.
 */
export function RankingBoard({ game }: { game: Game }) {
  const myRank = game.result?.rank ?? null
  return (
    // 내 줄이 생기면(myRank가 바뀌면) 표를 새로 받도록 key로 다시 만든다.
    <Board key={myRank ?? 'none'} game={game} myRank={myRank} />
  )
}

function Board({ game, myRank }: { game: Game; myRank: number | null }) {
  const [ranking, setRanking] = useState<Ranking | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void api.GET('/api/ranking').then(({ data }) => {
      if (!cancelled) {
        setRanking(data ?? null)
        setFailed(!data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card
      title="최종 자산 순위"
      aside={ranking ? `${ranking.total.toLocaleString('ko-KR')}명` : undefined}
      testId="ranking-board"
    >
      {myRank === null ? (
        <EnterForm game={game} />
      ) : (
        <p className="text-[13px]" data-testid="ranking-mine">
          <span className="font-mono-num text-xl font-bold text-wine">{myRank}위</span>
          <span className="ml-2 text-muted">{playerName(game)} · 순위표에 올렸습니다</span>
        </p>
      )}

      {failed && (
        <p role="alert" className="mt-3 text-[12px] text-wine">
          순위표를 불러오지 못했습니다.
        </p>
      )}
      {ranking && ranking.entries.length === 0 && (
        <p className="mt-3 text-[13px] text-muted">아직 아무도 올리지 않았습니다.</p>
      )}
      {ranking && ranking.entries.length > 0 && (
        <table className="mt-3 w-full border-collapse text-xs">
          <tbody>
            {ranking.entries.map((e) => (
              <tr
                key={e.rank}
                className={e.rank === myRank ? 'bg-bg font-semibold' : ''}
                data-testid={e.rank === myRank ? 'ranking-my-row' : undefined}
              >
                <td className="w-8 border-b border-line-soft py-1 font-mono-num text-faint">
                  {e.rank}
                </td>
                <td className="border-b border-line-soft py-1">
                  {e.name}
                  <span className="ml-1.5 text-[11px] text-faint">
                    {e.jobTitle ?? '무직'} · {e.finalAge}세 {ENDING_LABEL[e.ending]}
                  </span>
                </td>
                <td
                  className={`border-b border-line-soft py-1 text-right font-mono-num ${e.finalAsset < 0 ? 'text-down' : ''}`}
                >
                  {shortWon(e.finalAsset)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function EnterForm({ game }: { game: Game }) {
  const { enterRanking } = useGameStore.getState()
  const [name, setName] = useState(game.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!validName(name) || saving) {
      return
    }
    setSaving(true)
    setError(await enterRanking(name))
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="block flex-1">
        <span className="text-[11px] text-faint">순위표에 올릴 이름</span>
        <input
          type="text"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          placeholder="1~8자"
          autoComplete="off"
          className="mt-0.5 block w-full border-0 border-b-2 border-line bg-transparent px-0 py-1 font-serif-kr text-xl font-black text-ink placeholder:text-sm placeholder:font-normal placeholder:text-faint focus:border-wine focus:outline-none"
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void submit()
            }
          }}
          data-testid="ranking-name-input"
          aria-label="순위표에 올릴 이름"
        />
        {error && (
          <p role="alert" className="mt-1 text-[12px] text-wine">
            {error}
          </p>
        )}
      </label>
      <button
        type="button"
        className="min-h-10 rounded bg-wine px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!validName(name) || saving}
        onClick={() => void submit()}
        data-testid="ranking-enter"
      >
        순위표에 올리기
      </button>
    </div>
  )
}
