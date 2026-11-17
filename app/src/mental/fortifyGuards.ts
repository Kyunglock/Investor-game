import type Phaser from 'phaser'
import { CELL_TEX } from './art'

/** 전투 배속과 분리된 화면 연출 시간. 무적 시간과 충돌 판정은 BuyWall이 맡는다. */
const STAY_SECONDS = 5
const FADE_SECONDS = 0.25

export class FortifyGuards {
  private left = 0
  private guards: Phaser.GameObjects.Image[]
  private reducedMotion: boolean

  constructor(scene: Phaser.Scene, reducedMotion: boolean) {
    this.reducedMotion = reducedMotion
    // 재발동 시 고양이가 겹쳐 쌓이지 않고, 장면 종료 때 Phaser가 함께 정리한다.
    this.guards = Array.from({ length: 3 }, () =>
      scene.add.image(0, 0, 'art-shieldGuard').setOrigin(0.5, 1).setDepth(4.6).setVisible(false),
    )
  }

  show() {
    this.left = STAY_SECONDS
    for (const guard of this.guards) guard.setAlpha(1).setVisible(true)
  }

  step(realSeconds: number) {
    this.left = Math.max(0, this.left - realSeconds)
    const alpha = this.reducedMotion ? 1 : Math.min(1, this.left / FADE_SECONDS)
    for (const guard of this.guards) guard.setAlpha(alpha).setVisible(this.left > 0)
  }

  layout(left: number, width: number, wallY: number) {
    const top = wallY + 32 - (width * CELL_TEX.h) / CELL_TEX.w
    const height = Math.min(88, width / 3.8)
    for (const [i, guard] of this.guards.entries()) {
      guard
        .setPosition(left + (width * (i + 1)) / 4, top - 4)
        .setDisplaySize((height * guard.width) / guard.height, height)
    }
  }

  inspect() {
    return {
      secondsLeft: this.left,
      guards: this.guards
        .filter((guard) => guard.visible)
        .map((guard) => ({
          x: guard.x,
          feetY: guard.y,
          width: guard.displayWidth,
          height: guard.displayHeight,
          alpha: guard.alpha,
          texture: guard.texture.key,
        })),
    }
  }
}
