import { expect, it } from 'vitest'
import { priceRise, queueWallGain, shownPrice } from './wallGain'

it('연속 돌파는 표시 중인 숫자를 바꾸지 않고 다음 연출에 합친다', () => {
  const first = { id: 1, amount: 320, start: 10000 }
  let queue = [first]
  for (let id = 2; id <= 10; id++) queue = queueWallGain(queue, { ...first, id })
  expect(queue).toHaveLength(2)
  expect(queue[0]).toBe(first)
  expect(queue[1].amount).toBe(2880)
  expect(shownPrice(13300, queue)).toBe(10100)
  expect(shownPrice(13300, queue.slice(1))).toBe(10420)
  expect(shownPrice(13300, [])).toBe(13300)
})

it('상승률은 종목 시작가 기준으로 0%에서 벽마다 10%씩 오른다', () => {
  for (const start of [10000, 52000]) {
    for (let walls = 0; walls <= 10; walls++) {
      expect(priceRise(start + (start / 10) * walls, start)).toBe(`${walls * 10}%`)
    }
  }
  expect(priceRise(12345, 10000)).toBe('23.5%')
  expect(priceRise(0, 0)).toBe('0%')
})

it('벽 상승 연출이 끝나면 주가 표시가 0%에서 10%, 20% 순서로 갱신된다', () => {
  const first = { id: 1, amount: 1000, start: 10000 }
  const queue = [first, { ...first, id: 2 }]
  expect(priceRise(shownPrice(12000, queue), 10000)).toBe('0%')
  expect(priceRise(shownPrice(12000, queue.slice(1)), 10000)).toBe('10%')
  expect(priceRise(shownPrice(12000, []), 10000)).toBe('20%')
})
