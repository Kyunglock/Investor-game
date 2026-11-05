import { describe, expect, it } from 'vitest'
import { deskLabel } from './desks'

describe('deskLabel', () => {
  const chip = { name: '반도체 데스크', statCode: 'courage', sector: 'semiconductor', hot: false }

  it('자리가 원하는 능력치를 붙인다', () => {
    expect(deskLabel(chip)).toBe('반도체 데스크 (용기)')
  })

  it('이 시대에 뜨는 자리와 직원의 관심 섹터를 표시한다', () => {
    expect(deskLabel({ ...chip, hot: true }, 'semiconductor')).toBe(
      '반도체 데스크 (용기 · 이번 시대 ★ · 관심 섹터)',
    )
    expect(deskLabel(chip, 'bio')).toBe('반도체 데스크 (용기)')
    expect(deskLabel({ ...chip, sector: null }, null)).toBe('반도체 데스크 (용기)')
  })
})
