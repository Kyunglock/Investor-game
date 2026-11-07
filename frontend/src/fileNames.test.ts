import { describe, expect, it } from 'vitest'

/**
 * 같은 폴더에 대소문자만 다른 이름(확장자 빼고)의 파일을 두지 않는다 (decisions.md 308번). 리눅스 CI는 구분하지만 운영 맥의 배포 러너는
 * 구분하지 않아, `tutorial.ts`와 `Tutorial.tsx`가 같이 있을 때 `./Tutorial`이 `tutorial.ts`로 풀려 타입 검사가 깨졌다.
 */
function caseCollisions(paths: string[]): string[] {
  const seen = new Map<string, string>()
  const found: string[] = []
  for (const path of [...paths].sort()) {
    const slash = path.lastIndexOf('/')
    const dir = path.slice(0, slash)
    const name = path.slice(slash + 1)
    const key = `${dir}/${name.replace(/\.[^.]+$/, '').toLowerCase()}`
    const other = seen.get(key)
    if (other && other !== name) {
      found.push(`${dir}: ${other} ↔ ${name}`)
    }
    seen.set(key, name)
  }
  return found
}

describe('파일 이름', () => {
  it('대소문자만 다른 이름을 찾는다', () => {
    expect(caseCollisions(['./a/tutorial.ts', './a/Tutorial.tsx', './b/Tutorial.tsx'])).toEqual([
      './a: Tutorial.tsx ↔ tutorial.ts',
    ])
    expect(caseCollisions(['./a/office.ts', './a/OfficeArt.tsx'])).toEqual([])
  })

  it('src 안에 같은 폴더에서 대소문자만 다른 파일이 없다', () => {
    const files = Object.keys(import.meta.glob('./**/*'))
    expect(files.length).toBeGreaterThan(50)
    expect(caseCollisions(files)).toEqual([])
  })
})
