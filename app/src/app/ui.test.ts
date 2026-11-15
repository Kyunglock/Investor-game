import type { Company } from '@web/api/client'
import { describe, expect, it } from 'vitest'
import { firstTab, stageBadge, stageDiamonds, tabBadge, tabFromWeb, useAppUi } from './ui'

function company(over: Partial<Company> = {}): Company {
  return {
    seats: 4,
    employees: [],
    desks: [{ code: 'bio', trades: true }],
    diamonds: { amount: 0, draw: 100, tenDraw: 1000, tenCount: 11, hire: 100 },
    gacha: {},
    meetings: { chances: 0, max: 3, nextSeconds: 60 },
    invest: null,
    ...over,
  } as unknown as Company
}

describe('앱 탭 (decisions.md 309번)', () => {
  it('전투 중 뒤로 가기는 앱을 내리지 않고 전투의 일시정지를 먼저 연다', () => {
    let paused = false
    useAppUi.getState().setTab('office')
    useAppUi.getState().setModalBack(() => {
      paused = true
    })
    expect(useAppUi.getState().back()).toBe(true)
    expect(paused).toBe(true)
    useAppUi.getState().setModalBack(null)
    expect(useAppUi.getState().back()).toBe(false)
  })

  it('안드로이드 뒤로 가기로 메인의 설정·확장 시트도 닫힌다', () => {
    useAppUi.getState().setTab('office')
    useAppUi.getState().openSheet({ kind: 'toy', panel: 'upgrade' })
    expect(useAppUi.getState().back()).toBe(true)
    expect(useAppUi.getState().sheet).toBeNull()
    expect(useAppUi.getState().tab).toBe('office')
  })

  it('뒤로 가기는 시트 → 사무실 → 끝 순으로 되돌아간다', () => {
    const ui = useAppUi.getState()
    ui.setTab('market')
    ui.openSheet({ kind: 'employee', id: 1 })
    expect(useAppUi.getState().back()).toBe(true)
    expect(useAppUi.getState().sheet).toBeNull()
    expect(useAppUi.getState().tab).toBe('market')
    expect(useAppUi.getState().back()).toBe(true)
    expect(useAppUi.getState().tab).toBe('office')
    expect(useAppUi.getState().back()).toBe(false)
  })

  it('탭을 바꾸면 열린 시트는 닫힌다', () => {
    useAppUi.getState().openSheet({ kind: 'employee', id: 1 })
    useAppUi.getState().setTab('issue')
    expect(useAppUi.getState().sheet).toBeNull()
  })

  it('웹의 탭 이름을 앱 탭으로 옮긴다', () => {
    expect(tabFromWeb('meeting')).toBe('issue')
    expect(tabFromWeb('settlement')).toBeNull()
    expect(tabFromWeb('market')).toBe('market')
    expect(tabFromWeb(null)).toBeNull()
    // 없어진 배치 탭을 가리키는 옛 링크는 사무실로 간다 (#801).
    expect(tabFromWeb('staff')).toBe('office')
  })

  it('탭의 표: 이슈 !, 채용은 다이아와 남은 자리로 데려올 수 있는 수', () => {
    const diamonds = (amount: number) => ({ ...company().diamonds, amount })
    // 다이아가 넉넉해도 남은 자리(4 − 2)까지만, 자리가 남아도 다이아가 닿는 데까지만 센다.
    expect(tabBadge(company({ diamonds: diamonds(150) }), 'market')).toBe('1')
    expect(tabBadge(company({ diamonds: diamonds(99) }), 'market')).toBeNull()
    expect(
      tabBadge(
        company({ diamonds: diamonds(1000), employees: [{}, {}, {}, {}] as never }),
        'market',
      ),
    ).toBeNull()
    const c = company({
      diamonds: diamonds(1000),
      employees: [
        { id: 1, desk: 'bio' },
        { id: 2, desk: 'bio' },
      ] as never,
      meetings: { chances: 1, max: 3, nextSeconds: 60 },
    })
    expect(tabBadge(c, 'issue')).toBe('!')
    expect(tabBadge(c, 'market')).toBe('2')
    expect(tabBadge(c, 'office')).toBeNull()
    expect(tabBadge(company(), 'issue')).toBeNull()
  })

  it('멘탈 보호 입구의 표는 오늘 EX 디펜스가 남았을 때만 (527번)', () => {
    const stages = (exAvailable: boolean) =>
      ({ exAvailable, exDiamonds: 300, diamondsLeft: [100, 100] }) as never
    expect(stageBadge(company())).toBeNull()
    expect(stageBadge(company({ stages: stages(true) }))).toBe('!')
    // 번호 스테이지에 다이아가 남아 있어도 EX를 마쳤으면 달지 않는다.
    expect(stageBadge(company({ stages: stages(false) }))).toBeNull()
  })

  it('스테이지마다 남은 다이아: 다 받았거나 값이 없으면 0 (527번)', () => {
    const c = company({ stages: { diamondsLeft: [0, 40, 100] } as never })
    expect(stageDiamonds(c, 1)).toBe(0)
    expect(stageDiamonds(c, 2)).toBe(40)
    expect(stageDiamonds(c, 3)).toBe(100)
    expect(stageDiamonds(c, 4)).toBe(0)
    expect(stageDiamonds(company(), 1)).toBe(0)
  })

  it('처음 들어오면 직원 유무와 관계없이 사무실부터', () => {
    expect(firstTab(company())).toBe('office')
    expect(firstTab(company({ employees: [{ id: 1 }] as never }))).toBe('office')
  })
})
