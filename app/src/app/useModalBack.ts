import { useEffect, useEffectEvent } from 'react'
import { useAppUi } from './ui'

/** 맨 위 팝업이 Android 뒤로 가기를 소비하고, 닫힐 때 아래 화면의 처리를 복원한다. */
export function useModalBack(close: () => void, open = true) {
  const dismiss = useEffectEvent(close)
  useEffect(() => {
    if (!open) return
    const previous = useAppUi.getState().modalBack
    const handler = () => dismiss()
    useAppUi.getState().setModalBack(handler)
    return () => {
      if (useAppUi.getState().modalBack === handler) useAppUi.getState().setModalBack(previous)
    }
  }, [open])
}
