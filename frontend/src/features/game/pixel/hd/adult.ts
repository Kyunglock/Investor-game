import type { Body } from '../sprite'

export const HD_WIDTH = 32
export const HD_HEIGHT = 40

/**
 * 고해상도 시안: 청년 남자 한 명 (32×40, 기존 16×20의 두 배). 큰 머리의 2등신에 가깝다.
 * 머리 윗줄 headTop=1 기준으로 눈은 ht+12~ht+15 줄(맨 아래는 갈색 반사)의 10~12열과 19~21열, 입은 ht+17 줄의 15·16열.
 */
export const HD_ADULT: Body = {
  headTop: 1,
  map: [
    '...........xxxxxxxxxx...........',
    '........xxxHHHHHHHhjjxxx........',
    '......xxHHHhhhhhhhhhhhjjxx......',
    '.....xHHhhhhHHHjhhhhhhhhjjx.....',
    '....xHhhhjhiiihjjhhiihhhhjjx....',
    '...xHhhhjhiihhhhhhhhhhjhhhjjx...',
    '...xHhhjhhhhhhhhhhhhhhhjhhjjx...',
    '..xHhhhjhhhhhhhhhhhhhhhhjhhjjx..',
    '..xHhhhhhhhhhhhhhhhhhhhhjhhjjx..',
    '..xHhhhhhhjhhhhjjhhhhjhhhhhjjx..',
    '..xHhhhhjjSjhhjSSjhhjSjjhhhjjx..',
    '..xjhhjjSSsSjjSssSjjSsSSjjhhjx..',
    '...xjjSSssssSSssssSSssssSSjjx...',
    '...vSSsssskkksssssskkkssssSSv...',
    '...vlSssssEkkssssssEkkssssSSv...',
    '...vlssssskkksssssskkkssssSSv...',
    '....vlssssfefssssssfefsssSSv....',
    '.....vlsrrssssssSsssssrrSSv.....',
    '......vlsssssssmmssssssSSv......',
    '.......vvlsssssssssssSSvv.......',
    '.......qqvvvSSSSSSSSvvvqq.......',
    '.....qqCCCCCwlsssSSwCccccqq.....',
    '....qCCccccddwlssswCcccccddq....',
    '...qCcccccccddwsswCcccccccddq...',
    '...qCccccccccddwwCccccccccddq...',
    '..qCccdccccccccccccccccccqcddq..',
    '..qCccdccccccccccccccccccqcddq..',
    '..qddddccccccccccccccccccqdddq..',
    '..vsssvddddddddddddddddddqssSv..',
    '..vssSvbbbbbbbbyybbbbbbbbossSv..',
    '...vvvzupppppppppppppppPPzvvv...',
    '......zupppppppPPppppppPPz......',
    '......zupppppPPzzupppppPPz......',
    '......zupppppPPzzupppppPPz......',
    '......zupppppPPzzupppppPPz......',
    '......zupppppPPzzupppppPPz......',
    '......zPPPPPPPPzzPPPPPPPPz......',
    '.....oNnnnnnnaaooNnnnnnnaao.....',
    '.....oNnnnnnnaaooNnnnnnnaao.....',
    '......ooooooooo..ooooooooo......',
  ],
}
