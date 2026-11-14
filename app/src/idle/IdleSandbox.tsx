import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { type FormEvent, useRef, useState } from 'react'

const TAPS = 7
const TAP_WINDOW_MS = 6000

/** 숨은 입구: 돌려받은 함수를 6초 안에 일곱 번 부르면 연다. */
export function useSandboxGate() {
  const [open, setOpen] = useState(false)
  const times = useRef<number[]>([])
  const tap = () => {
    const now = Date.now()
    times.current = [...times.current, now].filter((t) => now - t <= TAP_WINDOW_MS)
    if (times.current.length < TAPS) return
    times.current = []
    setOpen(true)
  }
  return { open, tap, close: () => setOpen(false) }
}

/**
 * 테스트 체험판 (decisions.md 499번). 입구는 숨겨 둔다: 벽 번호를 빠르게 일곱 번 누르면 코드 창이 뜬다(useSandboxGate). 체험판 안에서는 늘 표시와
 * 나가기 단추를 보인다.
 */
export function IdleSandbox({
  company,
  open,
  onClose,
}: {
  company: Company
  open: boolean
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const close = () => {
    onClose()
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
  }
  return (
    <>
      {company.sandbox && (
        <div className="idle-sandbox" data-testid="idle-sandbox" role="status">
          <b>체험판</b>
          <button type="button" onClick={leave} disabled={busy}>
            나가기
          </button>
        </div>
      )}
      {open && !company.sandbox && (
        <div
          className="idle-sandbox-gate"
          role="dialog"
          aria-modal="true"
          aria-label="테스트 체험판"
        >
          <form onSubmit={submit}>
            <h2>테스트 체험판</h2>
            <p className="idle-sandbox-note">
              자본과 뽑기권이 떨어지지 않는 연습용 회사예요. 본 게임은 그대로 남아요.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="코드"
              aria-label="체험판 코드"
              autoComplete="off"
              autoCapitalize="off"
              maxLength={100}
              // biome-ignore lint/a11y/noAutofocus: 코드 창은 숨은 동작으로만 열리고 입력 칸 하나뿐이다.
              autoFocus
            />
            {error && (
              <p className="idle-sandbox-error" role="alert">
                {error}
              </p>
            )}
            <div>
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
