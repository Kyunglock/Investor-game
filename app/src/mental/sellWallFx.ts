import type Phaser from 'phaser'

/** 실제 벽 그림을 잘라 날린다. 물리·피해 판정과 분리하고 연속 붕괴에도 48조각만 재사용한다. */
export class SellWallFx {
  private pieces: Phaser.GameObjects.Image[] = []
  private next = 0

  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  shatter(wall: Phaser.GameObjects.Image, reduced: boolean) {
    const cols = 6
    const rows = 2
    const width = wall.displayWidth
    const height = wall.displayHeight
    for (let i = 0; i < cols * rows; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const index = this.next++ % 48
      this.pieces[index] ??= this.scene.add.image(0, 0, wall.texture.key).setDepth(7)
      const piece = this.pieces[index]
      this.scene.tweens.killTweensOf(piece)
      piece.setTexture(wall.texture.key)
      const cx = (col + 0.5) / cols
      const cy = (row + 0.5) / rows
      piece
        .setOrigin(cx, cy)
        .setCrop(
          (col * piece.width) / cols,
          (row * piece.height) / rows,
          piece.width / cols,
          piece.height / rows,
        )
        .setDisplaySize(width, height)
        .setPosition(wall.x + (cx - 0.5) * width, wall.y + (cy - 0.5) * height)
        .setRotation(0)
        .setAlpha(1)
        .setVisible(true)
        .clearTint()
      const x = piece.x
      const y = piece.y
      // 짧게 터진 뒤 중력으로 떨어진다. 화면과 살아 있는 벽의 위치는 유지한다.
      this.scene.tweens.add({
        targets: piece,
        alpha: 0,
        duration: reduced ? 160 : 580 + (i % 3) * 40,
        onUpdate: (tween) => {
          const t = tween.progress
          piece.setAlpha(1 - t * t)
          if (!reduced) {
            piece.setPosition(x + (cx - 0.5) * 150 * t, y - (row ? 45 : 105) * t + 190 * t * t)
            piece.setRotation((i % 2 ? 1 : -1) * t * (0.8 + col * 0.18))
          }
        },
        onComplete: () => piece.setVisible(false),
      })
    }
  }
}
