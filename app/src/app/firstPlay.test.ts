import type { Company } from '@web/api/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { firstMeeting, needsFirstStage, readFirstPlay, saveFirstPlay } from './firstPlay'

const company = {
  companyId: 'first',
  number: 1,
  invest: null,
} as Company
const pending = { convened: true, outcome: null } as Company['invest']
const decided = { convened: true, outcome: { total: 0 } } as Company['invest']

afterEach(() => vi.unstubAllGlobals())

describe('첫 스테이지 진입', () => {
  it('새 회사는 시작하고, 이미 첫 스테이지를 깬 회사는 다시 시작하지 않는다', () => {
    expect(needsFirstStage(company)).toBe(true)
    expect(needsFirstStage({ ...company, assaults: { best: 1 } as Company['assaults'] })).toBe(
      false,
    )
  })
  it('첫 판은 첫 회사에서 첫 종목회의를 정하기 전까지다', () => {
    expect(firstMeeting(company)).toBe(true)
    expect(firstMeeting({ ...company, invest: pending })).toBe(true)
    expect(firstMeeting({ ...company, invest: decided })).toBe(false)
    expect(firstMeeting({ ...company, number: 2 })).toBe(false)
  })
  it('첫 회의를 이미 정했거나 다음 회사면 첫 전투로 끌어오지 않는다', () => {
    expect(needsFirstStage({ ...company, invest: pending })).toBe(true)
    expect(needsFirstStage({ ...company, invest: decided })).toBe(false)
    expect(needsFirstStage({ ...company, number: 2 })).toBe(false)
  })
  it('저장한 걸음이 없으면 회의를 정했는지로 어디까지 왔는지 본다', () => {
    expect(readFirstPlay(company)).toBe('welcome')
    expect(readFirstPlay({ ...company, invest: decided })).toBe('play')
  })
  it('예전 설명 중간 저장과 중단한 전투는 첫 스테이지로 이어간다', () => {
    const getItem = vi.fn(() => 'welcome')
    vi.stubGlobal('localStorage', { getItem })
    for (const step of ['welcome', 'team', 'ready', 'play']) {
      getItem.mockReturnValue(step)
      expect(needsFirstStage(company)).toBe(true)
    }
    getItem.mockReturnValue('done')
    expect(needsFirstStage(company)).toBe(false)
  })
  it('완료 기록은 회사별로 저장한다', () => {
    const records = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => records.get(key),
      setItem: (key: string, value: string) => records.set(key, value),
    })
    saveFirstPlay(company, 'done')
    expect(readFirstPlay(company)).toBe('done')
    expect(needsFirstStage({ ...company, companyId: 'other' })).toBe(true)
  })
  it('저장소가 차단되어도 첫 전투 진입을 막지 않는다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(needsFirstStage(company)).toBe(true)
    expect(() => saveFirstPlay(company, 'done')).not.toThrow()
  })
})
