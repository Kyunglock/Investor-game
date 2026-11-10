import type Phaser from 'phaser'
import { BUY_WALL, type BuyWall } from './buyWall'

/** 붉은 매수 주문 벽과 소량의 상승 주문. 매도벽의 파란 물량과 구분한다. */
export class BuyWallFx {
  private ink: Phaser.GameObjects.Graphics
  private title: Phaser.GameObjects.Text
  private shots: { x: number; y: number; active: boolean; label: Phaser.GameObjects.Text }[]
  constructor(scene: Phaser.Scene) {
    this.ink = scene.add.graphics().setDepth(4)
    this.title = scene.add
      .text(0, 0, '', {
        fontFamily: 'Jua, sans-serif',
        fontSize: 12,
        color: '#fff4da',
        stroke: '#803b3f',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(6)
    this.shots = Array.from({ length: 6 }, () => ({
      x: 0,
      y: 0,
      active: false,
      label: scene.add
        .text(0, 0, '매수 ↑', {
          fontFamily: 'Jua, sans-serif',
          fontSize: 11,
          color: '#fff7d6',
          stroke: '#9a3f37',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setVisible(false),
    }))
  }
  launch(x: number, y: number) {
    const shot = this.shots.find((s) => !s.active)
    if (shot) Object.assign(shot, { x, y, active: true })
  }
  step(dt: number, hit: (x: number, fromY: number, toY: number) => boolean) {
    for (const shot of this.shots) {
      if (!shot.active) continue
      const next = shot.y - dt * 360
      if (hit(shot.x, shot.y, next) || next < -30) shot.active = false
      shot.y = next
    }
  }
  draw(wall: BuyWall, left: number, width: number, y: number, reduced: boolean) {
    const g = this.ink.clear()
    const cw = width / 6
    if (wall.active) {
      g.fillStyle(0x823b48).fillRoundedRect(left - 4, y - 14, width + 8, 36, 7)
      for (let i = 0; i < 6; i++) {
        const x = left + i * cw
        g.fillStyle(i % 2 ? 0xf18c69 : 0xe97162).fillRoundedRect(x + 1, y - 12, cw - 2, 26, 4)
        g.lineStyle(1.5, 0xffdb9f).strokeRoundedRect(x + 1, y - 12, cw - 2, 26, 4)
        if (wall.hp < wall.maxHp * 0.5)
          g.lineStyle(2, 0x803b3f).lineBetween(x + 8, y - 10, x + cw - 8, y + 10)
      }
      g.fillStyle(0x4f2837).fillRect(left, y + 17, width, 4)
      g.fillStyle(0xffdc87).fillRect(left, y + 17, (width * wall.hp) / wall.maxHp, 4)
      this.title
        .setText(`매수벽 ${Math.ceil(wall.hp)}/${wall.maxHp}`)
        .setPosition(left + width / 2, y)
    } else {
      const t = Math.min(1, (BUY_WALL.rebuildSeconds - wall.rebuildLeft) / 0.8)
      for (let i = 0; i < 12; i++) {
        const x = left + ((i % 6) + 0.5) * cw + (reduced ? 0 : (i % 2 ? 1 : -1) * t * 30)
        g.fillStyle(0xef9271, 1 - t).fillRect(
          x,
          y + (reduced ? 0 : t * t * 55) + Math.floor(i / 6) * 12,
          cw * 0.45,
          10,
        )
      }
      g.lineStyle(1, 0xf7c7a5, 0.6).strokeRoundedRect(left, y - 12, width, 26, 4)
      this.title
        .setText(`매수벽 붕괴 · 재정비 ${Math.ceil(wall.rebuildLeft)}초`)
        .setPosition(left + width / 2, y)
    }
    for (const shot of this.shots) {
      shot.label.setVisible(shot.active).setPosition(shot.x, shot.y)
      if (!shot.active) continue
      g.fillStyle(0xffd394, 0.35).fillRoundedRect(shot.x - 10, shot.y, 20, 38, 5)
      g.fillStyle(0xc64b45).fillRoundedRect(shot.x - 21, shot.y - 10, 42, 21, 5)
      g.lineStyle(1.5, 0xffd394).strokeRoundedRect(shot.x - 21, shot.y - 10, 42, 21, 5)
    }
  }
}
