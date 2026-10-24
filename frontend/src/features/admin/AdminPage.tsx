import { type FormEvent, useState } from 'react'
import { api } from '../../api/client'
import type { components } from '../../api/schema'
import { Card } from '../game/Card'
import { shortWon } from '../game/labels'

type PlayLog = components['schemas']['PlayLog']
type Play = PlayLog['plays'][number]

const TOKEN_KEY = 'ig-admin-token'

const STATUS_LABEL: Record<Play['status'], string> = {
  ACTIVE: '진행 중',
  ENDED: '끝남',
  ABANDONED: '버림',
}

/** 세션 ID 앞 8자리. 계정이 없어 "누구"는 익명 세션이다 (decisions.md 46번). */
function shortId(id: string): string {
  return id.slice(0, 8)
}

const timeFormat = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function time(iso: string | null | undefined): string {
  return iso ? timeFormat.format(new Date(iso)) : '—'
}

function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

/** `/admin`: 관리자 플레이 기록. 토큰은 이 탭에만(sessionStorage) 기억한다. */
export function AdminPage() {
  const [token, setToken] = useState(readToken)
  const [log, setLog] = useState<PlayLog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async (e?: FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    const { data, response } = await api.GET('/api/admin/plays', {
      params: { header: { 'X-Admin-Token': token } },
    })
    setLoading(false)
    if (!data) {
      setLog(null)
      setError(response.status === 403 ? '토큰이 맞지 않습니다.' : '불러오지 못했습니다.')
      return
    }
    try {
      sessionStorage.setItem(TOKEN_KEY, token)
    } catch {
      // 저장이 막혀도 이번 화면은 그대로 쓴다.
    }
    setLog(data)
  }

  const ended = log?.plays.filter((p) => p.status === 'ENDED').length ?? 0
  const ipOf = new Map(log?.sessions.map((s) => [s.sessionId, s.lastIp ?? '—']) ?? [])

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-6">
      <h1 className="font-pen text-[32px] font-normal leading-none text-pen">플레이 기록</h1>
      <form className="flex flex-wrap gap-2" onSubmit={load}>
        <input
          type="password"
          aria-label="관리자 토큰"
          placeholder="관리자 토큰"
          className="min-h-11 flex-1 rounded border border-line bg-card px-3 text-sm"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button
          type="submit"
          disabled={!token || loading}
          className="min-h-11 rounded-full border-2 border-pen bg-paper px-4 font-note text-sm text-pen hover:bg-white disabled:opacity-40"
        >
          {loading ? '불러오는 중…' : log ? '새로고침' : '보기'}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-wine">
          {error}
        </p>
      )}

      {log && (
        <>
          <p className="text-sm" data-testid="admin-summary">
            세션 <b>{log.sessions.length}</b> · 판 <b>{log.plays.length}</b> · 끝까지 한 판{' '}
            <b>{ended}</b>
          </p>

          <Card title="판" aside="최근에 시작한 순">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="text-[11px] text-faint">
                  <tr>
                    <th className="py-1 font-normal">시작</th>
                    <th className="font-normal">세션</th>
                    <th className="font-normal">IP</th>
                    <th className="font-normal">상태</th>
                    <th className="font-normal">나이</th>
                    <th className="font-normal">마지막</th>
                    <th className="font-normal">최종 자산</th>
                    <th className="font-normal">엔딩</th>
                  </tr>
                </thead>
                <tbody>
                  {log.plays.map((p) => (
                    <tr
                      key={p.gameId}
                      className="border-t border-line-soft"
                      data-testid="admin-play"
                    >
                      <td className="py-1.5 font-mono-num">{time(p.startedAt)}</td>
                      <td className="font-mono-num">{shortId(p.sessionId)}</td>
                      <td className="font-mono-num">{ipOf.get(p.sessionId) ?? '—'}</td>
                      <td>{STATUS_LABEL[p.status]}</td>
                      <td className="font-mono-num">
                        {p.startAge}→{p.age}세
                      </td>
                      <td className="font-mono-num">{time(p.endedAt ?? p.updatedAt)}</td>
                      <td className="font-mono-num">
                        {p.finalAsset == null ? '—' : shortWon(p.finalAsset)}
                      </td>
                      <td>
                        {p.ending == null ? '—' : p.ending === 'BANKRUPT' ? '파산' : '끝까지'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="세션" aside="마지막 접속 순">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[13px]">
                <thead className="text-[11px] text-faint">
                  <tr>
                    <th className="py-1 font-normal">세션</th>
                    <th className="font-normal">IP (처음 → 마지막)</th>
                    <th className="font-normal">처음 온 때</th>
                    <th className="font-normal">마지막 접속</th>
                    <th className="font-normal">판 수</th>
                  </tr>
                </thead>
                <tbody>
                  {log.sessions.map((s) => (
                    <tr key={s.sessionId} className="border-t border-line-soft">
                      <td className="py-1.5 font-mono-num">{shortId(s.sessionId)}</td>
                      <td className="font-mono-num">
                        {s.firstIp ?? '—'}
                        {s.lastIp && s.lastIp !== s.firstIp && ` → ${s.lastIp}`}
                      </td>
                      <td className="font-mono-num">{time(s.createdAt)}</td>
                      <td className="font-mono-num">{time(s.lastSeenAt)}</td>
                      <td className="font-mono-num">{s.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </main>
  )
}
