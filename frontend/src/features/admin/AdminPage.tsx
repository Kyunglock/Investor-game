import { type FormEvent, useState } from 'react'
import { api } from '../../api/client'
import type { components } from '../../api/schema'
import { Card } from '../game/Card'
import { shortWon } from '../game/labels'

type PlayLog = components['schemas']['PlayLog']
type Play = PlayLog['plays'][number]
type RunPlay = PlayLog['runs'][number]

const KIND_LABEL: Record<NonNullable<RunPlay['kind']>, string> = {
  TRAIT: '성향',
  NEWS: '뉴스',
  PRINCIPLE: '투자 원칙',
  RELEASE: '원칙 풀기',
  BIG: '큰일',
  LEVERAGE: '빚내서 사기',
  EXAM: '입사 심사',
}

/**
 * 끝내지 않은 육성 판이 어느 카드에서 멈췄는지 (증권사 육성 설계 11.5절). 카드 번호 순. 짜인 첫 판은 따로 센다: 처음 온 사람이 어디서 나가는지가
 * 가장 궁금하다.
 */
export function dropOff(
  runs: RunPlay[],
): { card: number; kind: string; all: number; first: number }[] {
  const rows = new Map<number, { card: number; kind: string; all: number; first: number }>()
  for (const r of runs) {
    if (r.status === 'ENDED' || r.kind == null) {
      continue
    }
    const row = rows.get(r.card) ?? { card: r.card, kind: KIND_LABEL[r.kind], all: 0, first: 0 }
    row.all++
    if (r.scripted) {
      row.first++
    }
    rows.set(r.card, row)
  }
  return [...rows.values()].sort((a, b) => a.card - b.card)
}

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
  const runsEnded = log?.runs.filter((r) => r.status === 'ENDED').length ?? 0
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
            세션 <b>{log.sessions.length}</b> · 육성 판 <b>{log.runs.length}</b> · 입사 심사까지{' '}
            <b>{runsEnded}</b> · 옛 인생 판 <b>{log.plays.length}</b> · 끝까지 한 판 <b>{ended}</b>
          </p>

          <Card title="육성 판이 멈춘 카드" aside="끝내지 않은 판, 카드 순">
            <table className="w-full text-left text-[13px]" data-testid="admin-dropoff">
              <thead className="text-[11px] text-faint">
                <tr>
                  <th className="py-1 font-normal">카드</th>
                  <th className="font-normal">종류</th>
                  <th className="font-normal">멈춘 판</th>
                  <th className="font-normal">그중 짜인 첫 판</th>
                </tr>
              </thead>
              <tbody>
                {dropOff(log.runs).map((row) => (
                  <tr key={row.card} className="border-t border-line-soft">
                    <td className="py-1.5 font-mono-num">{row.card + 1}번째</td>
                    <td>{row.kind}</td>
                    <td className="font-mono-num">{row.all}</td>
                    <td className="font-mono-num">{row.first}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="육성 판" aside="최근에 시작한 순">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="text-[11px] text-faint">
                  <tr>
                    <th className="py-1 font-normal">시작</th>
                    <th className="font-normal">세션</th>
                    <th className="font-normal">IP</th>
                    <th className="font-normal">상태</th>
                    <th className="font-normal">카드</th>
                    <th className="font-normal">마지막</th>
                    <th className="font-normal">총자산</th>
                    <th className="font-normal">종합 등급</th>
                  </tr>
                </thead>
                <tbody>
                  {log.runs.map((r) => (
                    <tr key={r.runId} className="border-t border-line-soft" data-testid="admin-run">
                      <td className="py-1.5 font-mono-num">{time(r.startedAt)}</td>
                      <td className="font-mono-num">{shortId(r.sessionId)}</td>
                      <td className="font-mono-num">{ipOf.get(r.sessionId) ?? '—'}</td>
                      <td>
                        {STATUS_LABEL[r.status]}
                        {r.scripted && ' · 첫 판'}
                        {r.recruit && ' · 공채'}
                      </td>
                      <td className="font-mono-num">
                        {Math.min(r.card + 1, r.cardCount)}/{r.cardCount}
                        {r.kind && ` ${KIND_LABEL[r.kind]}`}
                      </td>
                      <td className="font-mono-num">{time(r.updatedAt)}</td>
                      <td className="font-mono-num">{shortWon(r.totalAsset)}</td>
                      <td className="font-mono-num">{r.overallGrade ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="옛 인생 판" aside="최근에 시작한 순">
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
                        {p.ending == null
                          ? '—'
                          : p.ending === 'BANKRUPT'
                            ? '파산'
                            : p.ending === 'QUIT'
                              ? '중간에 그만둠'
                              : '끝까지'}
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
                    <th className="font-normal">육성 판</th>
                    <th className="font-normal">옛 판</th>
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
                      <td className="font-mono-num">{s.runs}</td>
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
