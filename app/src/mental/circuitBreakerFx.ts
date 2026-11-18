import type Phaser from 'phaser'
import { DPR } from './art'
import { CIRCUIT_BREAKER, type CircuitBreaker } from './circuitBreaker'
import type { BarrierLane } from './orderBarrier'

/** 실제 대기 주문 사이에 내려오는 검정·노랑 안전 차단벽. */
export class CircuitBreakerFx {
  private root: Phaser.GameObjects.Container
  private ink: Phaser.GameObjects.Graphics
  private title: Phaser.GameObjects.Text
  private orders: Phaser.GameObjects.Text
  constructor(scene: Phaser.Scene) {
    this.ink = scene.add.graphics()
    const text = (size: number, color: string) =>
      scene.add
        .text(0, 0, '', {
          fontFamily: '"Jua", "Gowun Dodum", "Noto Sans KR", sans-serif',
          fontSize: size,
          color,
          align: 'center',
          resolution: DPR,
          padding: { x: 4, y: 3 },
        })
        .setOrigin(0.5)
    this.title = text(23, '#ffe17b')
    this.orders = text(13, '#ffffff')
    this.root = scene.add.container(0, 0, [this.ink, this.title, this.orders]).setDepth(35)
    // 캔버스에서 처음 쓰는 한글 서브셋도 로드한 뒤 다시 그린다.
    void document.fonts
      .load('23px "Jua"', '서킷브레이커 거래 정지 · 매수벽 멘탈 회복 충전 완료 +,주 0123456789')
      .then(() => {
        if (this.root.active) for (const label of [this.title, this.orders]) label.updateText()
      })
      .catch(() => {
        /* 준비된 한글 대체 글꼴을 유지한다. */
      })
  }
  /** note는 정지 동안 차는 것(매수벽·멘탈 회복)을 알리는 말이다. 고양이 줄을 가리지 않게 차단벽의 둘째 줄에 함께 적는다 (#913). */
  draw(
    c: CircuitBreaker,
    w: number,
    h: number,
    playerX: number,
    playerY: number,
    reduced: boolean,
    barrier: BarrierLane,
    note: string,
  ) {
    const g = this.ink.clear()
    const cx = barrier.left + barrier.width / 2
    const y = Math.round(barrier.y)
    const enter = Math.min(1, c.elapsed / 0.24)
    const opening = Math.max(
      0,
      (c.elapsed - (CIRCUIT_BREAKER.seconds - CIRCUIT_BREAKER.openSeconds)) /
        CIRCUIT_BREAKER.openSeconds,
    )
    const slide = reduced ? 0 : ((1 - enter) ** 3 + opening ** 2) * (barrier.width / 2 + 20)
    g.fillStyle(0x142230, 0.08 * (1 - opening)).fillRect(0, 0, w, h)
    for (const side of [-1, 1]) {
      const half = barrier.width / 2
      const left = cx + (side < 0 ? -half : 0) + side * slide
      const right = left + half
      g.fillStyle(0x201f23).fillRoundedRect(left, y - 32, half, 64, 5)
      g.lineStyle(2, 0xffce4e).strokeRoundedRect(left, y - 32, half, 64, 5)
      // 경고 줄무늬는 글자 위아래에만 배치한다.
      for (const top of [y - 30, y + 21]) {
        g.fillStyle(0xffce4e).fillRect(left + 2, top, half - 4, 9)
        g.fillStyle(0x27242a)
        for (let x = left + 2; x < right - 2; x += 22) {
          g.fillPoints(
            [
              { x, y: top + 9 },
              { x: Math.min(x + 9, right - 2), y: top },
              { x: Math.min(x + 18, right - 2), y: top },
              { x: Math.min(x + 9, right - 2), y: top + 9 },
            ],
            true,
          )
        }
      }
    }
    // 닫힌 두 문짝의 중앙 이음선이 한글 획을 가르지 않게 가린다.
    if (slide < 2) g.fillStyle(0x201f23).fillRect(cx - 3, y - 20, 6, 40)
    const alpha = Math.min(1, enter * 2) * (1 - opening)
    this.title
      .setPosition(Math.round(cx), y - 10)
      .setAlpha(alpha)
      .setText('서킷브레이커')
    this.orders
      .setPosition(Math.round(cx), y + 11)
      .setAlpha(alpha)
      .setText(note ? `거래 정지 · ${note}` : '거래 정지')
    for (const [label, size] of [
      [this.title, 23],
      [this.orders, 13],
    ] as const) {
      label.setFontSize(size)
      if (label.width > barrier.width - 20)
        label.setFontSize(Math.floor((size * (barrier.width - 20)) / label.width))
    }
    const pulse = reduced ? 0.5 : (c.elapsed % 1.2) / 1.2
    g.lineStyle(2, 0x53bfa4, 0.7 * (1 - pulse)).strokeEllipse(
      playerX,
      playerY + 12,
      56 + pulse * 38,
      20 + pulse * 14,
    )
  }
  destroy() {
    this.root.destroy(true)
  }
}
