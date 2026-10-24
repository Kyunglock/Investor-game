import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../../api/client'
import { crisisOf, noticesOf, worldText } from './notices'

const entry = (seq: number, kind: LogEntry['kind'], payload: Record<string, unknown> = {}) =>
  ({ seq, day: seq * 30, kind, payload }) as LogEntry

describe('noticesOf', () => {
  it('생활 알림과 전조·기사만 토스트로, 매매·위기 회고는 빼고, 기록 순서대로', () => {
    const picked = noticesOf([
      entry(1, 'LIFE'),
      entry(2, 'OMEN'),
      entry(3, 'ARTICLE'),
      entry(4, 'TRADE'),
      entry(5, 'HOME_SOLD'),
      entry(6, 'CRISIS'),
    ])
    expect(picked.map((e) => e.seq)).toEqual([1, 2, 3, 5])
  })

  it('위기 회고는 토스트가 아니라 alert 카드로, 여러 개면 마지막 것', () => {
    expect(crisisOf([entry(1, 'LIFE')])).toBeNull()
    expect(crisisOf([entry(1, 'CRISIS'), entry(2, 'TRADE'), entry(3, 'CRISIS')])?.seq).toBe(3)
  })
})

describe('worldText', () => {
  it('전조와 기사는 들린 대로만, 같은 모양으로', () => {
    expect(worldText(entry(1, 'OMEN', { text: '재고가 쌓인다는 말' }))).toBe('재고가 쌓인다는 말')
    expect(worldText(entry(2, 'ARTICLE', { text: '재고가 쌓인다는 말' }))).toBe(
      '재고가 쌓인다는 말',
    )
  })

  it('위기 회고에는 이름이 붙는다', () => {
    expect(worldText(entry(1, 'CRISIS', { name: '반도체 겨울', severity: 'DEPRESSION' }))).toBe(
      '돌아보니 그때는 반도체 겨울 — 대공황이었다',
    )
  })
})
