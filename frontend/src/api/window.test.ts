import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_ID, lostToOtherWindow, takeOver, useWindowRole, windowReady } from './window'

describe('한 판은 한 창만 (#189)', () => {
  afterEach(() => {
    useWindowRole.setState({ role: 'primary' })
    vi.unstubAllGlobals()
  })

  it('창마다 ID가 있다', () => {
    expect(CLIENT_ID.length).toBeGreaterThan(8)
  })

  it('Web Locks가 없으면 주 창으로 시작하고, 서버의 409를 받으면 보기 전용, 이어하기로 돌아온다', async () => {
    expect(await windowReady()).toBe('primary')
    lostToOtherWindow()
    expect(useWindowRole.getState().role).toBe('device')
    await takeOver()
    expect(useWindowRole.getState().role).toBe('primary')
  })

  it('다른 탭이 자물쇠를 쥐고 있으면 이어하기는 자물쇠를 빼앗는다', async () => {
    const request = vi.fn(
      (_name: string, options: { steal?: boolean }, callback: (lock: unknown) => Promise<void>) => {
        void callback(options.steal ? {} : null)
        return new Promise<void>(() => {})
      },
    )
    vi.stubGlobal('navigator', { locks: { request } })
    useWindowRole.setState({ role: 'tab' })
    await takeOver()
    expect(request).toHaveBeenCalledWith(
      'investor-game-clock',
      { steal: true },
      expect.any(Function),
    )
    expect(useWindowRole.getState().role).toBe('primary')
  })
})
