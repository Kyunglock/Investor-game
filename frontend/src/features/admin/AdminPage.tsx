import { type FormEvent, useState } from 'react'
import { api } from '../../api/client'
import type { components } from '../../api/schema'
import { Card } from '../game/Card'
import { money } from '../game/labels'

type PlayLog = components['schemas']['PlayLog']
type CompanyPlay = PlayLog['companies'][number]

/**
 * 첫 회사가 어느 해에서 멈췄는지 (decisions.md 228·264번). 해 순. 돌고 있는 회사는 지금 해에, 망해서 닫은 회사(247번)는 닫은 해에 멈춘 것으로
 * 센다. 매각을 빼기 전에 팔린 회사는 한 바퀴를 다 돈 것이라 세지 않는다. 아무도 뽑지 않은 회사는 따로 센다: 처음 온 사람이 공채에서 막혔는지가 가장
 * 궁금하다. 첫 회사만 센다(다음 회사는 이미 한 바퀴를 돈 사람이다).
 */
export function dropOff(
  companies: CompanyPlay[],
): { year: number; all: number; noStaff: number }[] {
  const rows = new Map<number, { year: number; all: number; noStaff: number }>()
  for (const c of companies) {
    if (c.sold || c.number !== 1) {
      continue
    }
    const row = rows.get(c.year) ?? { year: c.year, all: 0, noStaff: 0 }
    row.all++
    if (c.employees === 0) {
      row.noStaff++
    }
    rows.set(c.year, row)
  }
  return [...rows.values()].sort((a, b) => a.year - b.year)
}

const TOKEN_KEY = 'ig-admin-token'

const STATUS_LABEL: Record<CompanyPlay['status'], string> = {
  ACTIVE: '도는 중',
  ENDED: '닫음',
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

  const sold = log?.companies.filter((c) => c.sold).length ?? 0
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
            세션 <b>{log.sessions.length}</b> · 회사 <b>{log.companies.length}</b> · 판 회사{' '}
            <b>{sold}</b>
          </p>

          <Card title="첫 회사가 멈춘 해" aside="도는 중이거나 망해서 닫은 첫 회사, 해 순">
            <table className="w-full text-left text-[13px]" data-testid="admin-dropoff">
              <thead className="text-[11px] text-faint">
                <tr>
                  <th className="py-1 font-normal">해</th>
                  <th className="font-normal">멈춘 회사</th>
                  <th className="font-normal">그중 직원 없음</th>
                </tr>
              </thead>
              <tbody>
                {dropOff(log.companies).map((row) => (
                  <tr key={row.year} className="border-t border-line-soft">
                    <td className="py-1.5 font-mono-num">{row.year}년 차</td>
                    <td className="font-mono-num">{row.all}</td>
                    <td className="font-mono-num">{row.noStaff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="회사" aside="최근에 차린 순">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead className="text-[11px] text-faint">
                  <tr>
                    <th className="py-1 font-normal">차림</th>
                    <th className="font-normal">세션</th>
                    <th className="font-normal">IP</th>
                    <th className="font-normal">상태</th>
                    <th className="font-normal">해</th>
                    <th className="font-normal">마지막</th>
                    <th className="font-normal">자본</th>
                    <th className="font-normal">등급</th>
                    <th className="font-normal">직원</th>
                  </tr>
                </thead>
                <tbody>
                  {log.companies.map((c) => (
                    <tr
                      key={c.companyId}
                      className="border-t border-line-soft"
                      data-testid="admin-company"
                    >
                      <td className="py-1.5 font-mono-num">{time(c.createdAt)}</td>
                      <td className="font-mono-num">{shortId(c.sessionId)}</td>
                      <td className="font-mono-num">{ipOf.get(c.sessionId) ?? '—'}</td>
                      <td>
                        {c.number}호 · {STATUS_LABEL[c.status]}
                        {c.sold && ' · 팔림'}
                      </td>
                      <td className="font-mono-num">결산 {c.settled}번</td>
                      <td className="font-mono-num">{time(c.updatedAt)}</td>
                      <td className="font-mono-num">{money(c.capital)}</td>
                      <td className="font-mono-num">{c.grade}</td>
                      <td className="font-mono-num">{c.employees}명</td>
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
                    <th className="font-normal">회사</th>
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
                      <td className="font-mono-num">{s.companies}</td>
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
