import type { Company } from '@web/api/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { needsFirstStage, readFirstPlay, saveFirstPlay } from './firstPlay'

const company = {
  companyId: 'first',
  status: 'ACTIVE',
  number: 1,
  year: 1,
  quarter: 1,
  lastQuarter: null,
  lastSettlement: null,
} as Company

afterEach(() => vi.unstubAllGlobals())

describe('첫 스테이지 진입', () => {
  it('새 회사는 시작하고, 이미 첫 스테이지를 깬 회사는 다시 시작하지 않는다', () => {
    expect(needsFirstStage(company)).toBe(true)
    expect(needsFirstStage({ ...company, assaults: { best: 1 } as Company['assaults'] })).toBe(
      false,
    )
  })
  it('진행 중이거나 끝난 회사는 첫 전투로 끌어오지 않는다', () => {
    expect(needsFirstStage({ ...company, quarter: 2 })).toBe(false)
    expect(needsFirstStage({ ...company, status: 'ENDED' })).toBe(false)
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
