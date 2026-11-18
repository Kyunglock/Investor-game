import { useEffect, useRef, useState } from 'react'
import { HapticIcon, SoundIcon } from '../app/Icons'
import { haptic, isHapticOff, setHapticOff } from '../fx/haptics'
import { isMuted, setMuted, sfx } from '../fx/sound'
import { usePowerSave } from './powerSave'

/**
 * 설정 (decisions.md 522번): 메인 화면은 매도벽 돌파 화면이라 옵션은 여기에 둔다. 톱니 단추를 누르면 소리·진동을 켜고 끄는 작은 창이 열린다.
 * 값은 열 때마다 저장된 것을 읽는다(다른 화면의 소리 단추로 바꿨을 수 있다).
 */
export function IdleOptions() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div className="idle-options" ref={box}>
      <button
        type="button"
        className="idle-options-open"
        aria-label="설정"
        aria-expanded={open}
        data-testid="idle-options"
        onClick={() => setOpen(!open)}
      >
        <GearIcon />
      </button>
      {open && <Panel />}
    </div>
  )
}

function Panel() {
  const [muted, setMutedState] = useState(isMuted)
  const [hapticOff, setHapticOffState] = useState(isHapticOff)
  return (
    <div className="idle-options-panel">
      <button
        type="button"
        className={`idle-options-toggle ${muted ? 'idle-options-off' : ''}`}
        aria-pressed={muted}
        aria-label={muted ? '소리 켜기' : '소리 끄기'}
        data-testid="sound-toggle"
        onClick={() => {
          setMuted(!muted)
          setMutedState(!muted)
          if (muted) sfx.tap()
        }}
      >
        <SoundIcon off={muted} />
        <span>소리</span>
        <b className="idle-options-state">{muted ? '꺼짐' : '켜짐'}</b>
      </button>
      <button
        type="button"
        className={`idle-options-toggle ${hapticOff ? 'idle-options-off' : ''}`}
        aria-pressed={hapticOff}
        aria-label={hapticOff ? '진동 켜기' : '진동 끄기'}
        data-testid="haptic-toggle"
        onClick={() => {
          setHapticOff(!hapticOff)
          setHapticOffState(!hapticOff)
          // 켰음을 짧게 한 번 알려 준다.
          if (hapticOff) haptic.medium()
        }}
      >
        <HapticIcon off={hapticOff} />
        <span>진동</span>
        <b className="idle-options-state">{hapticOff ? '꺼짐' : '켜짐'}</b>
      </button>
      {/*
        절전 모드 (607번): 화면을 검게 덮고 전투만 돌린다. 화면을 두 번 누르면 풀린다. 켜면 이 창이 덮이므로 여기서는 늘 꺼진 상태다: 소리·진동처럼
        상태("꺼짐")를 적는다 (#920).
      */}
      <button
        type="button"
        className="idle-options-toggle idle-options-off"
        aria-pressed={false}
        aria-label="절전 모드 켜기"
        data-testid="power-save-on"
        onClick={() => usePowerSave.getState().set(true)}
      >
        <MoonIcon />
        <span>절전 모드</span>
        <b className="idle-options-state">꺼짐</b>
      </button>
    </div>
  )
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
