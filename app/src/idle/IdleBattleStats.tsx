import type { Company } from '@web/api/client'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Sheet } from '../app/Sheet'
import { useAppUi } from '../app/ui'
import {
  addWalls,
  type BattleStats,
  record,
  resetLeft,
  type StatsCat,
  sharesText,
  summarize,
} from './battleStats'
import { IdleIcon } from './icons'
import './battle-stats.css'

const KEY = 'idle-battle-stats'
/** 한 번에 넘어간 벽이 이보다 많으면 깬 것이 아니라 옮긴 것(테스트판 건너뛰기 등)이다. */
const MOST_WALLS = 10

/** 지금 창의 통계 (645번): 화면이 켜져 있는 동안 모은다. 같은 창이면 기기에 남겨 다시 열어도 이어 간다. */
let stats: BattleStats | null = load()

function load(): BattleStats | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as BattleStats) : null
  } catch {
    return null
  }
}

function save() {
  try {
    if (stats) localStorage.setItem(KEY, JSON.stringify(stats))
  } catch {
    // 저장하지 못해도 이번 화면의 통계는 그대로다.
  }
}

/** 출전한 고양이: 이름과 스킬. */
function fieldedCats(company: Company): StatsCat[] {
  return (company.idle?.cats ?? [])
    .filter((cat) => cat.fielded)
    .map((cat) => ({ code: cat.code, name: cat.name, skills: cat.skills }))
}

/**
 * 전투 통계 (decisions.md 645번): 오른쪽 스킬 줄 위의 통계 단추와 10분 창의 통계 시트. 시트에는 최고 기록·보스 보상과 기여 순위만
 * 보인다 (662번: 총 피해·초당 피해 같은 여덟 칸은 뺐다). 서버에 실려 갈 명중(idle-hit-counted)과
 * 매도벽이 아닌 것을 맞힌 피해(idle-stats-hit, 647번)를 쏜 곳마다 모으고, 서버가 넘어간 벽을 센다.
 */
export function IdleBattleStats({ company }: { company: Company }) {
  const [open, setOpen] = useState(false)
  const wall = company.idle?.wall ?? 0
  const seen = useRef(wall)
  useEffect(() => {
    const hit = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        kind?: string
        damage?: number
        owner?: string | null
        crit?: boolean
        order?: boolean
      }
      if (!detail?.kind || detail.damage === undefined) return
      stats = record(stats, Date.now(), {
        kind: detail.kind,
        damage: detail.damage,
        owner: detail.owner ?? null,
        crit: Boolean(detail.crit),
        order: Boolean(detail.order),
      })
    }
    window.addEventListener('idle-hit-counted', hit)
    // 647번: 매도 물량·큰손·몬스터를 맞힌 피해. 서버에는 가지 않는다.
    window.addEventListener('idle-stats-hit', hit)
    const timer = window.setInterval(save, 5000)
    return () => {
      window.removeEventListener('idle-hit-counted', hit)
      window.removeEventListener('idle-stats-hit', hit)
      window.clearInterval(timer)
      save()
    }
  }, [])
  useEffect(() => {
    const gained = wall - seen.current
    seen.current = wall
    if (gained > 0 && gained <= MOST_WALLS) stats = addWalls(stats, Date.now(), gained)
  }, [wall])
  return (
    <>
      <button
        type="button"
        className="idle-stats-shortcut"
        aria-label="전투 통계"
        data-testid="idle-stats"
        onClick={() => setOpen(true)}
      >
        <IdleIcon name="stats" />
      </button>
      {open && <StatsSheet company={company} onClose={() => setOpen(false)} />}
    </>
  )
}

function StatsSheet({ company, onClose }: { company: Company; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const dismiss = useEffectEvent(onClose)
  useEffect(() => {
    const before = useAppUi.getState().modalBack
    useAppUi.getState().setModalBack(() => dismiss())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      useAppUi.getState().setModalBack(before)
      window.clearInterval(timer)
    }
  }, [])
  const s = summarize(stats, now, fieldedCats(company))
  // 최고 기록: 통과한 가장 높은 벽. 지금 선 벽이 그보다 높으면 기록을 갱신하는 중이다. 보스 보상: 다이아 보상을 받은 가장 높은 보스.
  const best = company.idle?.bestWall ?? 0
  const recordRun = best > 0 && (company.idle?.wall ?? 0) > best
  const bossPaid = company.idle?.bossReward?.wall ?? 0
  const top = s.rows[0]?.damage ?? 0
  const percent = (share: number) => `${(share * 100).toFixed(share > 0 && share < 0.1 ? 1 : 0)}%`
  return (
    <Sheet
      title="전투 통계"
      onClose={onClose}
      testId="stats"
      className="idle-sheet idle-stats-sheet"
    >
      <p className="idle-stats-window">
        <b>최근 10분</b>
        <span data-testid="stats-reset">{resetLeft(s.left)} 뒤 초기화</span>
      </p>
      {/* 최고 기록과 보스 보상 (654번): 벽 번호 아래에 있던 것을 여기로 옮겼다 (662번). */}
      <dl className="idle-stats-grid" data-testid="stats-record">
        <div data-record={recordRun || undefined}>
          <dt>최고 기록</dt>
          <dd data-testid="stats-best-wall">
            {recordRun ? '갱신 중!' : best > 0 ? `매도벽 ${best.toLocaleString()}` : '아직 없어요'}
          </dd>
        </div>
        <div>
          <dt>보스 보상</dt>
          <dd data-testid="stats-boss-paid">
            {bossPaid > 0 ? `매도벽 ${bossPaid.toLocaleString()}까지` : '아직 없어요'}
          </dd>
        </div>
      </dl>
      <h4 className="idle-stats-title">기여 순위</h4>
      {s.total <= 0 ? (
        <p className="idle-stats-empty" data-testid="stats-empty">
          아직 이번 10분에 넣은 피해가 없어요
        </p>
      ) : (
        <ol className="idle-stats-rank" data-testid="stats-rank">
          {s.rows.map((row, i) => (
            <li key={row.code} data-testid="stats-row" data-code={row.code}>
              <b className="idle-stats-no">{i + 1}</b>
              <span className="idle-stats-name">{row.name}</span>
              <span className="idle-stats-damage">{sharesText(row.damage)}</span>
              <span className="idle-stats-share">{percent(row.share)}</span>
              <div className="idle-stats-bar" aria-hidden="true">
                <i style={{ width: `${top > 0 ? (row.damage / top) * 100 : 0}%` }} />
              </div>
              {row.damage > 0 && (
                <small className="idle-stats-skill">
                  매도벽 {sharesText(row.wall)} · 물량 {sharesText(row.damage - row.wall)}
                  {row.skill > 0 && ` · 스킬 ${sharesText(row.skill)}`}
                </small>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="idle-stats-note">화면을 켜 둔 동안 매도벽과 매도 물량에 넣은 피해를 세요.</p>
    </Sheet>
  )
}
