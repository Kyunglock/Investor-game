import { describe, expect, it } from 'vitest'
import { deskLine, loungeSpeaker, moodHearts, moodPhrase, type Speaker } from './staffLines'

const cat = (extra: Partial<Speaker> = {}): Speaker => ({
  id: 1,
  overallGrade: 'C',
  morale: 0,
  deskYears: 1,
  leader: true,
  ...extra,
})

describe('사무실 말풍선 (decisions.md 412번)', () => {
  it('사기가 먼저다', () => {
    expect(deskLine(cat({ morale: -2, overallGrade: 'S' }))).toBe('요즘 손이 자꾸 떨려요…')
    expect(deskLine(cat({ morale: -1 }))).toBe('분위기 좀 띄워 주세요')
    expect(deskLine(cat({ morale: 2 }))).toBe('오늘 촉이 아주 좋아요!')
  })

  it('등급 높은 팀장, 오래 앉은 사람, 사기 높은 사람', () => {
    expect(deskLine(cat({ overallGrade: 'A' }))).toBe('이번 분기 제가 맡을게요!')
    expect(deskLine(cat({ overallGrade: 'GOD' }))).toBe('이번 분기 제가 맡을게요!')
    expect(deskLine(cat({ deskYears: 3 }))).toBe('이 자리는 눈 감고도 해요')
    expect(deskLine(cat({ morale: 1 }))).toBe('팀 분위기 최고예요!')
  })

  it('보통이면 번호로 고르고 같은 사람은 늘 같은 말', () => {
    expect(deskLine(cat({ id: 4 }))).toBe(deskLine(cat({ id: 4 })))
    expect(deskLine(cat({ id: 4 }))).toBe('다들 힘내 봐요!')
    expect(deskLine(cat({ id: 5 }))).toBe('차트 보는 중이에요')
  })

  it('휴게실에서는 등급이 가장 높은 사람이 말한다', () => {
    expect(loungeSpeaker([])).toBeNull()
    const pick = loungeSpeaker([
      cat({ id: 7, overallGrade: 'E' }),
      cat({ id: 5, overallGrade: 'S' }),
      cat({ id: 3, overallGrade: 'S' }),
    ])
    expect(pick?.id).toBe(3)
  })

  it('하트는 사기 평균을 1~5로, 사람이 없으면 0', () => {
    expect(moodHearts([])).toBe(0)
    expect(moodHearts([0, 0])).toBe(3)
    expect(moodHearts([2, 2])).toBe(5)
    expect(moodHearts([-2])).toBe(1)
    expect(moodHearts([1, 0])).toBe(4)
  })

  it('머리띠 한마디', () => {
    expect(moodPhrase([])).toBe('사무실이 조용해요')
    expect(moodPhrase([0, 0, 1])).toBe('팀 분위기 좋음')
    expect(moodPhrase([0])).toBe('팀 분위기 무난')
    expect(moodPhrase([-2, -1])).toBe('팀 분위기 바닥')
    expect(moodPhrase([2, 1])).toBe('팀 분위기 최고')
  })
})
