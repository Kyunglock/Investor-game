import { useEffect, useEffectEvent, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalBack } from '../app/useModalBack'
import { sfx } from '../fx/sound'
import aurora from './assets/portrait-aurora.webp'
import './sovereign-arrival.css'

export function SovereignArrival({ onFinish }: { onFinish: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const finish = useEffectEvent(onFinish)
  useModalBack(() => {})
  useEffect(() => {
    const el = dialog.current
    el?.showModal()
    const music = window.setTimeout(() => sfx.fanfare(), 1150)
    const timer = window.setTimeout(() => finish(), 5000)
    return () => {
      clearTimeout(timer)
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
        <div className="sovereign-rays" aria-hidden="true" />
        <img src={aurora} alt="오로라 왕관을 쓴 극광냥" />
        <div className="sovereign-halo" aria-hidden="true" />
        <div className="sovereign-title">
          <b>SS</b>
          <h2>극광냥</h2>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
