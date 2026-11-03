import { describe, expect, it } from 'vitest'
import { lifeVerdict } from './verdict'

const base = {
  finalAsset: 500_000_000,
  bankrupt: false,
  happiness: 50,
  family: 50,
  hasFamily: true,
}

describe('엔딩 한 줄 평가 (decisions.md 167번)', () => {
  it('돈과 행복·가족을 함께 본다', () => {
    expect(lifeVerdict({ ...base, finalAsset: 2_000_000_000, happiness: 70, family: 70 })).toBe(
      '돈도 사랑도 다 가진 인생',
    )
    expect(lifeVerdict({ ...base, finalAsset: 2_000_000_000, happiness: 30 })).toBe(
      '돈은 남았지만 웃을 일이 적었던 인생',
    )
    expect(lifeVerdict({ ...base, finalAsset: 2_000_000_000, family: 10 })).toBe(
      '통장은 두둑했지만 집은 썰렁했던 인생',
    )
    expect(lifeVerdict({ ...base, finalAsset: 50_000_000, happiness: 75, family: 80 })).toBe(
      '가난했지만 웃음 많은 집',
    )
    expect(lifeVerdict({ ...base, finalAsset: 50_000_000, happiness: 30 })).toBe(
      '돈도 마음도 고단했던 인생',
    )
    expect(lifeVerdict(base)).toBe('평범하게, 그러나 꾸준히 살아 낸 인생')
  })

  it('가족이 없으면 가족 점수를 보지 않는다', () => {
    expect(lifeVerdict({ ...base, hasFamily: false, family: 0, finalAsset: 2_000_000_000 })).toBe(
      '부지런히 불려 넉넉하게 마친 인생',
    )
  })

  it('파산해도 가족이 곁에 있으면 그렇게 말한다', () => {
    expect(lifeVerdict({ ...base, bankrupt: true, family: 70 })).toBe(
      '파산했지만, 곁에는 끝까지 가족이 남았다',
    )
    expect(lifeVerdict({ ...base, bankrupt: true, happiness: 20, family: 40 })).toBe(
      '돈도 마음도 바닥까지 내려간 인생',
    )
  })
})
