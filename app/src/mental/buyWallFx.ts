import type Phaser from 'phaser'
import { buyOrderTexture, CELL_TEX, WALL_LABEL_STYLE } from './art'
import type { BuyWall } from './buyWall'
import { type BarrierLane, OrderBarrierQueue } from './orderBarrier'
import { shareLabel } from './shares'

/** 붉은색 장난감 매수벽. 단일 벽의 체력·재건·지원 사격은 기존 규칙을 따른다. */
export class BuyWallFx {
  private circuitQueue = new OrderBarrierQueue()
  private ink: Phaser.GameObjects.Graphics
  private surface: Phaser.GameObjects.Image
  private title: Phaser.GameObjects.Text
  private hitLeft = 0
  private breakLeft = 0
  private hitX = 0
  private debris: Phaser.GameObjects.Image[]
  private shots: {
    x: number
    y: number
    damage: number
    active: boolean
    body: Phaser.GameObjects.Image
  }[]
  private scene: Phaser.Scene
  private orderScale: number
  constructor(scene: Phaser.Scene, orderScale: number) {
    this.scene = scene
    this.orderScale = orderScale
    this.surface = scene.add.image(0, 0, 'buy-wall').setOrigin(0).setDepth(4)
    this.ink = scene.add.graphics().setDepth(4)
    this.debris = Array.from({ length: 12 }, (_, i) => {
      const col = i % 6
      const row = Math.floor(i / 6)
      const piece = scene.add
        .image(0, 0, 'buy-wall-cracked')
        .setOrigin((col + 0.5) / 6, (row + 0.5) / 2)
        .setDepth(5)
        .setVisible(false)
      piece.setCrop(
        (col * piece.width) / 6,
        (row * piece.height) / 2,
        piece.width / 6,
        piece.height / 2,
      )
      return piece
    })
    this.title = scene.add
      .text(0, 0, '', { ...WALL_LABEL_STYLE })
      .setOrigin(0.5)
      .setDepth(6)
    this.shots = []
  }

  impact(x: number, broken: boolean) {
    this.hitX = x
    this.hitLeft = 0.28
    if (broken) this.breakLeft = 0.55
  }
  inspect() {
    return {
      hitLeft: this.hitLeft,
      breakLeft: this.breakLeft,
      fragments: this.debris.filter((piece) => piece.visible).length,
      orders: this.shots
        .filter((shot) => shot.active)
        .map((shot) => ({
          x: shot.x,
          y: shot.y,
          title: '매수',
          amount: shareLabel(shot.damage),
          texture: shot.body.texture.key,
        })),
    }
  }
  launch(x: number, y: number, damage: number) {
    const texture = buyOrderTexture(this.scene, damage)
    let shot = this.shots.find((s) => !s.active)
    if (!shot) {
      shot = { x, y, damage, active: false, body: this.scene.add.image(x, y, texture).setDepth(6) }
      this.shots.push(shot)
    }
    Object.assign(shot, { x, y, damage, active: true })
    shot.body.setTexture(texture).setScale(this.orderScale).setPosition(x, y).setVisible(true)
  }

  /** hit는 이번에 쓰고 남은 매수 수량(전투 단위)을 돌려준다: 0이면 주문이 사라지고, 줄었으면 남은 수량으로 계속 날아간다. */
  step(dt: number, hit: (x: number, fromY: number, toY: number, damage: number) => number) {
    this.hitLeft = Math.max(0, this.hitLeft - dt)
    this.breakLeft = Math.max(0, this.breakLeft - dt)
    for (const shot of this.shots) {
      if (!shot.active) continue
      const next = shot.y - dt * 360
      const left = hit(shot.x, shot.y, next, shot.damage)
      if (left <= 1e-6 || next < -30) shot.active = false
      else if (left < shot.damage) {
        shot.damage = left
        shot.body.setTexture(buyOrderTexture(this.scene, left))
      }
      shot.y = next
      shot.body.setPosition(shot.x, shot.y).setVisible(shot.active)
    }
  }
  beginCircuit() {
    this.circuitQueue.clear()
  }
  endCircuit() {
    this.circuitQueue.clear()
  }
  get queuedOrders() {
    return this.circuitQueue.size
  }
  holdOrders(dt: number, lane: BarrierLane) {
    // 가까운 주문부터 먼저 세워 뒤에서 온 주문이 그 뒤로 쌓이게 한다.
    const active = this.shots.filter((shot) => shot.active).sort((a, b) => a.y - b.y)
    for (const shot of active) {
      this.circuitQueue.move(shot, dt, lane, 'buy')
      shot.body.setPosition(shot.x, shot.y)
    }
  }
  draw(wall: BuyWall, left: number, width: number, y: number, reduced: boolean) {
    const g = this.ink.clear()
    const cw = width / 6
    const height = (width * CELL_TEX.h) / CELL_TEX.w
    const top = y + 32 - height
    const hit = this.hitLeft / 0.28
    const shake = reduced ? 0 : Math.sin((1 - hit) * Math.PI * 5) * hit * 7
    if (wall.active) {
      this.surface
        .setVisible(true)
        .setTexture(wall.hp < wall.maxHp * 0.5 ? 'buy-wall-cracked' : 'buy-wall')
        .setPosition(left + shake, top + Math.abs(shake) * 0.4)
        .setDisplaySize(width, height)
      this.surface.clearTint()
      if (this.hitLeft > 0.2) this.surface.setTintFill(0xffedc2)
      // 블록 하단(y + 32)을 덮지 않도록 체력 막대를 5px 아래에 둔다.
      g.fillStyle(0x4f2837, 0.7).fillRoundedRect(left + 5, y + 37, width - 10, 4, 2)
      const hpWidth = ((width - 10) * wall.hp) / wall.maxHp
      if (hpWidth > 0) {
        g.fillStyle(0xffdc87).fillRoundedRect(
          left + 5,
          y + 37,
          hpWidth,
          4,
          Math.min(2, hpWidth / 2),
        )
      }
      this.title
        .setText(`매수벽 ${shareLabel(wall.hp)} / ${shareLabel(wall.maxHp)}`)
        .setPosition(left + width / 2, top + height * 0.58)
    } else {
      this.surface.setVisible(false)
      g.lineStyle(1, 0xe78181, 0.6).strokeRoundedRect(left, y - 30, width, 52, 7)
      this.title
        .setText(`매수벽 붕괴 · 재정비 ${wall.rebuildLeft.toFixed(1)}초`)
        .setPosition(left + width / 2, y)
    }
    if (hit > 0) {
      const radius = 12 + (1 - hit) * 34
      g.lineStyle(4, 0xffb05b, hit).strokeCircle(this.hitX, y - 18, radius)
      g.lineStyle(2, 0xfff4d6, hit).strokeCircle(this.hitX, y - 18, radius * 0.7)
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3
        g.lineBetween(
          this.hitX + Math.cos(angle) * radius,
          y - 18 + Math.sin(angle) * radius,
          this.hitX + Math.cos(angle) * (radius + 12),
          y - 18 + Math.sin(angle) * (radius + 12),
        )
      }
    }
    // 파편은 새 벽의 체력/활성 상태와 별도로 그려 즉시 재생성되어도 붕괴가 보인다.
    const fall = 1 - this.breakLeft / 0.55
    for (const [i, piece] of this.debris.entries()) {
      const col = i % 6
      const row = Math.floor(i / 6)
      piece
        .setVisible(this.breakLeft > 0)
        .setDisplaySize(width, height)
        .setPosition(
          left + (col + 0.5) * cw + (reduced ? 0 : (col - 2.5) * fall * 26),
          top +
            ((row + 0.5) * height) / 2 +
            (reduced ? 0 : (row ? 45 : -30) * Math.sin(fall * Math.PI) + fall * fall * 85),
        )
        .setAngle(reduced ? 0 : (i % 2 ? 1 : -1) * fall * 35)
        .setAlpha(1 - fall)
    }
    // 강화로 물량 자릿수가 늘어나도 벽 밖으로 넘치지 않게 한다.
    this.title.setScale(Math.min(1, (width - 20) / Math.max(1, this.title.width)))
  }
}
