import { describe, expect, it } from 'vitest'
import { adsTxt, validClient, validSlot } from './adsense'

describe('애드센스 (decisions.md 271번)', () => {
  it('게시자 ID가 비었거나 꼴이 틀리면 광고를 켜지 않는다', () => {
    expect(validClient('')).toBe(false)
    expect(validClient(undefined)).toBe(false)
    expect(validClient('pub-1234567890123456')).toBe(false)
    expect(validClient('ca-pub-1234567890123456')).toBe(true)
    expect(validSlot('')).toBe(false)
    expect(validSlot('1234567890')).toBe(true)
  })

  it('ads.txt 한 줄은 ca- 앞머리를 뗀 게시자 ID를 쓴다', () => {
    expect(adsTxt('ca-pub-1234567890123456')).toBe(
      'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n',
    )
  })
})
