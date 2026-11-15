import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type Company } from '../../api/client'
import { useRaisingStore } from './store'

vi.mock('../../api/client', () => ({ api: { POST: vi.fn() } }))

const before = { grade: 'F', seats: 4, employees: [] } as unknown as Company
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
      beforeSeats: 4,
    })
    expect(useRaisingStore.getState().company?.employees).toHaveLength(0)
  })

  it('등급이 그대로인 응답은 완료 연출을 재생하지 않는다', async () => {
    post.mockResolvedValue({ data: { ...before, capital: 10 } } as never)
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
})

describe('종목회의 열기 (#803)', () => {
  const meeting = (over: object = {}) => ({ convened: true, outcome: null, ...over })

  it('기회를 써서 새 회의가 열리면 true', async () => {
    post.mockResolvedValue({ data: { ...before, invest: meeting() } } as never)
    expect(await useRaisingStore.getState().convene()).toBe(true)
    expect(post).toHaveBeenCalledWith('/api/company/invest/open')
  })

  it('정하지 않은 회의가 이미 열려 있으면 서버를 부르지 않는다', async () => {
    useRaisingStore.setState({ company: { ...before, invest: meeting() } as never })
    expect(await useRaisingStore.getState().convene()).toBe(true)
    expect(post).not.toHaveBeenCalled()
  })

  it('이미 정한 회의만 남아 있으면 새 회의를 연다', async () => {
    const decided = { ...before, invest: meeting({ outcome: { total: 5 } }) }
    useRaisingStore.setState({ company: decided as never })
    post.mockResolvedValue({ data: { ...before, invest: meeting() } } as never)
    expect(await useRaisingStore.getState().convene()).toBe(true)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('기회가 없어 거절되면 false이고 이유가 남는다', async () => {
    const decided = { ...before, invest: meeting({ outcome: { total: 5 } }) }
    useRaisingStore.setState({ company: decided as never })
    post.mockResolvedValue({ error: { message: '종목회의 기회가 없습니다.' } } as never)
    expect(await useRaisingStore.getState().convene()).toBe(false)
    expect(useRaisingStore.getState().error).toBe('종목회의 기회가 없습니다.')
  })
})
