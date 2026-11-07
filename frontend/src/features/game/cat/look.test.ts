import { describe, expect, it } from 'vitest'
import { BOSS_LOOK, BREEDS, breedOf, customerLook, employeeLook, faceOf, outfitOf } from './look'

describe('고양이 생김새', () => {
  it('품종은 직원 번호로 정해지고 음수·큰 번호도 안전하다', () => {
    expect(breedOf(0)).toBe(BREEDS[0])
    expect(breedOf(BREEDS.length + 2)).toBe(BREEDS[2])
    expect(breedOf(-1)).toBe(BREEDS[BREEDS.length - 1])
  })

  it('차림새는 종합 등급을 따른다: F 후드티, B 셔츠, S 정장+넥타이, SSS 금목걸이까지', () => {
    expect(employeeLook(1, 'F').outfit).toBe('hoodie')
    expect(employeeLook(1, 'B').outfit).toBe('shirt')
    expect(employeeLook(1, 'S')).toMatchObject({ outfit: 'suit', acc: ['tie'] })
    expect(employeeLook(1, 'SSS').acc).toContain('necklace')
    expect(outfitOf('tailored').outfit).toBe('suit')
  })

  it('기분이 얼굴이 된다', () => {
    expect(faceOf('joy')).toBe('joy')
    expect(faceOf('confident')).toBe('fire')
    expect(faceOf('despair')).toBe('sad')
    expect(faceOf(null)).toBe('idle')
    expect(employeeLook(3, 'C', 'despair').face).toBe('sad')
  })

  it('손님은 옷이 없고, 사장은 크림색에 꾸밈 없음 (345번)', () => {
    expect(customerLook(2).outfit).toBeUndefined()
    expect(BOSS_LOOK).toMatchObject({ fur: '#f6dcb0', face: 'idle' })
    expect(BOSS_LOOK.acc ?? []).toHaveLength(0)
  })
})
