import type Phaser from 'phaser'
import { buyOrderTexture, CELL_TEX, WALL_LABEL_STYLE } from './art'
import { BUY_ORDER_SPEED, type BuyWall } from './buyWall'
import { type BarrierLane, OrderBarrierQueue } from './orderBarrier'
import { shareLabel } from './shares'

/** 손절 (591번)로 떼어 낸 매수벽 반쪽이 매도벽까지 날아가는 시간(전투 초)과, 맞힌 뒤에도 떼어 낸 자리를 비워 두는 시간. */
const TOSS_SECONDS = 0.45
const TOSS_GAP_SECONDS = 0.3

/** 붉은색 장난감 매수벽. 단일 벽의 체력·재건·지원 사격은 기존 규칙을 따른다. */
export class BuyWallFx {
  private circuitQueue = new OrderBarrierQueue()
  private ink: Phaser.GameObjects.Graphics
  private surface: Phaser.GameObjects.Image
  private title: Phaser.GameObjects.Text
  private hitLeft = 0
  /** 배속과 별개로 유지하는 강화 외형. 실제 무적 판정은 BuyWall이 맡는다. */
  private fortifyLeft = 0
  private breakLeft = 0
  private hitX = 0
  private debris: Phaser.GameObjects.Image[]
  /** 손절 (591번)로 떼어 던지는 매수벽 반쪽. tossAt은 날아간 정도(0~1)이고 던지지 않을 때는 -1이다. */
  private chunk: Phaser.GameObjects.Image
  private tossAt = -1
  private tossTo = { x: 0, y: 0 }
  /** 반쪽이 떨어져 나간 자리를 비워 두는 남은 시간(초): 날아가는 동안과 맞힌 뒤 잠깐. */
  private gapLeft = 0
  private shots: {
    x: number
    y: number
    damage: number
    active: boolean
    /** 매수세례의 주문 (503번): 벽에 닿은 피해를 따로 센다. */
    barrage: boolean
    body: Phaser.GameObjects.Image
  }[]
  private scene: Phaser.Scene
  private orderScale: number
  /** 매수 주문이 날아가는 빠르기의 배율 (558번): 자동 전투에서는 늦춘다. */
  private speedScale: number
  constructor(scene: Phaser.Scene, orderScale: number, speedScale = 1) {
    this.scene = scene
    this.speedScale = speedScale
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
    this.chunk = scene.add
      .image(0, 0, 'buy-wall')
      .setOrigin(0.75, 0.5)
      .setDepth(7)
      .setVisible(false)
    this.chunk.setCrop(this.chunk.width / 2, 0, this.chunk.width / 2, this.chunk.height)
    // 남은 물량은 벽 앞에 선 고양이의 스킬 그림(깊이 7)에 가려지지 않게 그 위에 적는다 (#916).
    this.title = scene.add
      .text(0, 0, '', { ...WALL_LABEL_STYLE })
      .setOrigin(0.5)
      .setDepth(7.5)
    this.shots = []
  }

  impact(x: number, broken: boolean) {
    this.hitX = x
    this.hitLeft = 0.28
    if (broken) this.breakLeft = 0.55
  }
  fortify() {
    this.fortifyLeft = 5
  }
  /** 손절: 매수벽의 오른쪽 반을 뚝 떼어 던지기 시작한다. */
  tear() {
    this.tossAt = 0
    this.gapLeft = TOSS_SECONDS + TOSS_GAP_SECONDS
  }
  get tossing() {
    return this.tossAt >= 0
  }
  /** 던진 반쪽을 (x, y)로 날린다. 이번에 닿았으면 true다. */
  stepToss(dt: number, x: number, y: number): boolean {
    if (this.tossAt < 0) return false
    this.tossTo = { x, y }
    this.tossAt += dt / TOSS_SECONDS
    if (this.tossAt < 1) return false
    this.tossAt = -1
    this.gapLeft = TOSS_GAP_SECONDS
    return true
  }
  stepFortify(realSeconds: number) {
    this.fortifyLeft = Math.max(0, this.fortifyLeft - realSeconds)
  }
  inspect() {
    return {
      fortifySecondsLeft: this.fortifyLeft,
      fortified: this.fortifyLeft > 0 && this.surface.visible,
      label: this.title.text,
      tossing: this.tossing,
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
  launch(x: number, y: number, damage: number, barrage = false) {
    const texture = buyOrderTexture(this.scene, damage)
    let shot = this.shots.find((s) => !s.active)
    if (!shot) {
      shot = {
        x,
        y,
        damage,
        active: false,
        barrage,
        body: this.scene.add.image(x, y, texture).setDepth(6),
      }
      this.shots.push(shot)
    }
    Object.assign(shot, { x, y, damage, active: true, barrage })
    shot.body.setTexture(texture).setScale(this.orderScale).setPosition(x, y).setVisible(true)
  }

  /** hit는 이번에 쓰고 남은 매수 수량(전투 단위)을 돌려준다: 0이면 주문이 사라지고, 줄었으면 남은 수량으로 계속 날아간다. */
  step(
    dt: number,
    hit: (x: number, fromY: number, toY: number, damage: number, barrage: boolean) => number,
  ) {
    this.hitLeft = Math.max(0, this.hitLeft - dt)
    this.breakLeft = Math.max(0, this.breakLeft - dt)
    if (this.tossAt < 0) this.gapLeft = Math.max(0, this.gapLeft - dt)
    for (const shot of this.shots) {
      if (!shot.active) continue
      const next = shot.y - dt * BUY_ORDER_SPEED * this.speedScale
      const left = hit(shot.x, shot.y, next, shot.damage, shot.barrage)
      if (left <= 1e-6 || next < -30) shot.active = false
      else if (left < shot.damage) {
        shot.damage = left
        shot.body.setTexture(buyOrderTexture(this.scene, left))
      }
      shot.y = next
      shot.body.setPosition(shot.x, shot.y).setVisible(shot.active)
    }
  }
  /** 날아가던 매수 주문을 모두 없앤다 (549번): 보스 도전의 서킷브레이커가 걸릴 때. */
  clearOrders() {
    for (const shot of this.shots) {
      shot.active = false
      shot.body.setVisible(false)
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
      // 손절로 반쪽을 떼어 낸 동안에는 왼쪽 반만 남는다.
      if (this.gapLeft > 0) {
        this.surface.setCrop(0, 0, this.surface.width / 2, this.surface.height)
      } else this.surface.setCrop()
      this.surface.clearTint()
      if (this.hitLeft > 0.2) this.surface.setTintFill(0xffedc2)
      if (this.fortifyLeft > 0) {
        const alpha = reduced ? 1 : Math.min(1, this.fortifyLeft / 0.25)
        const x = left + shake
        const z = top + Math.abs(shake) * 0.4
        // 기존 붉은 블록 위에 보호막과 두꺼운 보강대를 얹어 벽 자체가 단단해 보이게 한다.
        g.lineStyle(8, 0x72e4ef, 0.2 * alpha).strokeRoundedRect(
          x - 2,
          z - 3,
          width + 4,
          height + 6,
          9,
        )
        g.fillStyle(0xffe8a3, 0.18 * alpha).fillRoundedRect(x, z, width, height, 7)
        for (const railY of [z + 2, z + height - 8]) {
          g.fillStyle(0x805334, alpha).fillRoundedRect(x + 2, railY, width - 4, 7, 3)
          g.fillStyle(0xffd477, alpha).fillRoundedRect(x + 3, railY, width - 6, 4, 2)
        }
        for (let i = 0; i <= 6; i++) {
          const braceX = x + 4 + ((width - 8) * i) / 6
          g.fillStyle(0x805334, alpha).fillRoundedRect(braceX - 4, z + 3, 8, height - 6, 2)
          g.fillStyle(0xeebd63, alpha).fillRoundedRect(braceX - 2, z + 3, 4, height - 8, 1)
          for (const boltY of [z + 8, z + height - 10]) {
            g.fillStyle(0x614635, alpha).fillCircle(braceX, boltY + 1, 2.6)
            g.fillStyle(0xfff4ce, alpha).fillCircle(braceX, boltY, 1.7)
          }
        }
      }
      // 벽 밑의 체력 막대는 없앴다 (583번): 남은 수량은 벽 위의 숫자와 절반에서 금 가는 그림이 알린다.
      this.title.setText(shareLabel(wall.hp)).setPosition(left + width / 2, top + height * 0.58)
    } else {
      this.surface.setVisible(false)
      g.lineStyle(1, 0xe78181, 0.6).strokeRoundedRect(left, y - 30, width, 52, 7)
      this.title.setText(`재정비 ${wall.rebuildLeft.toFixed(1)}초`).setPosition(left + width / 2, y)
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
    // 떼어 낸 반쪽: 잠깐 들썩이다가 점점 빨라지며 돌면서 매도벽으로 날아간다.
    this.chunk.setVisible(this.tossAt >= 0)
    if (this.tossAt >= 0) {
      const fly = this.tossAt * this.tossAt
      const fromX = left + width * 0.75
      const fromY = top + height / 2
      const grow = 1 + Math.sin(this.tossAt * Math.PI) * 0.25
      this.chunk
        .setDisplaySize(width * grow, height * grow)
        .setPosition(
          fromX + (this.tossTo.x - fromX) * fly,
          fromY +
            (this.tossTo.y - fromY) * fly -
            Math.sin(Math.min(1, this.tossAt * 4) * Math.PI) * 8,
        )
        .setAngle(fly * 360)
      // 떨어져 나간 자리의 테두리.
      g.lineStyle(2, 0x8fc4ff, 0.7).strokeRoundedRect(left + width / 2, top, width / 2, height, 7)
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
