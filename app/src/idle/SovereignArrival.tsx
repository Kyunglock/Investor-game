import { useEffect, useEffectEvent, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalBack } from '../app/useModalBack'
import { sfx } from '../fx/sound'
import face from './assets/aurora-face.webp'
import './sovereign-arrival.css'

export function SovereignArrival({ onFinish }: { onFinish: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const finish = useEffectEvent(onFinish)
  useModalBack(() => {})
  useEffect(() => {
    const el = dialog.current
    el?.showModal()
    const charge = window.setTimeout(() => sfx.charge(), 1490)
    const music = window.setTimeout(() => sfx.fanfare(), 2150)
    const timer = window.setTimeout(() => finish(), 5000)
    return () => {
      clearTimeout(timer)
      clearTimeout(charge)
      clearTimeout(music)
      el?.close()
    }
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      className="sovereign-arrival"
      aria-label="SS 극광냥 등장"
      onCancel={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      <div className="sovereign-sky">
        <div className="sovereign-lake" aria-hidden="true" />
        <div className="sovereign-comet" aria-hidden="true" />
        <div className="sovereign-face">
          <img src={face} alt="오른쪽을 바라보는 극광냥의 얼굴과 이마에서 빛나는 금별" />
          <div className="sovereign-impact" aria-hidden="true">
            <i />
          </div>
        </div>
        <div className="sovereign-title">
          <b>SS</b>
          <h2>극광냥</h2>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
