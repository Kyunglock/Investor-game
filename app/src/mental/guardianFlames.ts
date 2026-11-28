import type Phaser from 'phaser'

export const BREATH_SECONDS = 5

const KEY = 'vault-breath-flame'

// 한 장의 불혀를 겹쳐 쓴다. 바깥쪽은 붉고 투명하며 불씨가 붙은 밑동이 가장 밝다.
function bakeFlame(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 96
  const c = canvas.getContext('2d')
  if (!c) return
  const glow = c.createRadialGradient(32, 67, 3, 32, 67, 32)
  glow.addColorStop(0, '#ffb32aad')
  glow.addColorStop(0.45, '#ff6a1a80')
  glow.addColorStop(1, '#d52d0900')
  c.fillStyle = glow
  c.fillRect(0, 0, 64, 96)
  const flame = new Path2D(
    'M32 89 C6 85 11 59 8 47 Q15 52 18 61 C15 40 39 36 29 8 C48 25 34 43 43 51 Q49 41 48 30 C65 55 59 82 32 89Z',
  )
  const heat = c.createLinearGradient(0, 6, 0, 90)
  heat.addColorStop(0, '#c32c1060')
  heat.addColorStop(0.4, '#ff6821d0')
  heat.addColorStop(0.76, '#ffb02bf5')
  heat.addColorStop(1, '#ff8325e0')
  c.fillStyle = heat
  c.fill(flame)
  c.fillStyle = '#ffe279ee'
  c.fill(
    new Path2D(
      'M30 85 C17 80 22 66 29 59 Q33 51 32 44 Q44 56 37 68 Q44 66 47 58 C50 73 44 85 30 85Z',
    ),
  )
  scene.textures.addCanvas(KEY, canvas)
}

export class GuardianFlames {
  private jet: Phaser.GameObjects.Image[]
  private rim: Phaser.GameObjects.Image[]
  private embers: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    bakeFlame(scene)
    const tongues = (count: number, depth: number) =>
      Array.from({ length: count }, () =>
        scene.add.image(0, 0, KEY).setDepth(depth).setOrigin(0.5, 0.84).setVisible(false),
      )
    this.jet = tongues(26, 8.34)
    this.rim = tongues(42, 6.9)
    this.embers = scene.add.graphics().setDepth(6.95)
  }

  drawJet(x: number, y: number, tx: number, ty: number, reach: number, heat: number, time: number) {
    const angle = Math.atan2(ty - y, tx - x) + Math.PI / 2
    const length = Math.hypot(tx - x, ty - y)
    for (const [i, flame] of this.jet.entries()) {
      const t = (i * 0.618 + time * (1.45 + 0.24 * Math.sin(i * 5.1))) % 1
      flame.setVisible(t < reach && heat > 0)
      if (!flame.visible) continue
      const swell = (8 + 35 * t) * heat * (0.86 + 0.22 * Math.cos(i * 3.7))
      const wave = Math.sin(i * 8.3 + time * 10)
      const offset = swell * 0.62 * wave
      flame
        .setPosition(
          x + (tx - x) * t + Math.cos(angle) * offset,
          y + (ty - y) * t + Math.sin(angle) * offset,
        )
        .setRotation(angle + wave * 0.24)
        .setFlipX(i % 2 === 0)
        .setDisplaySize(swell * 1.2, Math.min(length * (reach - t) + 3, swell * 2.7))
        .setAlpha(0.82 * heat * Math.min(1, (1 - t) * 12))
    }
  }

  get jetVisible() {
    return this.jet.some((flame) => flame.visible)
  }

  hideJet() {
    for (const flame of this.jet) flame.setVisible(false)
  }

  drawWall(
    left: number,
    width: number,
    top: number,
    bottom: number,
    impact: number,
    seconds: number,
  ) {
    const g = this.embers.clear()
    const fade = Math.min(1, (BREATH_SECONDS - seconds) * 3)
    const spread = width * (0.06 + seconds * 2.2)
    for (const [i, flame] of this.rim.entries()) {
      const lower = i >= 22 && i < 36
      const side = i >= 36
      const u = side ? i % 2 : lower ? (i - 22) / 13 : i / 21
      const x = left + 4 + u * (width - 8)
      const y = side
        ? top + ((bottom - top) * (1 + Math.floor((i - 36) / 2))) / 4
        : lower
          ? bottom - 3
          : top + 8
      const distance = lower
        ? Math.min(impact - left + x - left, left + width - impact + left + width - x) +
          bottom -
          top
        : Math.abs(x - impact) + (side ? y - top : 0)
      const lit = Math.min(1, Math.max(0, (spread - distance) / 20)) * fade
      flame.setVisible(lit > 0)
      if (!flame.visible) continue
      const phase = seconds * 9 + i * 2.4
      const size = (lower ? 15 : 30) * (0.95 + 0.32 * Math.sin(phase) + 0.19 * Math.cos(i * 5.6))
      flame
        .setPosition(x, y)
        .setFlipX(i % 2 === 0)
        .setRotation((side ? (u === 0 ? -0.64 : 0.64) : 0) + 0.23 * Math.sin(phase * 0.75))
        .setDisplaySize(width * (lower ? 0.1 : 0.09), size * lit)
        .setAlpha(lit)
      if (!lower && !side) {
        const drift = (seconds * 1.4 + i * 0.381) % 1
        g.fillStyle(0xffbd59, lit * (1 - drift)).fillCircle(
          x + Math.sin(phase) * 5,
          y - size * 0.7 - drift * 26,
          1.6 - drift,
        )
      }
    }
  }

  clearWall() {
    this.embers.clear()
    for (const flame of this.rim) flame.setVisible(false)
  }
}
