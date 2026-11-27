import { expect, it } from 'vitest'
import { WallFlight } from './wallFlight'

it('실제 1초에 열 벽에서 이륙하고 느려지면 착지한다', () => {
  const flight = new WallFlight()
  for (let i = 0; i < 10; i++) flight.update(40 + i, i * 100, true)
  expect(flight.strength).toBe(0)
  flight.update(50, 1000, true)
  expect(flight.strength).toBeGreaterThan(0)
  for (let now = 1100; now <= 3000; now += 100) flight.update(50, now, true)
  expect(flight.strength).toBe(0)
})

it('묶음 돌파를 세고 환생·백그라운드 복귀·모션 줄이기에서는 초기화한다', () => {
  const flight = new WallFlight()
  flight.update(40, 0, true)
  flight.update(52, 100, true)
  expect(flight.strength).toBeGreaterThan(0)
  flight.update(1, 110, true)
  expect(flight.strength).toBe(0)
  flight.update(80, 5000, true)
  expect(flight.strength).toBe(0)
  flight.update(100, 5100, false)
  expect(flight.strength).toBe(0)
})
