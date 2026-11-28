import type Phaser from 'phaser'

/** 입에 모여드는 불씨와 겹겹이 일렁이는 불줄기를 전투 시계에 맞춰 그린다. */
export function drawGuardianBreath(
  fire: Phaser.GameObjects.Graphics,
  mouthX: number,
  mouthY: number,
  targetX: number,
  targetY: number,
  charge: number,
  jet: number,
  reach: number,
  strength: number,
) {
  fire.clear()
  const radius = 2 + 7 * strength
  fire.fillStyle(0xff7022, 0.34 * strength).fillCircle(mouthX, mouthY, radius * 1.55)
  fire.fillStyle(0xffbc43, strength).fillCircle(mouthX, mouthY, radius)
  fire.fillStyle(0xfff6c6, strength).fillCircle(mouthX, mouthY, radius * 0.54)
  if (charge > 0 && jet === 0) {
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + charge
      const distance = radius + (1 - charge) * 31
      const x = mouthX + Math.cos(angle) * distance
      const y = mouthY + Math.sin(angle) * distance
      fire
        .lineStyle(2, 0xffcf61, charge)
        .lineBetween(x, y, x + Math.cos(angle) * 7, y + Math.sin(angle) * 7)
    }
  }
  if (reach <= 0) return
  const width = Math.min(40, Math.abs(targetY - mouthY) * 0.19) * strength
  const phase = jet * 24
  // 가장자리의 불혀는 서로 다른 위상으로 흐르고, 중심으로 갈수록 밝아진다.
  for (const [spread, color] of [
    [1, 0xb33b1e],
    [0.77, 0xff8024],
    [0.47, 0xffcf4c],
    [0.18, 0xfff8ce],
  ]) {
    fire.fillStyle(color, strength).beginPath().moveTo(mouthX, mouthY)
    for (const side of [1, -1]) {
      for (let i = 0; i <= 14; i++) {
        const t = ((side === 1 ? i : 14 - i) / 14) * reach
        const wave = Math.sin(t * 26 - phase + side * 2)
        const edge = width * spread * (0.11 + t * (0.76 + 0.23 * wave))
        const x = mouthX + (targetX - mouthX) * t + width * 0.12 * t * Math.sin(t * 12 - phase)
        fire.lineTo(x + side * edge, mouthY + (targetY - mouthY) * t)
      }
    }
    fire.closePath().fillPath()
  }
}
