import type { Grade } from '../../../api/client'
import type { Attire } from '../../raising/office'
import { attireOf } from '../../raising/office'
import type { MoodKey } from '../pixel/moods'
import type { Acc, CatLook, Face, Outfit } from './draw'

/**
 * 게임 데이터 → 고양이 생김새 (decisions.md 341번).
 * 품종(털색·무늬)은 직원 번호로 정해져 바뀌지 않고, 차림새(후드티·셔츠·정장)는 종합 등급, 표정은 기분.
 */

export interface Breed {
  name: string
  fur: string
  fur2?: string
  pattern: CatLook['pattern']
}

/** 품종 여덟. 직원 번호를 8로 나눈 나머지. */
export const BREEDS: Breed[] = [
  { name: '치즈', fur: '#f5c57c', fur2: '#e39d4a', pattern: 'tabby' },
  { name: '고등어', fur: '#b9c3cf', fur2: '#6f7f93', pattern: 'tabby' },
  { name: '턱시도', fur: '#4f4a56', fur2: '#4f4a56', pattern: 'tuxedo' },
  { name: '삼색이', fur: '#fff6ea', fur2: '#f2a85a', pattern: 'calico' },
  { name: '러시안블루', fur: '#9aa6b8', pattern: 'solid' },
  { name: '샴', fur: '#efe1cf', fur2: '#8b6a52', pattern: 'point' },
  { name: '까망', fur: '#565060', pattern: 'solid' },
  { name: '흰둥이', fur: '#fffaf2', pattern: 'solid' },
]

export function breedOf(id: number): Breed {
  return BREEDS[((id % BREEDS.length) + BREEDS.length) % BREEDS.length]
}

/** 차림새 → 옷. 맞춤 정장(SSS 이상)은 정장에 금목걸이. */
export function outfitOf(attire: Attire): { outfit: Outfit; acc: Acc[] } {
  switch (attire) {
    case 'hoodie':
      return { outfit: 'hoodie', acc: [] }
    case 'shirt':
      return { outfit: 'shirt', acc: [] }
    case 'suit':
      return { outfit: 'suit', acc: ['tie'] }
    case 'tailored':
      return { outfit: 'suit', acc: ['tie', 'necklace'] }
  }
}

/** 기분 → 얼굴. 기쁨은 웃는 눈, 자신감은 결의(눈썹), 절망은 눈물, 검소는 가만히. */
export function faceOf(mood: MoodKey | null | undefined): Face {
  switch (mood) {
    case 'joy':
      return 'joy'
    case 'confident':
      return 'fire'
    case 'despair':
      return 'sad'
    default:
      return 'idle'
  }
}

/** 직원 한 명의 고양이. */
export function employeeLook(id: number, grade: Grade, mood?: MoodKey | null): CatLook {
  const breed = breedOf(id)
  const { outfit, acc } = outfitOf(attireOf(grade))
  return {
    fur: breed.fur,
    fur2: breed.fur2,
    pattern: breed.pattern,
    outfit,
    acc,
    face: faceOf(mood),
  }
}

/** 손님(직원이 아닌 사람): 품종만 있고 옷은 없다. */
export function customerLook(look: number, mood?: MoodKey | null): CatLook {
  const breed = breedOf(look)
  return { fur: breed.fur, fur2: breed.fur2, pattern: breed.pattern, face: faceOf(mood) }
}

/** 사장(플레이어): 크림색에 빨간 넥타이와 선글라스. 사용자가 고른 1번 컨셉. */
export const BOSS_LOOK: CatLook = { fur: '#f6dcb0', pattern: 'solid', acc: ['tie'], face: 'boss' }
