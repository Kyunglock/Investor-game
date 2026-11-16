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

describe('출석 보상 (528번)', () => {
  const attendance = (claimable: boolean) => ({
    today: 1,
    claimable,
    board: [],
    lastReward: claimable ? null : { day: 1, diamonds: 50, money: 0 },
  })

  it('받으면 받은 회사를 돌려주고 busy를 켜지 않는다', async () => {
    const after = { ...before, attendance: attendance(false) }
    post.mockResolvedValue({ data: after } as never)
    const result = await useRaisingStore.getState().claimAttendance()
    expect(post).toHaveBeenCalledWith('/api/company/attendance')
    expect(result?.attendance.lastReward).toEqual({ day: 1, diamonds: 50, money: 0 })
    expect(useRaisingStore.getState().company).toBe(after)
    expect(useRaisingStore.getState().busy).toBe(false)
  })

  it('오늘 이미 받았거나 끊기면 null이고 회사는 그대로다', async () => {
    post.mockResolvedValueOnce({ error: { message: '오늘은 이미 받았어요.' } } as never)
    expect(await useRaisingStore.getState().claimAttendance()).toBeNull()
    expect(useRaisingStore.getState().error).toBe('오늘은 이미 받았어요.')
    expect(useRaisingStore.getState().company).toBe(before)
    post.mockRejectedValueOnce(new Error('offline'))
    expect(await useRaisingStore.getState().claimAttendance()).toBeNull()
    expect(useRaisingStore.getState().company).toBe(before)
  })

  it('테스트판에서 다음 날로 넘긴다', async () => {
    const after = { ...before, attendance: attendance(true) }
    post.mockResolvedValue({ data: after } as never)
    await useRaisingStore.getState().skipSandboxDay()
    expect(post).toHaveBeenCalledWith('/api/sandbox/next-day')
    expect(useRaisingStore.getState().company).toBe(after)
  })
})

describe('시즌패스 (529번)', () => {
  const pass = (claimable: number, lastRewards: object[] = []) => ({ claimable, lastRewards })

  it('단계를 주면 그 단계만, 없으면 모두 받는다', async () => {
    const after = { ...before, pass: pass(0, [{ step: 2, diamonds: 50 }]) }
    post.mockResolvedValue({ data: after } as never)
    const result = await useRaisingStore.getState().claimPass(2)
    expect(post).toHaveBeenLastCalledWith('/api/company/pass/claim', { body: { step: 2 } })
    expect(result?.pass.lastRewards).toHaveLength(1)
    expect(useRaisingStore.getState().company).toBe(after)
    expect(useRaisingStore.getState().busy).toBe(false)
    await useRaisingStore.getState().claimPass()
    expect(post).toHaveBeenLastCalledWith('/api/company/pass/claim', { body: {} })
  })

  it('받을 것이 없어 거절되거나 끊기면 null이고 회사는 그대로다', async () => {
    post.mockResolvedValueOnce({ error: { message: '받을 보상이 없습니다.' } } as never)
    expect(await useRaisingStore.getState().claimPass()).toBeNull()
    expect(useRaisingStore.getState().error).toBe('받을 보상이 없습니다.')
    expect(useRaisingStore.getState().company).toBe(before)
    post.mockRejectedValueOnce(new Error('offline'))
    expect(await useRaisingStore.getState().claimPass(1)).toBeNull()
    expect(useRaisingStore.getState().company).toBe(before)
  })

  it('테스트판에서 경험치를 더하고 시즌을 넘긴다', async () => {
    post.mockResolvedValue({ data: { ...before, pass: pass(5) } } as never)
    await useRaisingStore.getState().addSandboxPassExp(500)
    expect(post).toHaveBeenLastCalledWith('/api/sandbox/pass-exp', { body: { exp: 500 } })
    await useRaisingStore.getState().skipSandboxSeason()
    expect(post).toHaveBeenLastCalledWith('/api/sandbox/next-season')
  })
})

describe('고양이 교체', () => {
  it('한 요청으로 교체하고 서버의 최종 팀만 반영한다', async () => {
    const after = { ...before, capital: 123 }
    post.mockResolvedValueOnce({ data: after } as never)
    await useRaisingStore.getState().fieldCat('mint', true, 'sky')
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/api/company/cat/field', {
      body: { code: 'mint', fielded: true, replaceCode: 'sky' },
    })
    expect(useRaisingStore.getState().company).toBe(after)
  })

  it('교체가 거절되어도 기존 팀을 지우지 않는다', async () => {
    post.mockResolvedValueOnce({ error: { message: '출전 구성이 바뀌었어요' } } as never)
    await useRaisingStore.getState().fieldCat('mint', true, 'sky')
    expect(useRaisingStore.getState().company).toBe(before)
    expect(useRaisingStore.getState().error).toBe('출전 구성이 바뀌었어요')
    expect(useRaisingStore.getState().busy).toBe(false)
  })
})
