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
    wall: { left: number; width: number; bottom: number; height: number },
  ) {
    const g = this.ink.clear()
    const cx = w / 2
    const width = Math.min(w - 32, 330)
    const top = Math.max(h * 0.3, wall.bottom + 24)
    g.fillStyle(0x102a40, 0.94).fillRoundedRect(cx - width / 2, top, width, 112, 20)
    g.lineStyle(2, 0xf6c86a, 1).strokeRoundedRect(cx - width / 2, top, width, 112, 20)
    g.fillStyle(0xffcf70, reduced ? 1 : 0.7 + Math.sin(c.elapsed * 3) * 0.2)
    g.fillRoundedRect(cx - 47, top + 11, 94, 4, 2)
    this.title
      .setPosition(cx, top + 38)
      .setText(`서킷브레이커 · ${Math.ceil(CIRCUIT_BREAKER.seconds - c.elapsed)}초`)
    this.orders
      .setPosition(cx, top + 72)
      .setText(
        c.formation < 1
          ? `매도 조각 집결 · ${c.assembled}/${CIRCUIT_BREAKER.pieces}`
          : '매도벽 완성! 거래 재개 준비',
      )
    g.fillStyle(0x27485b).fillRoundedRect(cx - width / 2 + 18, top + 94, width - 36, 4, 2)
    g.fillStyle(0x8ef3c6).fillRoundedRect(
      cx - width / 2 + 18,
      top + 94,
      (width - 36) * c.progress,
      4,
      2,
    )
    // 전광판 속 그림이 아니라 다음 전투 벽의 실제 위치에 주문 조각 24개를 쌓는다.
    const cols = 6
    const rows = CIRCUIT_BREAKER.pieces / cols
    const bw = wall.width / cols
    const bh = wall.height / rows
    const alpha = 1 - c.reveal
    g.lineStyle(1, 0x8bbdf3, 0.35 * alpha).strokeRect(
      wall.left,
      wall.bottom - wall.height,
      wall.width,
      wall.height,
    )
    for (let i = 0; i < CIRCUIT_BREAKER.pieces; i++) {
      const t = Math.max(0, Math.min(1, (c.formation * (CIRCUIT_BREAKER.pieces + 2) - i) / 3))
      if (t === 0) continue
      const row = Math.floor(i / cols)
      const col = i % cols
      const tx = wall.left + (col + 0.5) * bw
      const ty = wall.bottom - (row + 0.5) * bh
      const fromX = i % 2 === 0 ? -bw : w + bw
      const ease = 1 - (1 - t) ** 3
      const x = reduced ? tx : fromX + (tx - fromX) * ease
      const y = reduced ? ty : ty - Math.sin(t * Math.PI) * 55 - (1 - ease) * 45
      const visible = alpha * (reduced ? t : Math.min(1, t * 4))
      g.fillStyle(0x0b2449, visible).fillRoundedRect(
        x - bw / 2 + 2,
        y - bh / 2 + 3,
        bw - 3,
        bh - 2,
        3,
      )
      g.fillStyle(i % 3 === 0 ? 0x3472c9 : 0x64a6e9, visible).fillRoundedRect(
        x - bw / 2 + 1,
        y - bh / 2,
        bw - 3,
        bh - 3,
        3,
      )
      g.lineStyle(1.5, 0xbde1ff, visible).strokeRoundedRect(
        x - bw / 2 + 1,
        y - bh / 2,
        bw - 3,
        bh - 3,
        3,
      )
      g.lineStyle(2, 0x173e79, visible)
        .lineBetween(x - bw * 0.3, y - 3, x + bw * 0.18, y - 3)
        .lineBetween(x - bw * 0.3, y + 3, x + bw * 0.3, y + 3)
      if (!reduced && t > 0.8 && t < 1) {
        g.lineStyle(2, 0xe2f5ff, (1 - t) * 5).strokeEllipse(tx, ty + bh / 2, bw * 1.25, 10)
      }
    }
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
      .setPosition(Math.max(80, Math.min(w - 80, playerX)), playerY - 88)
      .setText(
        c.recovery > 0 ? `멘탈 회복 +${Math.round(c.recovery * c.progress)}` : '멘탈 충전 완료',
      )
  }
  destroy() {
    this.root.destroy(true)
  }
}
