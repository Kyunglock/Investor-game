import type Phaser from 'phaser'
import { DPR } from './art'

/** 전투에서 고양이 밑에 적는 이름표 (decisions.md 605번): 등급과 이름. code는 꾹 눌렀을 때 정보를 띄울 고양이다('boss'는 사장냥). */
export interface CatTag {
  code: string
  name: string
  /** 고양이의 등급. 사장냥은 등급이 없다. */
  grade?: 'C' | 'B' | 'A' | 'S'
}

/** 바닥색과 무관하게 읽히는 작은 이름표. 등급은 차분한 글자색으로 구분한다. */
export const TAG_STYLES = {
  C: { color: '#f0ece6', size: 11 },
  B: { color: '#c5eedb', size: 11 },
  A: { color: '#c9e2ff', size: 11 },
  S: { color: '#ffe4a3', size: 11 },
  boss: { color: '#fff3dc', size: 11 },
} as const

export function tagStyle(tag: CatTag) {
  return TAG_STYLES[tag.grade ?? 'boss']
}

/** 장식 기호 대신 일정한 구분자로 등급과 이름을 나눈다. */
export function tagText(tag: CatTag): string {
  return tag.grade ? `${tag.grade} · ${tag.name}` : tag.name
}

/** 이름표 글자를 만든다. 내용과 꾸밈은 dressTag가 입힌다. */
export function makeTag(scene: Phaser.Scene): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, '', {
      fontFamily: '"Noto Sans KR", sans-serif',
      fontSize: '11px',
      fontStyle: '600',
      color: '#ffffff',
      align: 'center',
      resolution: DPR,
      padding: { x: 3, y: 3 },
    })
    .setOrigin(0.5, 0)
    .setDepth(7)
    .setVisible(false)
}

/** 이름표에 그 고양이의 등급과 이름을 입힌다. 없으면 숨긴다. */
export function dressTag(text: Phaser.GameObjects.Text, tag: CatTag | undefined) {
  if (!tag) {
    text.setVisible(false)
    return
  }
  const style = tagStyle(tag)
  text
    .setText(tagText(tag))
    .setFontSize(style.size)
    .setColor(style.color)
    .setStroke('#293039', 2)
    .setShadow(0, 1, '#18202b', 3, false, true)
    .setVisible(true)
}

/** 꾹 누른 자리에서 가장 가까운 고양이의 차례(0은 사장냥). reach 안에 없으면 -1. */
export function catAt(
  spots: readonly { x: number; y: number }[],
  x: number,
  y: number,
  reach = 44,
): number {
  let best = -1
  let nearest = reach * reach
  for (const [i, spot] of spots.entries()) {
    const d = (spot.x - x) ** 2 + (spot.y - y) ** 2
    if (d <= nearest) {
      nearest = d
      best = i
    }
  }
  return best
}

/** 이만큼(ms) 누르고 있으면 꾹 누른 것이다. 그 사이에 이만큼(px) 넘게 움직이면 아니다. */
export const HOLD_MS = 450
export const HOLD_SLOP = 14
