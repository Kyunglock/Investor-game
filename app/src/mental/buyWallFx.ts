import type Phaser from 'phaser'
import { DPR, WALL_LABEL_STYLE } from './art'
import { BUY_WALL, type BuyWall } from './buyWall'
import { shareLabel } from './shares'

/** 붉은 매수 주문 벽과 소량의 상승 주문. 매도벽의 파란 물량과 구분한다. */
export class BuyWallFx {
  private ink: Phaser.GameObjects.Graphics
  private title: Phaser.GameObjects.Text
  private shots: {
    x: number
    y: number
    damage: number
    active: boolean
    label: Phaser.GameObjects.Text
  }[]
  constructor(scene: Phaser.Scene) {
    this.ink = scene.add.graphics().setDepth(4)
    this.title = scene.add
      .text(0, 0, '', { ...WALL_LABEL_STYLE })
      .setOrigin(0.5)
      .setDepth(6)
    this.shots = Array.from({ length: 6 }, () => ({
      x: 0,
      y: 0,
      damage: 0,
      active: false,
      label: scene.add
        .text(0, 0, '', {
          fontFamily: '"Jua", "Gowun Dodum", sans-serif',
          fontSize: 12,
          color: '#fff7d6',
          stroke: '#9a3f37',
          strokeThickness: 1,
          resolution: DPR,
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setVisible(false),
    }))
  }
  launch(x: number, y: number, damage: number) {
    const shot = this.shots.find((s) => !s.active)
    if (shot) {
      Object.assign(shot, { x, y, damage, active: true })
      shot.label.setText(`매수 ${shareLabel(damage)} ↑`)
    }
  }
  step(dt: number, hit: (x: number, fromY: number, toY: number, damage: number) => boolean) {
    for (const shot of this.shots) {
      if (!shot.active) continue
      const next = shot.y - dt * 360
      if (hit(shot.x, shot.y, next, shot.damage) || next < -30) shot.active = false
      shot.y = next
    }
  }
  draw(wall: BuyWall, left: number, width: number, y: number, reduced: boolean) {
    const g = this.ink.clear()
    const cw = width / 6
    if (wall.active) {
      // 매도벽처럼 칸을 나누지 않은 하나의 두꺼운 주문 벽이다.
      g.fillStyle(0x823b48).fillRoundedRect(left - 4, y - 28, width + 8, 58, 8)
      g.fillStyle(0xe97162).fillRoundedRect(left, y - 30, width, 52, 7)
      g.lineStyle(2, 0xffdb9f).strokeRoundedRect(left, y - 30, width, 52, 7)
      g.lineStyle(3, 0xffbc8d).lineBetween(left + 10, y - 24, left + width - 10, y - 24)
      if (wall.hp < wall.maxHp * 0.5) {
        const x = left + width * 0.72
        g.lineStyle(2, 0x803b3f)
          .lineBetween(x, y - 29, x - 9, y - 15)
          .lineBetween(x - 9, y - 15, x + 3, y - 7)
          .lineBetween(x + 3, y - 7, x - 6, y + 7)
      }
      g.fillStyle(0x4f2837).fillRect(left + 5, y + 24, width - 10, 4)
      g.fillStyle(0xffdc87).fillRect(left + 5, y + 24, ((width - 10) * wall.hp) / wall.maxHp, 4)
      this.title
        .setText(`매수벽 ${shareLabel(wall.hp)} / ${shareLabel(wall.maxHp)}`)
        .setPosition(left + width / 2, y - 4)
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
      g.lineStyle(1, 0xf7c7a5, 0.6).strokeRoundedRect(left, y - 30, width, 52, 7)
      this.title
        .setText(`매수벽 붕괴 · 재정비 ${Math.ceil(wall.rebuildLeft)}초`)
        .setPosition(left + width / 2, y)
    }
    // 강화로 물량 자릿수가 늘어나도 벽 밖으로 넘치지 않게 한다.
    this.title.setScale(Math.min(1, (width - 20) / Math.max(1, this.title.width)))
    for (const shot of this.shots) {
      shot.label.setVisible(shot.active).setPosition(shot.x, shot.y)
      if (!shot.active) continue
      g.fillStyle(0xffd394, 0.35).fillRoundedRect(shot.x - 10, shot.y, 20, 38, 5)
      const width = Math.max(42, shot.label.width + 12)
      g.fillStyle(0xc64b45).fillRoundedRect(shot.x - width / 2, shot.y - 10, width, 21, 5)
      g.lineStyle(1.5, 0xffd394).strokeRoundedRect(shot.x - width / 2, shot.y - 10, width, 21, 5)
    }
  }
}
