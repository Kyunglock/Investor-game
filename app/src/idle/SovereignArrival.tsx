import { useEffect, useEffectEvent, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useModalBack } from '../app/useModalBack'
import { sfx } from '../fx/sound'
import leap from './assets/aurora-leap.webp'
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
        <div className="sovereign-flight">
          <img src={leap} alt="오로라 위로 뛰어올라 오른쪽 앞발로 별빛을 건드리는 극광냥" />
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
