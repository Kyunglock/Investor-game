import { afterEach, describe, expect, it, vi } from 'vitest'
import { holdIdle, IDLE_HOLD_EVENT, idleHeld } from './idleHold'

describe('방치형 전투 세우기 (682번)', () => {
  afterEach(() => {
    holdIdle('battle', false)
    holdIdle('ad', false)
    vi.unstubAllGlobals()
  })
  it('까닭이 하나라도 걸려 있으면 서 있고, 바뀔 때만 알린다', () => {
    const dispatched: boolean[] = []
    vi.stubGlobal('window', {
      dispatchEvent: (event: CustomEvent<boolean>) => dispatched.push(event.detail),
    })
    vi.stubGlobal(
      'CustomEvent',
      class {
        detail: boolean
        constructor(_type: string, init: { detail: boolean }) {
          this.detail = init.detail
        }
      },
    )
    expect(idleHeld()).toBe(false)
    holdIdle('battle', true)
    holdIdle('battle', true)
    holdIdle('ad', true)
    expect(idleHeld()).toBe(true)
    holdIdle('battle', false)
    expect(idleHeld()).toBe(true)
    holdIdle('ad', false)
    expect(idleHeld()).toBe(false)
    expect(dispatched).toEqual([true, false])
    expect(IDLE_HOLD_EVENT).toBe('idle-hold')
  })
})
