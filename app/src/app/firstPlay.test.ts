import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { firstQuarter, prepareFirstPlay } from './firstPlay'

vi.mock('@web/features/raising/placement', () => ({
  autoPlace: (c: Company) => c.employees.map((e) => ({ employeeId: e.id, desk: 'trade' })),
}))

const original = useRaisingStore.getState()
const current = () => useRaisingStore.getState().company as Company
const change = (patch: Partial<Company>) =>
  useRaisingStore.setState({ company: { ...current(), ...patch } })
const draw = vi.fn(async () => {
  change({ employees: [{ id: 1, desk: null }] as Company['employees'] })
  useRaisingStore.setState({ justDrew: true })
})
const place = vi.fn(async () => {
  change({ employees: [{ id: 1, desk: 'trade' }] as Company['employees'] })
})
const scout = vi.fn(async () => {
  change({ invest: { ...current().invest, ready: true } as Company['invest'] })
  return true
})

beforeEach(() => {
  vi.clearAllMocks()
  useRaisingStore.setState({
    company: {
      companyId: 'first',
      status: 'ACTIVE',
      number: 1,
      year: 1,
      quarter: 1,
      lastQuarter: null,
      lastSettlement: null,
      employees: [],
      desks: [{ code: 'trade', trades: true }],
      invest: { ready: false, outcome: null },
    } as unknown as Company,
    error: null,
    busy: false,
    justDrew: false,
    draw,
    place,
    scout,
  })
})
afterEach(() => useRaisingStore.setState(original))

describe('첫 판 준비', () => {
  it('동시에 호출해도 채용·배치·종목 준비는 한 번만 한다', async () => {
    await Promise.all([prepareFirstPlay(current()), prepareFirstPlay(current())])
    await prepareFirstPlay(current())
    expect(draw).toHaveBeenCalledTimes(1)
    expect(place).toHaveBeenCalledTimes(1)
    expect(scout).toHaveBeenCalledTimes(1)
    expect(useRaisingStore.getState().justDrew).toBe(false)
  })
  it('배치 실패 뒤 재시도해도 동료를 중복 채용하지 않는다', async () => {
    place.mockImplementationOnce(async () => {
      useRaisingStore.setState({ error: '연결 실패' })
    })
    await expect(prepareFirstPlay(current())).rejects.toThrow('연결 실패')
    await prepareFirstPlay(current())
    expect(draw).toHaveBeenCalledTimes(1)
    expect(place).toHaveBeenCalledTimes(2)
    expect(scout).toHaveBeenCalledTimes(1)
  })
  it('첫 분기를 지난 회사와 이미 결정한 회의에는 준비 작업을 하지 않는다', async () => {
    change({ quarter: 2 })
    expect(firstQuarter(current())).toBe(false)
    await expect(prepareFirstPlay(current())).rejects.toThrow('회사 상태')
    change({ quarter: 1, invest: { outcome: {} } as Company['invest'] })
    await prepareFirstPlay(current())
    expect(draw).not.toHaveBeenCalled()
    expect(place).not.toHaveBeenCalled()
    expect(scout).not.toHaveBeenCalled()
  })
})
