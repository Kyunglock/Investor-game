import type Phaser from 'phaser'
import { CELL_CRACKS, cellKey } from './art'
import { IDLE_PIERCE_FLOOR } from './idlePierce'

export const IDLE_WALL_GAP = 6
const UPCOMING_WALLS = 2

export interface UpcomingWall {
  wall: number
  hp: number
  maxHp: number
}

/** The stack starts right under the one-line HUD (decisions.md 493 removed the status line). */
export const IDLE_WALL_TOP = 60

/** Leave room for the HUD above the stack and the buy wall below it. */
export function idleWallLayout(laneWidth: number, viewportHeight: number) {
  const height = Math.max(
    22,
    Math.min(
      64,
      (laneWidth - 3) / 6 + 3,
      (viewportHeight - 305 - IDLE_WALL_TOP - UPCOMING_WALLS * IDLE_WALL_GAP) / 3,
    ),
  )
  const bottom = IDLE_WALL_TOP + 3 * height + UPCOMING_WALLS * IDLE_WALL_GAP
  return { bottom, height, spacing: height + IDLE_WALL_GAP }
}

/**
 * Server-owned health for the two walls behind the current target. They carry no text (decisions.md 507).
 * Only pierced bullets reach them, and they keep their last point of health until they come to the front (520).
 */
export class IdleWallQueueFx {
  private layers: {
    wall: number
    hp: number
    maxHp: number
    body: Phaser.GameObjects.Image
  }[]

  constructor(scene: Phaser.Scene) {
    this.layers = Array.from({ length: UPCOMING_WALLS }, () => ({
      wall: 0,
      hp: 0,
      maxHp: 0,
      body: scene.add.image(0, 0, cellKey(0)).setOrigin(0.5, 1).setDepth(2.2).setVisible(false),
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
      // 뒤 벽은 0으로 보이지 않는다: 서버와 같이 1을 남긴다 (520번).
      const hp = Math.max(IDLE_PIERCE_FLOOR, health?.hp ?? 1)
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
      if (!changed) continue
      layer.wall = wall
      layer.hp = hp
      layer.maxHp = maxHp
    }
  }

  /**
   * Future walls are not physics targets: a bullet that hit the front wall goes on through them (520).
   * Nearest first, with where the bullet's path (x at the front wall, dx per px upward) crosses each.
   */
  behind(x: number, slope: number, fromY: number) {
    return this.layers
      .filter(({ body }) => body.visible)
      .map(({ wall, hp, body }) => {
        const y = body.y - body.displayHeight / 2
        const half = body.displayWidth / 2
        return {
          wall,
          hp,
          x: Math.min(body.x + half - 4, Math.max(body.x - half + 4, x + slope * (fromY - y))),
          y,
          top: body.y - body.displayHeight,
        }
      })
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
