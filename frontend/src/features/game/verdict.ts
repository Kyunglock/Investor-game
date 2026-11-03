/**
 * 엔딩의 한 줄 평가 (#230, decisions.md 167번). 돈만이 아니라 행복과 가족을 함께 본다. 크레딧 마지막과 인생 기록부에 같은 문장이 나온다.
 * 문턱: 자산 10억 이상 넉넉, 2억 미만 가난. 행복도 60 이상 행복, 40 미만 지침. 가족 점수 60 이상 화목, 20 미만 멀어짐(111번).
 */
export interface VerdictInput {
  finalAsset: number
  bankrupt: boolean
  happiness: number
  family: number
  /** 결혼했거나 아이가 있었다 */
  hasFamily: boolean
}

const RICH = 1_000_000_000
const POOR = 200_000_000

export function lifeVerdict(v: VerdictInput): string {
  const happy = v.happiness >= 60
  const tired = v.happiness < 40
  const warm = v.hasFamily && v.family >= 60
  const cold = v.hasFamily && v.family < 20
  if (v.bankrupt) {
    if (warm) {
      return '파산했지만, 곁에는 끝까지 가족이 남았다'
    }
    return happy ? '모든 걸 잃었지만 웃음만은 잃지 않았다' : '돈도 마음도 바닥까지 내려간 인생'
  }
  const rich = v.finalAsset >= RICH
  const poor = v.finalAsset < POOR
  if (rich) {
    if (happy && warm) {
      return '돈도 사랑도 다 가진 인생'
    }
    if (cold) {
      return '통장은 두둑했지만 집은 썰렁했던 인생'
    }
    if (tired) {
      return '돈은 남았지만 웃을 일이 적었던 인생'
    }
    return happy ? '넉넉하게 벌고 즐겁게 산 인생' : '부지런히 불려 넉넉하게 마친 인생'
  }
  if (poor) {
    if (happy && warm) {
      return '가난했지만 웃음 많은 집'
    }
    if (happy) {
      return '가진 건 적어도 마음은 편했던 인생'
    }
    if (cold) {
      return '돈도 가족도 멀어진 쓸쓸한 끝'
    }
    return tired ? '돈도 마음도 고단했던 인생' : '빠듯했지만 버텨 낸 인생'
  }
  if (happy && warm) {
    return '넉넉하진 않아도 가족과 행복했던 인생'
  }
  if (cold) {
    return '그럭저럭 벌었지만 가족과는 멀어진 인생'
  }
  if (tired) {
    return '그럭저럭 벌었지만 마음은 지쳤던 인생'
  }
  return happy ? '넉넉하진 않아도 행복했던 인생' : '평범하게, 그러나 꾸준히 살아 낸 인생'
}
