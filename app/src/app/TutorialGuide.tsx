import type { Company } from '@web/api/client'
import { useTutorial } from '@web/features/raising/tutorial'
import { useEffect, useRef } from 'react'
import { needsFirstStage, saveFirstPlay } from './firstPlay'
import { useAppUi } from './ui'

/** 설명 카드 없이 첫 스테이지로 진입한다. 재렌더·StrictMode에서도 한 번만 시작한다. */
export function TutorialGuide({ company }: { company: Company }) {
  const active = useTutorial((s) => s.active)
  const launched = useRef(false)
  useEffect(() => {
    if (!active || launched.current || useAppUi.getState().battle) return
    if (!needsFirstStage(company)) {
      useTutorial.getState().finish()
      return
    }
    launched.current = true
    saveFirstPlay(company, 'play')
    useAppUi.getState().setTab('office')
    useAppUi.getState().startBattle({ kind: 'assault', stage: 1, tutorial: true })
  }, [active, company])
  return null
}
