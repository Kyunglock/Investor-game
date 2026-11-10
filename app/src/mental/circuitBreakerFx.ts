import type Phaser from 'phaser'
import { CIRCUIT_BREAKER, type CircuitBreaker } from './circuitBreaker'

/** 거래 정지 전광판·쌓이는 주문서·사장냥으로 모이는 회복 빛. 전투 객체와 분리해 일시정지에도 제자리를 지킨다. */
export class CircuitBreakerFx {
  private root: Phaser.GameObjects.Container
  private ink: Phaser.GameObjects.Graphics
  private title: Phaser.GameObjects.Text
  private orders: Phaser.GameObjects.Text
  private recovery: Phaser.GameObjects.Text
  constructor(scene: Phaser.Scene) {
    this.ink = scene.add.graphics()
    const text = (size: number, color: string) =>
      scene.add
        .text(0, 0, '', { fontFamily: 'Jua, sans-serif', fontSize: size, color, align: 'center' })
        .setOrigin(0.5)
    this.title = text(23, '#ffe5a0')
    this.orders = text(15, '#cee6ff')
    this.recovery = text(18, '#abffe0')
    this.root = scene.add
      .container(0, 0, [this.ink, this.title, this.orders, this.recovery])
      .setDepth(35)
  }
  draw(
    c: CircuitBreaker,
    w: number,
    h: number,
    playerX: number,
    playerY: number,
    reduced: boolean,
  ) {
    const g = this.ink.clear()
    const cx = w / 2
    const width = Math.min(w - 32, 330)
    const top = h * 0.27
    g.fillStyle(0x102a40, 0.94).fillRoundedRect(cx - width / 2, top, width, 190, 20)
    g.lineStyle(2, 0xf6c86a, 1).strokeRoundedRect(cx - width / 2, top, width, 190, 20)
    // 위쪽 거래 정지 표시등. 번쩍임 대신 느리게 밝아진다.
    g.fillStyle(0xffcf70, reduced ? 1 : 0.7 + Math.sin(c.elapsed * 3) * 0.2)
    g.fillRoundedRect(cx - 47, top + 11, 94, 4, 2)
    this.title
      .setPosition(cx, top + 39)
      .setText(`서킷브레이커 · ${Math.ceil(CIRCUIT_BREAKER.seconds - c.elapsed)}초`)
    // 양쪽에서 날아와 3단 주문 더미로 정렬된다.
    for (let i = 0; i < CIRCUIT_BREAKER.orders; i++) {
      const t = Math.max(0, Math.min(1, c.progress * CIRCUIT_BREAKER.orders - i))
      if (t === 0) continue
      const x = cx + (i % 2 === 0 ? -49 : 49) + (reduced ? 0 : (1 - t) * (i % 2 === 0 ? -60 : 60))
      const y = top + 78 + Math.floor(i / 2) * 13
      g.fillStyle(0x0a192c, t * 0.5).fillRoundedRect(x - 40, y + 3, 80, 32, 5)
      g.fillStyle(0x77b6ed, t).fillRoundedRect(x - 40, y, 80, 30, 5)
      g.lineStyle(1.5, 0xd9efff, t).strokeRoundedRect(x - 40, y, 80, 30, 5)
      g.lineStyle(2, 0x245483, t)
        .lineBetween(x - 28, y + 10, x + 7, y + 10)
        .lineBetween(x - 28, y + 19, x + 23, y + 19)
    }
    this.orders
      .setPosition(cx, top + 158)
      .setText(`매도 대기 ${(c.queued * CIRCUIT_BREAKER.sharesPerOrder).toLocaleString()}주`)
    g.fillStyle(0x27485b).fillRoundedRect(cx - width / 2 + 18, top + 177, width - 36, 4, 2)
    g.fillStyle(0x8ef3c6).fillRoundedRect(
      cx - width / 2 + 18,
      top + 177,
      (width - 36) * c.progress,
      4,
      2,
    )
    // 멘탈 회복이 사장냥으로 들어오는 궤적과 십자 빛.
    const pulse = reduced ? 0.5 : (c.elapsed % 1.2) / 1.2
    g.lineStyle(3, 0x8ef3c6, 0.8 * (1 - pulse)).strokeEllipse(
      playerX,
      playerY + 12,
      60 + pulse * 70,
      22 + pulse * 24,
    )
    for (let i = 0; i < 5; i++) {
      const t = reduced ? 0.5 : (c.elapsed * 0.6 + i / 5) % 1
      const x = playerX + Math.sin(i * 2.4) * 50 * (1 - t)
      const y = playerY - 75 * (1 - t)
      g.fillStyle(0xb4ffe2, 0.8)
        .fillRect(x - 5, y - 1.5, 10, 3)
        .fillRect(x - 1.5, y - 5, 3, 10)
    }
    this.recovery
      .setPosition(playerX, playerY - 88)
      .setText(
        c.recovery > 0 ? `멘탈 회복 +${Math.round(c.recovery * c.progress)}` : '멘탈 충전 완료',
      )
  }
  destroy() {
    this.root.destroy(true)
  }
}
