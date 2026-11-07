import type { Company } from '@web/api/client'

/** 싸우는 건 사장냥(플레이어 본인, decisions.md 341번). 이름만 화면에 쓴다. */
export interface Hero {
  name: string
}

export function heroOf(_company: Company): Hero {
  return { name: '사장냥' }
}
