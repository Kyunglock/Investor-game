import type Phaser from 'phaser'
import { CELL_CRACKS, cellKey, WALL_LABEL_STYLE } from './art'

export const IDLE_WALL_GAP = 6
const UPCOMING_WALLS = 2

export interface UpcomingWall {
  wall: number
  hp: number
  maxHp: number
}

/** Leave room for the HUD above the stack and the buy wall below it. */
export function idleWallLayout(laneWidth: number, viewportHeight: number) {
  const height = Math.max(
    22,
    Math.min(
      64,
      (laneWidth - 3) / 6 + 3,
      (viewportHeight - 305 - 90 - UPCOMING_WALLS * IDLE_WALL_GAP) / 3,
    ),
  )
  const bottom = 90 + 3 * height + UPCOMING_WALLS * IDLE_WALL_GAP
  return { bottom, height, spacing: height + IDLE_WALL_GAP }
}

/** Server-owned splash health for the two walls behind the current target. */
export class IdleWallQueueFx {
  private layers: {
    wall: number
    hp: number
    maxHp: number
    body: Phaser.GameObjects.Image
    label: Phaser.GameObjects.Text
  }[]

  constructor(scene: Phaser.Scene) {
    this.layers = Array.from({ length: UPCOMING_WALLS }, (_, i) => ({
      wall: 0,
      hp: 0,
      maxHp: 0,
      body: scene.add.image(0, 0, cellKey(0)).setOrigin(0.5, 1).setDepth(2.2).setVisible(false),
      label: scene.add
        .text(0, 0, '', { ...WALL_LABEL_STYLE, fontSize: '13px', strokeThickness: 3 })
        .setOrigin(0.5)
        .setDepth(2.3)
        .setAlpha(1 - i * 0.12)
        .setVisible(false),
    }))
  }

  draw(
    current: number,
    bottom: number,
    left: number,
    width: number,
    height: number,
    upcoming: UpcomingWall[] = [],
  ) {
    for (const [i, layer] of this.layers.entries()) {
      const wall = current + i + 1
      const y = bottom - (i + 1) * (height + IDLE_WALL_GAP)
      const health = upcoming.find((entry) => entry.wall === wall)
      const hp = health?.hp ?? 1
      const maxHp = health?.maxHp ?? 1
      const crack = Math.min(
        CELL_CRACKS - 1,
        Math.floor((1 - hp / Math.max(1, maxHp)) * CELL_CRACKS),
      )
      const changed = layer.wall !== wall || layer.hp !== hp || layer.maxHp !== maxHp
      layer.body
        .setTexture(cellKey(Math.max(0, crack)))
        .setPosition(left + width / 2, y)
        .setDisplaySize(width - 3, height - 3)
        .setAlpha(0.9 - i * 0.13)
        .setVisible(true)
      layer.label.setPosition(left + width / 2, y - height / 2).setVisible(true)
      if (!changed) continue
      layer.wall = wall
      layer.hp = hp
      layer.maxHp = maxHp
      layer.label
        .setText(
          `매도벽 ${wall.toLocaleString()} · ${hp <= 0 ? '돌파 대기' : `${Math.ceil((100 * hp) / Math.max(1, maxHp))}%`}${wall % 10 === 0 ? ' · 큰손' : ''}`,
        )
        .setColor(wall % 10 === 0 ? '#ffe49a' : '#ffffff')
    }
  }

  /** Future walls are not physics targets; only an actual explosion overlapping them reports a hit. */
  hitWalls(x: number, y: number, radius: number) {
    return this.layers
      .filter(
        ({ body, hp }) =>
          body.visible &&
          hp > 0 &&
          Math.hypot(
            Math.max(0, Math.abs(x - body.x) - body.displayWidth / 2),
            Math.max(0, body.y - body.displayHeight - y, y - body.y),
          ) <= radius,
      )
      .map(({ wall }) => wall)
  }

  inspect() {
    return this.layers.map(({ wall, body, hp, maxHp }) => ({
      wall,
      hp,
      maxHp,
      crack: body.texture.key,
      top: body.y - body.displayHeight,
      bottom: body.y,
      visible: body.visible,
      boss: wall % 10 === 0,
    }))
  }
}
