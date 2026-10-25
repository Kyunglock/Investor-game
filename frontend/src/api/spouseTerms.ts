import type { components } from './schema'

type Sex = components['schemas']['Sex']

/** 받침 있는 말 뒤 / 없는 말 뒤 조사 짝. */
const PARTICLES: [string, string][] = [
  ['이', '가'],
  ['은', '는'],
  ['을', '를'],
  ['과', '와'],
]

/** 내 성별로 본 배우자 호칭: 나는 남자면 아내, 여자면 남편 (decisions.md 69·91번). */
export function spouseWord(sex: Sex): string {
  return sex === 'F' ? '남편' : '아내'
}

/**
 * 서버 문구의 '배우자'를 남편·아내로 바꾸고 뒤 조사를 맞춘다. 배우자 쪽 집안은 남자면 처가, 여자면 시가 (decisions.md 91번).
 */
export function withSpouseTerms(text: string, sex: Sex): string {
  if (!text.includes('배우자') && !text.includes('처가')) {
    return text
  }
  const word = spouseWord(sex)
  const batchim = word === '남편'
  return text
    .replace(
      /배우자(이|가|은|는|을|를|과|와)?(?:\([가-힣]\))?/g,
      (_, particle: string | undefined) => {
        const pair = particle ? PARTICLES.find((p) => p.includes(particle)) : undefined
        return word + (pair ? pair[batchim ? 0 : 1] : (particle ?? ''))
      },
    )
    .replace(/처가\(시가\)/g, sex === 'F' ? '시가' : '처가')
    .replace(/처가/g, sex === 'F' ? '시가' : '처가')
}

/** 응답 JSON 안의 모든 문자열에 withSpouseTerms를 입힌다. */
export function deepSpouseTerms<T>(value: T, sex: Sex): T {
  if (typeof value === 'string') {
    return withSpouseTerms(value, sex) as T
  }
  if (Array.isArray(value)) {
    return value.map((v: unknown) => deepSpouseTerms(v, sex)) as T
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepSpouseTerms(v, sex)]),
    ) as T
  }
  return value
}

/** 응답에서 내 성별을 찾는다: Game이면 맨 위, 선택 결과면 game 안. 없으면 null. */
export function sexOfResponse(body: unknown): Sex | null {
  if (body === null || typeof body !== 'object') {
    return null
  }
  const b = body as { sex?: unknown; game?: { sex?: unknown } }
  const sex = b.sex ?? b.game?.sex
  return sex === 'M' || sex === 'F' ? sex : null
}
