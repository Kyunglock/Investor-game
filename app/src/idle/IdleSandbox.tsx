import type { Company } from '@web/api/client'
import { useRaisingStore, type WeaponGrade } from '@web/features/raising/store'
import { type FormEvent, useEffect, useState } from 'react'
import { idleThreat } from '../mental/assault'
import { IDLE_RAID_ORDER, type IdleRaidKind } from '../mental/waves'
import { readFrameMeter, saveFrameMeter } from './frameMeter'
import { IdleFrameMeter } from './IdleFrameMeter'

/** 벽 건너뛰기: 지금 벽에서 더하고 빼는 걸음과 바로 가는 벽. 보스 벽(50의 배수)과 그 앞뒤를 보기 쉽게 골랐다. */
const WALL_STEPS = [-10, -1, 1, 10, 50, 100] as const
const WALL_PRESETS = [1, 50, 100, 200, 500, 1000] as const
const MAX_WALL = 100000
const RAID_NAMES: Record<IdleRaidKind, string> = {
  panic: '패닉셀',
  dump: '투매',
  short: '공매도',
  spec: '투기',
}
const CAT_LEVELS = [1, 5, 10, 30] as const
const WEAPON_GRADES: WeaponGrade[] = [
  'F',
  'E',
  'D',
  'C',
  'B',
  'A',
  'S',
  'SS',
  'SSS',
  'SR',
  'UR',
  'LR',
]

/**
 * 테스트판의 입구 (decisions.md 499·624번): 테스트판으로 만든 화면(`VITE_APP_TEST=1`, 화면을 담은 테스트판 APK)이거나 주소에
 * `?test=1`이 붙어 있을 때만 열린다(브라우저, 주소를 띄우는 APK). 보통 앱과 웹에는 입구가 보이지 않는다. 화면이 뜰 때 한 번 읽는다.
 */
export const SANDBOX_ENTRY =
  import.meta.env.VITE_APP_TEST === '1' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('test') === '1')

/**
 * 테스트판에 들어간 코드와 "본 게임으로" 나왔다는 표시. 화면은 회사가 바뀔 때마다 새로 그려지고(App의 key), 앱의 WebView는 쿠키를
 * 늦게 디스크에 적어 앱을 닫으면 테스트판 쿠키가 사라질 수 있다. 그래서 코드 창의 열림을 화면 상태만으로 정하면, 나온 뒤에도 바로 다시
 * 뜨고 다시 켜면 또 코드를 묻는다. 맞힌 코드를 이 기기에 남겨 두고 다시 켤 때 조용히 들어가며, 스스로 나왔으면 창을 띄우지 않는다.
 */
const SAVED_CODE = 'idle-sandbox-code'
const LEFT = 'idle-sandbox-left'
function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeKey(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 저장소를 못 쓰면 남기지 않는다: 다음에 코드를 다시 물을 뿐이다.
  }
}
/** 이 화면을 연 뒤 저장한 코드로 다시 들어가 보았는가. 한 번만 시도해 실패가 되풀이되지 않게 한다. */
let autoTried = false

/**
 * 테스트판 (decisions.md 499번). 입구(SANDBOX_ENTRY)가 열려 있으면 코드 창이 뜨고, 닫아도 머리띠 아래의 "테스트판" 단추로 다시 연다. 테스트판
 * 안에서는 그 단추가 도구 창을 연다: 벽 건너뛰기, 처음부터 다시, 본 게임으로.
 */
export function IdleSandbox({ company }: { company: Company }) {
  const [open, setOpen] = useState(
    () =>
      SANDBOX_ENTRY && !company.sandbox && !readKey(LEFT) && (autoTried || !readKey(SAVED_CODE)),
  )
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState(false)
  const [target, setTarget] = useState('')
  const [resetAsked, setResetAsked] = useState(false)
  // 프레임 표시 (543번): 테스트판에서만 뜨고, 도구 창에서 켜고 끈다.
  const [frames, setFrames] = useState(readFrameMeter)
  const close = () => {
    setOpen(false)
    setCode('')
    setError(null)
  }
  // 전에 맞힌 코드가 있으면 묻지 않고 다시 들어간다 (쿠키가 사라진 경우). 실패하면 코드를 지우고 창을 띄운다.
  const sandbox = company.sandbox
  useEffect(() => {
    if (!SANDBOX_ENTRY || sandbox || autoTried || readKey(LEFT)) return
    const saved = readKey(SAVED_CODE)
    if (!saved) return
    autoTried = true
    void useRaisingStore
      .getState()
      .enterSandbox(saved)
      .then((failed) => {
        if (!failed) return
        writeKey(SAVED_CODE, null)
        setError(failed)
        setOpen(true)
      })
  }, [sandbox])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true)
    const entered = code.trim()
    const failed = await useRaisingStore.getState().enterSandbox(entered)
    setBusy(false)
    if (failed) {
      setError(failed)
      return
    }
    writeKey(SAVED_CODE, entered)
    writeKey(LEFT, null)
    close()
  }
  const leave = async () => {
    if (busy) return
    // 스스로 나왔다: 본 게임 화면이 새로 그려져도 코드 창을 다시 띄우지 않는다. 머리띠 아래 단추로는 언제든 다시 들어간다.
    writeKey(LEFT, '1')
    setBusy(true)
    await useRaisingStore.getState().leaveSandbox()
    setBusy(false)
    setPanel(false)
  }
  const idle = company.idle
  const wall = idle?.wall ?? 1
  const jump = async (to: number) => {
    if (busy) return
    setBusy(true)
    await useRaisingStore
      .getState()
      .jumpSandboxWall(Math.max(1, Math.min(MAX_WALL, Math.floor(to))))
    setBusy(false)
    setTarget('')
  }
  const store = () => useRaisingStore.getState()
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    await action()
    setBusy(false)
  }
  const reset = async () => {
    if (busy) return
    if (!resetAsked) {
      setResetAsked(true)
      return
    }
    setBusy(true)
    await useRaisingStore.getState().resetSandbox()
    setBusy(false)
    setResetAsked(false)
    setPanel(false)
  }
  const closePanel = () => {
    setPanel(false)
    setResetAsked(false)
    setTarget('')
  }
  return (
    <>
      {/* 단추와 프레임 표시는 머리띠 바로 아래 가운데에 나란히 둔다 (#919): 왼쪽 가장자리의 환생·광고 스킬 단추와 겹치지 않게. */}
      {company.sandbox && (
        <div className="idle-sandbox-bar">
          <button
            type="button"
            className="idle-sandbox"
            data-testid="idle-sandbox"
            onClick={() => setPanel(true)}
          >
            <b>테스트판</b>
            <small>도구</small>
          </button>
          {frames && <IdleFrameMeter />}
        </div>
      )}
      {company.sandbox && panel && (
        <div
          className="idle-sandbox-gate"
          role="dialog"
          aria-modal="true"
          aria-label="테스트판 도구"
          data-testid="idle-sandbox-panel"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (target.trim()) void jump(Number(target))
            }}
          >
            <h2>테스트판 도구</h2>
            <p className="idle-sandbox-note" data-testid="idle-sandbox-info">
              지금 매도벽 {wall.toLocaleString()}
              {idle?.boss ? ' (보스)' : ''} · 벽 체력{' '}
              {Math.round(idle?.maxHp ?? 0).toLocaleString()} · 물량 ×
              {idleThreat(wall, idle?.maxHp ?? 0)}
            </p>
            <label className="idle-sandbox-label" htmlFor="idle-sandbox-wall">
              벽 건너뛰기
            </label>
            <div className="idle-sandbox-row">
              <input
                id="idle-sandbox-wall"
                value={target}
                onChange={(e) => setTarget(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="벽 번호"
                inputMode="numeric"
                autoComplete="off"
              />
              <button type="submit" disabled={busy || !target.trim()}>
                이동
              </button>
            </div>
            <div className="idle-sandbox-chips">
              {WALL_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  disabled={busy || wall + step < 1}
                  onClick={() => void jump(wall + step)}
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
            </div>
            <div className="idle-sandbox-chips">
              {WALL_PRESETS.map((to) => (
                <button key={to} type="button" disabled={busy} onClick={() => void jump(to)}>
                  {to}벽
                </button>
              ))}
            </div>
            <span className="idle-sandbox-label">몬스터 습격 바로 부르기</span>
            <div className="idle-sandbox-chips is-four">
              {IDLE_RAID_ORDER.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('idle-test-raid', { detail: kind }))
                    closePanel()
                  }}
                >
                  {RAID_NAMES[kind]}
                </button>
              ))}
            </div>
            <span className="idle-sandbox-label">동료 고양이 39종 모두 받기</span>
            <div className="idle-sandbox-chips is-four">
              {CAT_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => store().grantSandboxCats(level))}
                >
                  Lv.{level}
                </button>
              ))}
            </div>
            <span className="idle-sandbox-label">무기 받아 들기 (여섯 자루)</span>
            <div className="idle-sandbox-chips">
              {WEAPON_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  disabled={busy}
                  onClick={() => void run(() => store().grantSandboxWeapon(grade))}
                >
                  {grade}
                </button>
              ))}
            </div>
            <span className="idle-sandbox-label">프레임 표시 (FPS · 가장 긴 프레임 · 끊김)</span>
            <div className="idle-sandbox-chips is-two">
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  aria-pressed={frames === on}
                  data-testid={on ? 'idle-sandbox-frames-on' : 'idle-sandbox-frames-off'}
                  onClick={() => {
                    saveFrameMeter(on)
                    setFrames(on)
                  }}
                >
                  {on ? '켜기' : '끄기'}
                </button>
              ))}
            </div>
            <span className="idle-sandbox-label">출석·상점</span>
            <div className="idle-sandbox-chips is-one">
              <button
                type="button"
                disabled={busy}
                data-testid="idle-sandbox-next-day"
                onClick={() =>
                  // 날이 바뀌면 출석판이 스스로 뜨므로 도구 창은 닫는다.
                  void run(async () => {
                    await store().skipSandboxDay()
                    closePanel()
                  })
                }
              >
                다음 날로
              </button>
            </div>
            <span className="idle-sandbox-label">시즌패스</span>
            <div className="idle-sandbox-chips is-two">
              <button
                type="button"
                disabled={busy}
                data-testid="idle-sandbox-pass-exp"
                onClick={() => void run(() => store().addSandboxPassExp(500))}
              >
                패스 포인트 +500
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="idle-sandbox-next-season"
                onClick={() => void run(() => store().skipSandboxSeason())}
              >
                다음 시즌으로
              </button>
            </div>
            <label className="idle-sandbox-check">
              <input
                type="checkbox"
                checked={Boolean(company.sandboxInfinite)}
                disabled={busy}
                onChange={(e) => void run(() => store().setSandboxWallet(e.target.checked))}
              />
              <span>
                무한 지갑
                <small className="idle-sandbox-hint">
                  {company.sandboxInfinite
                    ? '자본과 다이아가 쓸 때마다 다시 채워져요'
                    : '꺼짐: 이 벽에서 버는 돈으로만 강화해요'}
                </small>
              </span>
            </label>
            <div className="idle-sandbox-actions">
              <button type="button" onClick={() => void reset()} disabled={busy}>
                {resetAsked ? '한 번 더 누르면 초기화' : '처음부터 다시'}
              </button>
              <button type="button" onClick={() => void leave()} disabled={busy}>
                본 게임으로
              </button>
            </div>
            <button type="button" onClick={closePanel}>
              닫기
            </button>
          </form>
        </div>
      )}
      {SANDBOX_ENTRY && !company.sandbox && !open && (
        <div className="idle-sandbox-bar">
          <button
            type="button"
            className="idle-sandbox"
            data-testid="idle-sandbox-enter"
            onClick={() => setOpen(true)}
          >
            <b>테스트판</b>
            <small>들어가기</small>
          </button>
        </div>
      )}
      {SANDBOX_ENTRY && open && !company.sandbox && (
        <div className="idle-sandbox-gate" role="dialog" aria-modal="true" aria-label="테스트판">
          <form onSubmit={submit}>
            <h2>테스트판</h2>
            <p className="idle-sandbox-note">
              자본과 다이아가 떨어지지 않는 연습용 회사예요. 본 게임은 그대로 남아요.
            </p>
            {/* 틀렸다는 글은 입력 칸 위에 둔다: 휴대폰 자판이 올라오면 칸 아래는 가려져 창이 그냥 다시 뜬 것처럼 보였다. */}
            {error && (
              <p className="idle-sandbox-error" role="alert">
                {error}
              </p>
            )}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="코드"
              aria-label="테스트판 코드"
              autoComplete="off"
              autoCapitalize="off"
              maxLength={100}
              // biome-ignore lint/a11y/noAutofocus: 코드 창은 테스트판 입구에서만 열리고 입력 칸 하나뿐이다.
              autoFocus
            />
            <div className="idle-sandbox-actions">
              <button type="button" onClick={close}>
                닫기
              </button>
              <button type="submit" disabled={busy || !code.trim()}>
                들어가기
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
