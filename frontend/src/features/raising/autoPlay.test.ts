import { describe, expect, it } from 'vitest'
import type { Company } from '../../api/client'
import { autoChoice, autoHire, autoStance, nextAutoStep } from './autoPlay'

function desk(code: string, statCode: string, trades = true) {
  return { code, name: code, statCode, trades, sector: null, hot: false, description: '' }
}

const grades = (v: string) => ({ insight: v, patience: v, courage: v, conviction: v, luck: v })

function company(over: Partial<Company> = {}): Company {
  return {
    status: 'ACTIVE',
    capital: 100_000_000,
    seats: 2,
    desks: [desk('bio', 'patience'), desk('day', 'courage'), desk('research', 'insight', false)],
    employees: [],
    applicants: [],
    meeting: { wanted: '' },
    invest: null,
    ...over,
  } as unknown as Company
}

const remark = (read: 'UP' | 'DOWN' | 'NEUTRAL') => ({ read })

describe('자동 진행 (decisions.md 245번)', () => {
  it('투자 회의는 직원 다수결, 같으면 지켜본다', () => {
    const invest = (reads: ('UP' | 'DOWN' | 'NEUTRAL')[]) =>
      ({ remarks: reads.map(remark) }) as unknown as NonNullable<Company['invest']>
    expect(autoChoice(invest(['UP', 'UP', 'DOWN']))).toBe('BUY')
    expect(autoChoice(invest(['DOWN', 'NEUTRAL']))).toBe('SELL')
    expect(autoChoice(invest(['UP', 'DOWN', 'NEUTRAL']))).toBe('HOLD')
  })

  it('거시경제 회의는 직원 다수결: 공격하자가 많으면 공격, 지키자가 많으면 방어, 같으면 중립 (266번)', () => {
    const macro = (reads: ('UP' | 'DOWN' | 'NEUTRAL')[]) =>
      ({ remarks: reads.map(remark) }) as unknown as NonNullable<Company['macro']>
    expect(autoStance(macro(['UP', 'UP', 'DOWN']))).toBe('AGGRESSIVE')
    expect(autoStance(macro(['DOWN', 'NEUTRAL']))).toBe('DEFENSIVE')
    expect(autoStance(macro(['UP', 'DOWN']))).toBe('NEUTRAL')
  })

  it('빈 자리에는 계약금이 자본의 25% 이하인 사람 가운데 종합 등급이 가장 높은 사람을 뽑는다', () => {
    const applicants = [
      { id: 1, overallGrade: 'C', fee: 10_000_000 },
      { id: 2, overallGrade: 'A', fee: 25_000_000 },
      { id: 3, overallGrade: 'S', fee: 40_000_000 },
    ]
    expect(autoHire(company({ applicants } as never))).toBe(2)
    const full = company({
      applicants,
      employees: [{ id: 9 }, { id: 8 }],
    } as never)
    expect(autoHire(full)).toBeNull()
  })

  it('한 해를 결산서 닫기 → 공채 → 배치 → 투자 회의 → 결산 순으로 돈다', () => {
    expect(nextAutoStep(company({ status: 'ENDED' }), false).kind).toBe('stop')
    expect(nextAutoStep(company({ broke: '금고가 비었다.' }), false).kind).toBe('stop')
    expect(nextAutoStep(company(), true).kind).toBe('closeYearEnd')
    // 분기 실적은 짧게 보여 주고 닫는다 (268번).
    expect(nextAutoStep(company(), false, true).kind).toBe('closeQuarter')
    // 이직 제안 (262·265번): 자동 진행은 직원을 보내지 않고 늘 남긴다.
    const poached = company({ meeting: { wanted: '', poach: { transferFee: 1 } } } as never)
    expect(nextAutoStep(poached, false)).toEqual({ kind: 'poach', keep: true })
    const hiring = company({ applicants: [{ id: 1, overallGrade: 'C', fee: 1 }] } as never)
    expect(nextAutoStep(hiring, false)).toEqual({ kind: 'hire', applicantId: 1 })
    const resting = company({
      employees: [{ id: 1, grades: grades('B'), desk: null }],
    } as never)
    expect(nextAutoStep(resting, false).kind).toBe('place')
    const seated = company({
      employees: [{ id: 1, grades: grades('B'), desk: 'bio' }],
      invest: { ready: true, convened: true, remarks: [remark('DOWN')] },
    } as never)
    expect(nextAutoStep(seated, false)).toEqual({ kind: 'invest', choice: 'SELL', big: false })
    // 둘 이상이 모두 같은 쪽이면 크게 한다 (260번).
    const agreed = {
      ...seated,
      invest: { ready: true, convened: true, remarks: [remark('UP'), remark('UP')] },
    }
    expect(nextAutoStep(agreed as never, false)).toEqual({
      kind: 'invest',
      choice: 'BUY',
      big: true,
    })
    // 한마디는 회의를 열어야 나온다 (249번): 열지 않았으면 먼저 연다.
    const closed = { ...seated, invest: { ...seated.invest, convened: false, remarks: [] } }
    expect(nextAutoStep(closed as never, false).kind).toBe('convene')
    expect(nextAutoStep({ ...seated, invest: null }, false).kind).toBe('settle')
    // 거시경제 회의가 종목 회의보다 먼저다 (266·267번): 열고, 다수결로 고른다.
    const macro = { ready: true, convened: false, remarks: [] }
    expect(nextAutoStep({ ...seated, macro } as never, false).kind).toBe('conveneMacro')
    const opened = { ...macro, convened: true, remarks: [remark('UP')] }
    expect(nextAutoStep({ ...seated, macro: opened } as never, false)).toEqual({
      kind: 'macro',
      stance: 'AGGRESSIVE',
    })
    const decided = { ...opened, ready: false }
    expect(nextAutoStep({ ...seated, macro: decided } as never, false).kind).toBe('invest')
  })
})
