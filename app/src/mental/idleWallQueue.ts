import type Phaser from 'phaser'
import { cellKey, WALL_LABEL_STYLE } from './art'

export const IDLE_WALL_GAP = 6
const UPCOMING_WALLS = 3

/** Leave room for the HUD above the stack and the buy wall below it. */
export function idleWallLayout(laneWidth: number, viewportHeight: number) {
  const bottom = Math.min(Math.max(280, viewportHeight * 0.44), 420, viewportHeight - 305)
  const height = Math.max(
    22,
    Math.min(64, (laneWidth - 3) / 6 + 3, (bottom - 136 - UPCOMING_WALLS * IDLE_WALL_GAP) / 4),
  )
  return { bottom, height, spacing: height + IDLE_WALL_GAP }
}

/** Future walls are scenery, so projectiles and skills only target the current wall. */
export class IdleWallQueueFx {
  private layers: {
    wall: number
    body: Phaser.GameObjects.Image
    label: Phaser.GameObjects.Text
  }[]

  constructor(scene: Phaser.Scene) {
    this.layers = Array.from({ length: UPCOMING_WALLS }, (_, i) => ({
      wall: 0,
      body: scene.add.image(0, 0, cellKey(0)).setOrigin(0.5, 1).setDepth(2.2).setVisible(false),
      label: scene.add
        .text(0, 0, '', { ...WALL_LABEL_STYLE, fontSize: '13px', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(2.3)
        .setAlpha(1 - i * 0.12)
        .setVisible(false),
    }))
  }

  draw(current: number, bottom: number, left: number, width: number, height: number) {
    for (const [i, layer] of this.layers.entries()) {
      const wall = current + i + 1
      const y = bottom - (i + 1) * (height + IDLE_WALL_GAP)
      layer.body
        .setPosition(left + width / 2, y)
        .setDisplaySize(width - 3, height - 3)
        .setAlpha(0.9 - i * 0.13)
        .setVisible(true)
      layer.label.setPosition(left + width / 2, y - height / 2).setVisible(true)
      if (layer.wall !== wall) {
        layer.wall = wall
        layer.label
          .setText(`${wall.toLocaleString()}벽 · ${wall % 10 === 0 ? '큰손 매도벽' : '매도 대기'}`)
          .setColor(wall % 10 === 0 ? '#ffe49a' : '#ffffff')
      }
    }
  }

  inspect() {
    return this.layers.map(({ wall, body }) => ({
      wall,
      top: body.y - body.displayHeight,
      bottom: body.y,
      visible: body.visible,
      boss: wall % 10 === 0,
    }))
  }
}
