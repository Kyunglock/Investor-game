import type { Company } from '@web/api/client'
import { ToyCityHome } from '../toy-city/ToyCityHome'

export function OfficeScene({ company, connected }: { company: Company; connected: boolean }) {
  return <ToyCityHome company={company} connected={connected} />
}
