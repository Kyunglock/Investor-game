import type { Company } from '@web/api/client'
import { useTutorial } from '@web/features/raising/tutorial'
import { useEffect } from 'react'

/** Main battle starts automatically. Legacy tutorial must not launch a stage. */
export function TutorialGuide({ company }: { company: Company }) {
  useEffect(() => {
    if (company.companyId) useTutorial.getState().finish()
  }, [company.companyId])
  return null
}
