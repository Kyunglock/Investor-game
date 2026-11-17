import type Phaser from 'phaser'
import { DPR } from './art'

/** 전투에서 고양이 밑에 적는 이름표 (decisions.md 605번): 등급과 이름. code는 꾹 눌렀을 때 정보를 띄울 고양이다('boss'는 사장냥). */
export interface CatTag {
  code: string
  name: string
  /** 고양이의 등급. 사장냥은 등급이 없다. */
  grade?: 'C' | 'B' | 'A' | 'S'
}

/**
 * 색 판 위에 적어 밝은 바닥에서도 읽힌다. 등급이 높을수록 화려하다: C는 수수한 갈색 판, B는 초록, A는 마름모를 단 파랑에 빛이 번지고, S는 별을 단
 * 금빛 판에 빛이 번지며 숨 쉬듯 커졌다 작아진다. 사장냥은 왕관을 단 주황이다.
 */
export const TAG_STYLES = {
  C: {
    color: '#fff8ea',
    plate: '#5c4a3acc',
    stroke: '#3d3026',
    size: 11,
    mark: '',
    glow: null,
    pulse: false,
  },
  B: {
    color: '#f2ffe8',
    plate: '#2f7d32e6',
    stroke: '#1d4d20',
    size: 11,
    mark: '',
    glow: null,
    pulse: false,
  },
  A: {
    color: '#f0f8ff',
    plate: '#1f66c7f0',
    stroke: '#123f82',
    size: 12,
    mark: '◆ ',
    glow: '#7fc0ff',
    pulse: false,
  },
  S: {
    color: '#5a2d00',
    plate: '#ffd23df5',
    stroke: '#fff6c9',
    size: 13,
    mark: '★ ',
    glow: '#ffb300',
    pulse: true,
  },
  boss: {
    color: '#fff3e0',
    plate: '#c8501ef0',
    stroke: '#7c2c0c',
    size: 12,
    mark: '♛ ',
    glow: null,
    pulse: false,
  },
} as const

export function tagStyle(tag: CatTag) {
  return TAG_STYLES[tag.grade ?? 'boss']
}

/** 이름표에 적는 글: "★ S 눈꽃냥", "C 하늘냥", "♛ 사장냥". */
export function tagText(tag: CatTag): string {
  const style = tagStyle(tag)
  return `${style.mark}${tag.grade ? `${tag.grade} ` : ''}${tag.name}`
}

/** 이름표 글자를 만든다. 내용과 꾸밈은 dressTag가 입힌다. */
export function makeTag(scene: Phaser.Scene): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, '', {
      fontFamily: '"Jua", "Gowun Dodum", "Noto Sans KR", sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      align: 'center',
      resolution: DPR,
      padding: { x: 5, y: 2 },
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
    .setBackgroundColor(style.plate)
    .setStroke(style.stroke, 2)
    .setVisible(true)
  if (style.glow) text.setShadow(0, 0, style.glow, 8, true, true)
  else text.setShadow(0, 0, '#000000', 0, false, false)
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
