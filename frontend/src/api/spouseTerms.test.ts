import { describe, expect, it } from 'vitest'
import { deepSpouseTerms, sexOfResponse, withSpouseTerms } from './spouseTerms'

describe('withSpouseTerms', () => {
  it('남자면 아내, 여자면 남편으로 부르고 조사를 맞춘다', () => {
    expect(withSpouseTerms('배우자가 밥상을 차렸다', 'M')).toBe('아내가 밥상을 차렸다')
    expect(withSpouseTerms('배우자가 밥상을 차렸다', 'F')).toBe('남편이 밥상을 차렸다')
    expect(withSpouseTerms('배우자는 울었다. 배우자와 이야기했다', 'F')).toBe(
      '남편은 울었다. 남편과 이야기했다',
    )
    expect(withSpouseTerms('배우자의 형제 · 배우자 쪽 부모님', 'M')).toBe(
      '아내의 형제 · 아내 쪽 부모님',
    )
  })

  it('이(가) 같은 겸용 조사도 하나로 맞춘다', () => {
    expect(withSpouseTerms('배우자이(가) 여행을 가자고 한다', 'M')).toBe(
      '아내가 여행을 가자고 한다',
    )
    expect(withSpouseTerms('배우자이(가) 여행을 가자고 한다', 'F')).toBe(
      '남편이 여행을 가자고 한다',
    )
  })

  it('배우자 쪽 집안은 남자면 처가, 여자면 시가', () => {
    expect(withSpouseTerms('처가(시가)는 마음만', 'M')).toBe('처가는 마음만')
    expect(withSpouseTerms('처가(시가)는 마음만', 'F')).toBe('시가는 마음만')
    expect(withSpouseTerms('처가에 50만', 'F')).toBe('시가에 50만')
  })

  it('상관없는 글은 그대로', () => {
    expect(withSpouseTerms('신도시가 들어선다', 'F')).toBe('신도시가 들어선다')
  })
})

describe('deepSpouseTerms', () => {
  it('선택 결과의 game.sex로 안쪽 문자열을 모두 바꾼다', () => {
    const body = {
      game: { sex: 'F', log: [{ text: '배우자가 웃었다' }] },
      outcome: { text: '배우자를 봤다' },
    }
    const sex = sexOfResponse(body)
    expect(sex).toBe('F')
    expect(deepSpouseTerms(body, sex ?? 'M')).toEqual({
      game: { sex: 'F', log: [{ text: '남편이 웃었다' }] },
      outcome: { text: '남편을 봤다' },
    })
  })

  it('성별이 없는 응답은 건드리지 않는다', () => {
    expect(sexOfResponse({ plays: [] })).toBeNull()
  })
})
