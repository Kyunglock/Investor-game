import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { firstTab, tabBadge, tabFromWeb, useAppUi } from './ui'

function company(over: Partial<Company> = {}): Company {
  return {
    status: 'ACTIVE',
    seats: 4,
    employees: [],
    gacha: { tickets: 0 },
    meeting: { wanted: '' },
    ...over,
  } as unknown as Company
}

describe('앱 탭 (decisions.md 309번)', () => {
  it('뒤로 가기는 시트 → 사무실 → 끝 순으로 되돌아간다', () => {
    const ui = useAppUi.getState()
    ui.setTab('staff')
    ui.openSheet({ kind: 'desk', desk: 'bio' })
    expect(useAppUi.getState().back()).toBe(true)
    expect(useAppUi.getState().sheet).toBeNull()
    expect(useAppUi.getState().tab).toBe('staff')
    expect(useAppUi.getState().back()).toBe(true)
    expect(useAppUi.getState().tab).toBe('office')
    expect(useAppUi.getState().back()).toBe(false)
  })

  it('탭을 바꾸면 열린 시트는 닫힌다', () => {
    useAppUi.getState().openSheet({ kind: 'desk', desk: 'day' })
    useAppUi.getState().setTab('market')
    expect(useAppUi.getState().sheet).toBeNull()
  })

  it('웹의 탭 이름을 앱 탭으로 옮긴다', () => {
    expect(tabFromWeb('meeting')).toBe('issue')
    expect(tabFromWeb('settlement')).toBe('record')
    expect(tabFromWeb('market')).toBe('market')
    expect(tabFromWeb(null)).toBeNull()
  })

  it('탭의 표: 이슈 !, 채용권 수, 배치 앉힌 수', () => {
    const c = company({
      gacha: { tickets: 2 } as never,
      employees: [
        { id: 1, desk: 'bio' },
        { id: 2, desk: null },
      ] as never,
      meeting: { wanted: '', omen: '조짐' } as never,
    })
    expect(tabBadge(c, 'issue')).toBe('!')
    expect(tabBadge(c, 'market')).toBe('2')
    expect(tabBadge(c, 'staff')).toBe('1/4')
    expect(tabBadge(c, 'office')).toBeNull()
    expect(tabBadge(company(), 'issue')).toBeNull()
  })

  it('직원이 없으면 채용부터, 있으면 사무실부터', () => {
    expect(firstTab(company())).toBe('market')
    expect(firstTab(company({ employees: [{ id: 1 }] as never }))).toBe('office')
    expect(firstTab(company({ status: 'ENDED' }))).toBe('office')
  })
})
