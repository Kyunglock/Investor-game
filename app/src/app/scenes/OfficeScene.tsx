import type { Company } from '@web/api/client'
import { ToyCityHome } from '../toy-city/ToyCityHome'

export function OfficeScene({ company }: { company: Company }) {
  return <ToyCityHome company={company} />
}
