import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type Company } from '../../api/client'
import { useRaisingStore } from './store'

vi.mock('../../api/client', () => ({ api: { POST: vi.fn() } }))

const before = { grade: 'F', seats: 4, year: 2, quarter: 4, employees: [] } as unknown as Company
const post = vi.mocked(api.POST)

beforeEach(() => {
  vi.resetAllMocks()
  useRaisingStore.setState({
    ...useRaisingStore.getInitialState(),
    company: before,
    status: 'ready',
  })
})

describe('서버에서 완료된 건물 확장 연출', () => {
  it('성공 응답의 실제 등급과 확장 이전 인원을 보관한다', async () => {
    post.mockResolvedValue({ data: { ...before, grade: 'E', seats: 6 } } as never)
    await useRaisingStore.getState().upgrade()
    expect(useRaisingStore.getState().upgradeMove).toEqual({
      before: 'F',
      after: 'E',
      year: 2,
      beforeSeats: 4,
    })
    expect(useRaisingStore.getState().company?.employees).toHaveLength(0)
  })

  it('공사 시작 응답은 완료 연출을 재생하지 않는다', async () => {
    post.mockResolvedValue({ data: { ...before, upgrade: { left: 2 } } } as never)
    await useRaisingStore.getState().upgrade()
    expect(useRaisingStore.getState().upgradeMove).toBeNull()
  })

  it('서버 거절과 통신 실패는 회사 규모를 바꾸지 않는다', async () => {
    post.mockResolvedValueOnce({ error: { message: '자본이 부족합니다.' } } as never)
    await useRaisingStore.getState().upgrade()
    expect(useRaisingStore.getState().error).toBe('자본이 부족합니다.')
    expect(useRaisingStore.getState().upgradeMove).toBeNull()
    post.mockRejectedValueOnce(new Error('offline'))
    await useRaisingStore.getState().upgrade()
    expect(useRaisingStore.getState().company).toBe(before)
    expect(useRaisingStore.getState().upgradeMove).toBeNull()
    expect(useRaisingStore.getState().busy).toBe(false)
    expect(useRaisingStore.getState().error).toContain('서버에 연결하지 못했어요')
  })

  it('연말 완공은 결산서를 먼저 보여주고 기존 수용 인원을 보관한다', async () => {
    post.mockResolvedValue({
      data: {
        ...before,
        grade: 'E',
        seats: 6,
        year: 3,
        quarter: 1,
        lastSettlement: { gradeBefore: 'F', gradeAfter: 'E' },
      },
    } as never)
    await useRaisingStore.getState().settle()
    expect(useRaisingStore.getState()).toMatchObject({
      justSettled: true,
      moveAlert: true,
      moveBeforeSeats: 4,
    })
  })
})
