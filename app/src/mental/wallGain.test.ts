import { expect, it } from 'vitest'
import { queueWallGain, shownPrice } from './wallGain'

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
