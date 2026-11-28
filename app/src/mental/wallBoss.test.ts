import { expect, it } from 'vitest'
import { wallBoss } from './wallBoss'

it('50벽 고래 다음에 새 보스 열 마리가 그림판 순서로 등장하고 600벽에서 다시 시작한다', () => {
  expect(wallBoss(50)).toEqual({ name: '매도고래', tile: null })
  const bosses = Array.from({ length: 10 }, (_, index) => wallBoss(100 + index * 50))
  expect(bosses.map((boss) => boss?.tile)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  expect(new Set(bosses.map((boss) => boss?.name)).size).toBe(10)
  expect(wallBoss(450)?.name).toBe('동시호가코브라')
  expect(wallBoss(550)?.name).toBe('마감종코뿔소')
  expect(wallBoss(600)).toEqual(wallBoss(50))
  expect(wallBoss(650)).toEqual(wallBoss(100))
  expect(wallBoss(99)).toBeNull()
})
