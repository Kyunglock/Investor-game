import type Phaser from 'phaser'

// 원화를 640 × 320 좌표로 봤을 때의 아래턱 외곽. 입술 경계를 따라 원래 비늘을 잘라 쓴다.
const lip =
  'M235 297 Q237 282 250 270 Q254 276 263 274 Q280 264 301 273 L321 281 Q341 270 356 269 Q368 267 377 274 Q387 278 395 269 Q402 280 406 299'
const KEY = 'vault-guardian-jaw'
const STEPS = 16
const DROP = 50
const LEFT = 229
const TOP = 262
const WIDTH = 183
const HEIGHT = 110

/** 입 안과 송곳니는 위턱에 고정하고, 원화의 아래턱만 내려가는 프레임을 한 번 굽는다. */
export function createGuardianJaw(scene: Phaser.Scene) {
  if (!scene.textures.exists(KEY)) {
    const source = scene.textures.get('vault-guard').getSourceImage() as HTMLImageElement
    const sheet = document.createElement('canvas')
    sheet.width = WIDTH * 2 * 4
    sheet.height = HEIGHT * 2 * 4
    const c = sheet.getContext('2d')
    if (!c) return
    const chin = new Path2D(`${lip} L411 320 H230 Z`)
    for (let i = 0; i < STEPS; i++) {
      const drop = (DROP * (i + 1)) / STEPS
      const x = (i % 4) * WIDTH * 2
      const y = Math.floor(i / 4) * HEIGHT * 2
      c.save()
      c.setTransform(2, 0, 0, 2, x - LEFT * 2, y - TOP * 2)
      const cavity = new Path2D(lip)
      cavity.lineTo(403, 300 + drop)
      cavity.quadraticCurveTo(318, 324 + drop, 238, 300 + drop)
      cavity.closePath()
      c.clip(cavity)
      const throat = c.createRadialGradient(321, 280 + drop * 0.48, 1, 321, 280 + drop * 0.48, 77)
      throat.addColorStop(0, '#ea6622')
      throat.addColorStop(0.23, '#963118')
      throat.addColorStop(0.62, '#391518')
      throat.addColorStop(1, '#130d12')
      c.fillStyle = throat
      c.fill(cavity)
      for (const [tx, ty, length, lean] of [
        [254, 270, 22, 5],
        [275, 265, 11, 3],
        [362, 265, 11, -3],
        [385, 270, 22, -5],
      ]) {
        const ivory = c.createLinearGradient(tx - 4, ty, tx + 5, ty + length)
        ivory.addColorStop(0, '#967447')
        ivory.addColorStop(0.4, '#e8cf9d')
        ivory.addColorStop(1, '#fff0c8')
        c.fillStyle = ivory
        c.beginPath()
        c.moveTo(tx - 5, ty)
        c.quadraticCurveTo(tx - 4, ty + length * 0.63, tx + lean, ty + length)
        c.quadraticCurveTo(tx + 6, ty + length * 0.44, tx + 6, ty)
        c.fill()
      }
      c.restore()
      c.save()
      c.setTransform(2, 0, 0, 2, x - LEFT * 2, y + (drop - TOP) * 2)
      c.clip(chin)
      c.drawImage(source, 0, 0, 640, 320)
      c.restore()
    }
    const texture = scene.textures.addCanvas(KEY, sheet)
    if (!texture) return
    for (let i = 0; i < STEPS; i++) {
      texture.add(
        i + 1,
        0,
        (i % 4) * WIDTH * 2,
        Math.floor(i / 4) * HEIGHT * 2,
        WIDTH * 2,
        Math.ceil((320 - TOP + (DROP * (i + 1)) / STEPS) * 2),
      )
    }
  }
  return scene.add.image(0, 0, KEY, 1).setOrigin(0).setDepth(3.6).setVisible(false)
}

export function poseGuardianJaw(
  jaw: Phaser.GameObjects.Image,
  boss: Phaser.GameObjects.Image,
  open: number,
) {
  const scale = boss.displayWidth / 640
  const frame = Math.round(open * STEPS)
  jaw.setVisible(frame > 0)
  if (frame > 0) {
    jaw
      .setFrame(frame)
      .setScale(scale / 2)
      .setPosition(boss.x + (LEFT - 320) * scale, boss.y + (TOP - 160) * scale)
  }
  return boss.y + (278 - 160 + DROP * (frame / STEPS) * 0.52) * scale
}
