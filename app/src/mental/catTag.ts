import type Phaser from 'phaser'
import { DPR } from './art'

/** 전투에서 고양이 밑에 적는 이름표 (decisions.md 605번): 등급과 이름. code는 꾹 눌렀을 때 정보를 띄울 고양이다('boss'는 사장냥). */
export interface CatTag {
  code: string
  name: string
  /** 고양이의 등급. 사장냥은 등급이 없다. */
  grade?: 'C' | 'B' | 'A' | 'S' | 'SS'
}

/** 크림색 이름판과 등급별 파스텔 배지. 글자 외곽선 대신 판의 대비로 읽힌다. */
const TAG_STYLES = {
  C: { fill: 0xe4d4bb, edge: 0x9b8061 },
  B: { fill: 0xa8dcc3, edge: 0x4c9277 },
  A: { fill: 0xbccbf3, edge: 0x7287bd },
  S: { fill: 0xffd680, edge: 0xb98535 },
  SS: { fill: 0xb8fff6, edge: 0x875ac9 },
  boss: { fill: 0xffbda5, edge: 0xb97659 },
} as const

/** 검증과 정보 조회에 쓰는 이름. 화면에서는 등급을 별도 배지로 그린다. */
export function tagText(tag: CatTag): string {
  return tag.grade ? `${tag.grade} · ${tag.name}` : tag.name
}

export type CatNameplate = ReturnType<typeof makeTag>

export function makeTag(scene: Phaser.Scene) {
  const plate = scene.add.graphics()
  const label = scene.add
    .text(0, 0, '', {
      fontFamily: '"Jua", "Noto Sans KR", sans-serif',
      fontSize: '11px',
      color: '#594638',
      resolution: DPR,
      padding: { x: 1, y: 2 },
    })
    .setOrigin(0.5)
  const badge = scene.add
    .text(0, 0, '', {
      fontFamily: '"Jua", sans-serif',
      fontSize: '10px',
      color: '#594638',
      resolution: DPR,
      padding: { x: 1, y: 2 },
    })
    .setOrigin(0.5)
  return Object.assign(
    scene.add.container(0, 0, [plate, label, badge]).setDepth(7).setVisible(false),
    { plate, label, badge, text: '' },
  )
}

/** 긴 이름도 배지와 판을 포함해 이웃 이름표 사이에 들어가게 한다. */
export function dressTag(view: CatNameplate, tag: CatTag | undefined, room = 999) {
  if (!tag) {
    view.setVisible(false)
    return
  }
  const style = TAG_STYLES[tag.grade ?? 'boss']
  view.text = tagText(tag)
  view.label.setText(tag.name).setFontSize(11)
  for (let size = 11; view.label.width + 25 > room && size > 9; size--)
    view.label.setFontSize(size - 1)
  const width = Math.max(51, view.label.width + 25)
  const left = -width / 2
  const badgeX = left + 10
  view.label.setPosition(10, 10)
  view.badge.setText(tag.grade ?? '').setPosition(badgeX, 9)
  view.plate
    .clear()
    .fillStyle(0x60432c, 0.18)
    .fillRoundedRect(left, 2, width, 20, 10)
    .fillStyle(0xfff7e8)
    .fillRoundedRect(left, 0, width, 20, 10)
    .lineStyle(1.5, style.edge)
    .strokeRoundedRect(left, 0, width, 20, 10)
    .fillStyle(style.fill)
    .fillCircle(badgeX, 9, 8)
    .lineStyle(1, style.edge)
    .strokeCircle(badgeX, 9, 8)
    .lineStyle(1, 0xffffff, 0.75)
    .lineBetween(left + 21, 3, width / 2 - 10, 3)
  if (!tag.grade) {
    // 사장냥의 작은 발바닥: 글꼴에 따라 달라지는 이모지 대신 직접 그린다.
    view.plate
      .fillStyle(0x83543e)
      .fillEllipse(badgeX, 11, 7, 5)
      .fillCircle(badgeX - 4, 7, 1.5)
      .fillCircle(badgeX, 5.5, 1.6)
      .fillCircle(badgeX + 4, 7, 1.5)
  }
  view
    .setSize(width, 22)
    .setScale(Math.min(1, room / width))
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
