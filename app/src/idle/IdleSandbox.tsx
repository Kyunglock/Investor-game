import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { type FormEvent, useState } from 'react'
import { idleThreat } from '../mental/assault'

/** 벽 건너뛰기: 지금 벽에서 더하고 빼는 걸음과 바로 가는 벽. 큰손 벽(10의 배수)과 그 앞뒤를 보기 쉽게 골랐다. */
const WALL_STEPS = [-10, -1, 1, 10, 50, 100] as const
const WALL_PRESETS = [1, 50, 100, 200, 500, 1000] as const
const MAX_WALL = 100000

/**
 * 테스트판의 입구 (decisions.md 499번): 주소에 `?test=1`이 붙어 있을 때만 열린다. 테스트판 APK가 그 주소를 띄우고, 브라우저에서도 그 주소로 들어갈
 * 수 있다. 보통 앱과 웹에는 입구가 보이지 않는다. 화면이 뜰 때 한 번 읽는다.
 */
export const SANDBOX_ENTRY =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('test') === '1'

/**
 * 테스트판 (decisions.md 499번). 입구(SANDBOX_ENTRY)가 열려 있으면 코드 창이 뜨고, 닫아도 왼쪽의 "테스트판" 단추로 다시 연다. 테스트판 안에서는 그
 * 단추가 도구 창을 연다: 벽 건너뛰기, 처음부터 다시, 본 게임으로.
 */
export function IdleSandbox({ company }: { company: Company }) {
  const [open, setOpen] = useState(SANDBOX_ENTRY)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState(false)
  const [target, setTarget] = useState('')
  const [resetAsked, setResetAsked] = useState(false)
  const close = () => {
    setOpen(false)
    setCode('')
    setError(null)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true)
    const failed = await useRaisingStore.getState().enterSandbox(code.trim())
    setBusy(false)
    if (failed) setError(failed)
    else close()
  }
  const leave = async () => {
    if (busy) return
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
      {company.sandbox && (
        <button
          type="button"
          className="idle-sandbox"
          data-testid="idle-sandbox"
          onClick={() => setPanel(true)}
        >
          <b>테스트판</b>
          <small>도구</small>
        </button>
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
              {idle?.boss ? ' (큰손)' : ''} · 벽 체력{' '}
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
            <p className="idle-sandbox-note">
              자본·채용권·뽑기권은 쓸 때마다 다시 채워져요. 강화와 뽑기는 성장·고양이 메뉴에서
              그대로 해요.
            </p>
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
        <button
          type="button"
          className="idle-sandbox"
          data-testid="idle-sandbox-enter"
          onClick={() => setOpen(true)}
        >
          <b>테스트판</b>
          <small>들어가기</small>
        </button>
      )}
      {SANDBOX_ENTRY && open && !company.sandbox && (
        <div className="idle-sandbox-gate" role="dialog" aria-modal="true" aria-label="테스트판">
          <form onSubmit={submit}>
            <h2>테스트판</h2>
            <p className="idle-sandbox-note">
              자본과 뽑기권이 떨어지지 않는 연습용 회사예요. 본 게임은 그대로 남아요.
            </p>
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
            {error && (
              <p className="idle-sandbox-error" role="alert">
                {error}
              </p>
            )}
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
