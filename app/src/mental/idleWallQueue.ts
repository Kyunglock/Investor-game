import type Phaser from 'phaser'
import { CELL_CRACKS, cellKey, WALL_LABEL_STYLE } from './art'
import { cellShares } from './assault'
import { IDLE_PIERCE_FLOOR, idleBossWall } from './idlePierce'

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

/** 뒤 벽에 적는 남은 물량: 맨 앞 벽의 칸과 같은 환산(10주 단위)으로 "7,200주"만 적는다 (542번). */
export function queuedWallLabel(maxHp: number, hp: number) {
  return `${cellShares(maxHp, hp).toLocaleString()}주`
}

/**
 * 뒤 벽(wall)의 체력: 받은 값에 그 벽이 있으면 그것, 없으면 이미 그리던 같은 벽의 값을 그대로 둔다. 둘 다 없으면 모른다(undefined):
 * 모르는 체력을 지어내 적지 않는다. 전에는 체력 1로 그려, 앞 벽이 부서지는 순간 다음 벽이 "200주"로 보였다가 제 체력으로 돌아왔다.
 */
export function queuedWallHealth(
  wall: number,
  known: readonly UpcomingWall[],
  shown: readonly UpcomingWall[] = [],
): UpcomingWall | undefined {
  return (
    known.find((entry) => entry.wall === wall) ??
    shown.find((entry) => entry.wall === wall && entry.maxHp > 0)
  )
}

/**
 * Server-owned health for the two walls behind the current target. Each carries its remaining
 * shares and nothing else (decisions.md 542; 507 had removed every text).
 * Piercing bullets and the aurora can hit them. They keep their last point until they come to the front.
 */
export class IdleWallQueueFx {
  private layers: {
    wall: number
    hp: number
    maxHp: number
    body: Phaser.GameObjects.Image
    label: Phaser.GameObjects.Text
  }[]

  constructor(scene: Phaser.Scene) {
    this.layers = Array.from({ length: UPCOMING_WALLS }, () => ({
      wall: 0,
      hp: 0,
      maxHp: 0,
      body: scene.add.image(0, 0, cellKey(0)).setOrigin(0.5, 1).setDepth(2.2).setVisible(false),
      // 맨 앞 벽 칸과 같은 글자(바탕 딱지 없이)로 적는다. 피해 숫자(깊이 8)가 지나가도 가리지 않게 그 위에 둔다.
      label: scene.add
        .text(0, 0, '', { ...WALL_LABEL_STYLE })
        .setOrigin(0.5)
        .setDepth(8.5)
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
      const health = queuedWallHealth(wall, upcoming, this.layers)
      // 뒤 벽은 0으로 보이지 않는다: 서버와 같이 1을 남긴다 (520번).
      const hp = health ? Math.max(IDLE_PIERCE_FLOOR, health.hp) : 0
      const maxHp = health?.maxHp ?? 0
      const crack = Math.min(
        CELL_CRACKS - 1,
        health ? Math.floor((1 - hp / Math.max(1, maxHp)) * CELL_CRACKS) : 0,
      )
      const changed = layer.wall !== wall || layer.hp !== hp || layer.maxHp !== maxHp
      layer.body
        .setTexture(cellKey(Math.max(0, crack), idleBossWall(wall)))
        .setPosition(left + width / 2, y)
        .setDisplaySize(width - 3, height - 3)
        .setAlpha(0.9 - i * 0.13)
        .setVisible(true)
      // 맨 앞 벽 칸처럼 벽 한가운데에 같은 크기로 적는다.
      layer.label
        .setPosition(left + width / 2, y - (height - 3) / 2 + 1)
        .setAlpha(0.95 - i * 0.13)
        .setVisible(true)
      if (!changed) continue
      layer.label.setText(health ? queuedWallLabel(maxHp, hp) : '')
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
    return this.layers.map(({ wall, body, label, hp, maxHp }) => ({
      wall,
      hp,
      maxHp,
      label: label.visible ? label.text : '',
      crack: body.texture.key,
      top: body.y - body.displayHeight,
      bottom: body.y,
      visible: body.visible,
      boss: idleBossWall(wall),
    }))
  }
}
