import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PIXEL_ART_KEY, usePixelArt } from './pixelArt'

/** 테스트 환경(node)에는 localStorage가 없어 메모리로 흉내 낸다. */
const memory = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
})

describe('도트 그림 끄기 (decisions.md 190번)', () => {
  beforeEach(() => {
    localStorage.clear()
    usePixelArt.setState({ shown: true })
  })

  it('끄고 켜면 브라우저에 남는다', () => {
    usePixelArt.getState().setShown(false)
    expect(usePixelArt.getState().shown).toBe(false)
    expect(localStorage.getItem(PIXEL_ART_KEY)).toBe('off')
    usePixelArt.getState().setShown(true)
    expect(localStorage.getItem(PIXEL_ART_KEY)).toBe('on')
  })
})
