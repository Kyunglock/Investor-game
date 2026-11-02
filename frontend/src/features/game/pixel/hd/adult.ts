import type { Body } from '../sprite'

export const HD_WIDTH = 32
export const HD_HEIGHT = 40

/**
 * 고해상도 시안: 청년 남자 한 명 (32×40, 기존 16×20의 두 배).
 * 머리 윗줄 headTop=2 기준으로 눈썹은 ht+8, 눈은 ht+9·ht+10 줄의 10·11열과 20·21열, 입은 ht+13 줄의 15·16열.
 */
export const HD_ADULT: Body = {
  headTop: 2,
  map: [
    '................................',
    '................................',
    '...........kkkkkkkkkk...........',
    '.........kkhHHHHhhhhhkk.........',
    '........khHHhhhhhhhhhhjk........',
    '.......khHhhhhhhhhhhhhhjk.......',
    '.......khhhhhhhhhhhhhhjjk.......',
    '.......khhhhhjhhhhhhhhjjk.......',
    '.......khhhsshhhhhsshhjjk.......',
    '.......khhssssshhsssssjjk.......',
    '.......khsjjssssssssjjSjk.......',
    '.......khseEsssssssseESjk.......',
    '.......khseesssssssseeSjk.......',
    '.......kssssssssssssssSSk.......',
    '........ksssssssssssssSk........',
    '........kssssssmmsssssSk........',
    '.........kssssssssssSSk.........',
    '..........kkkSSSSSSkkk..........',
    '.........kkkkssssSSkkkk.........',
    '.......kkCCCCwsssswcccqkk.......',
    '......kCCCCCCCwsswccccccqk......',
    '.....kCCqCCCCCCwwccccccqcqk.....',
    '.....kCCqCCCCCCCcccccccqcqk.....',
    '.....kCCqCCCCCCCcccccccqcqk.....',
    '.....kCCqCCCCCCCcccccccqcqk.....',
    '.....ksskCCCCCCCccccccqksSk.....',
    '.....ksskCCCCCCCccccccqksSk.....',
    '......kkkbbbbbbyybbbbbbkkk......',
    '........kuuppppppppppPPk........',
    '........kuuppppPPpppppPk........',
    '........kuupppPkkupppPPk........',
    '........kuupppPkkupppPPk........',
    '........kuupppPkkupppPPk........',
    '........kuupppPkkupppPPk........',
    '........kuupppPkkupppPPk........',
    '........kuupppPkkupppPPk........',
    '........kPPPPPPkkPPPPPPk........',
    '.......kbbbbbbnkkbbbbbbnk.......',
    '........kkkkkkk..kkkkkkk........',
    '................................',
  ],
}
