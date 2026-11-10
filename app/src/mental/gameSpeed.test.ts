import { expect, it } from 'vitest'
import { BASE_SIM_SCALE, GAME_SPEEDS, nextGameSpeed, simScale } from './gameSpeed'

it('1배는 예전 빠르기의 절반이고 2배가 예전 빠르기다', () => {
  expect(BASE_SIM_SCALE).toBe(0.5)
  expect(simScale(1)).toBe(0.5)
  expect(simScale(2)).toBe(1)
})

it('배속은 1 → 1.5 → 2 → 1 로 돈다', () => {
  expect(GAME_SPEEDS.map(nextGameSpeed)).toEqual([1.5, 2, 1])
})
