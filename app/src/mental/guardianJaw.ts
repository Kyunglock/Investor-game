import type Phaser from 'phaser'

// 원화를 640 × 320 좌표로 봤을 때의 아래턱 외곽. 입술 경계를 따라 원래 비늘을 잘라 쓴다.
const lip =
  'M235 297 Q237 282 250 270 Q254 276 263 274 Q280 264 301 273 L321 281 Q341 270 356 269 Q368 267 377 274 Q387 278 395 269 Q402 280 406 299'
const KEY = 'vault-guardian-jaw'
const STEPS = 16
const HINGE_Y = 297
const CENTER_X = 321
const HALF_WIDTH = 86
const MAX_ANGLE = Math.PI * 0.3
const TIP_DEPTH = 53

// 정면에서 본 말발굽 모양 턱뼈. 양쪽 관절의 깊이는 0이고 턱끝에서 가장 앞으로 돌출된다.
function projectJaw(x: number, angle: number) {
  const u = Math.min(1, Math.abs((x - CENTER_X) / HALF_WIDTH))
  const depth = TIP_DEPTH * (1 - u * u) ** 1.5
  const rise = depth * Math.sin(angle)
  const perspective = 380 / (380 + depth * (1 - Math.cos(angle)))
  return {
    x: CENTER_X + (x - CENTER_X) * perspective,
    y: HINGE_Y + rise * perspective,
    scaleY: 1 - (1 - Math.cos(angle)) * (depth / TIP_DEPTH),
  }
}
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
    const plate = document.createElement('canvas')
    plate.width = WIDTH * 2
    plate.height = (320 - TOP) * 2
    const plateContext = plate.getContext('2d')
    if (!plateContext) return
    plateContext.setTransform(2, 0, 0, 2, -LEFT * 2, -TOP * 2)
    plateContext.clip(chin)
    plateContext.drawImage(source, 0, 0, 640, 320)
    for (let i = 0; i < STEPS; i++) {
      const angle = (MAX_ANGLE * (i + 1)) / STEPS
      const drop = projectJaw(CENTER_X, angle).y - HINGE_Y
      const x = (i % 4) * WIDTH * 2
      const y = Math.floor(i / 4) * HEIGHT * 2
      c.save()
      c.setTransform(2, 0, 0, 2, x - LEFT * 2, y - TOP * 2)
      const cavity = new Path2D(lip)
      for (let sx = 406; sx >= 235; sx--) {
        const column = projectJaw(sx, angle)
        // 입 안의 아래 윤곽은 움직이는 턱 비늘 뒤에서 끝난다.
        cavity.lineTo(column.x, column.y + 6 * (1 - ((sx - CENTER_X) / HALF_WIDTH) ** 2))
      }
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
      c.setTransform(2, 0, 0, 2, x - LEFT * 2, y - TOP * 2)
      // 같은 원화의 비늘을 회전한 면에 투영한다. 턱끝은 내려가며 짧아지고 볼과 만나는 양끝은 고정된다.
      for (let col = 0; col < plate.width; col++) {
        const sx = LEFT + col / 2
        const a = projectJaw(sx, angle)
        const b = projectJaw(sx + 0.5, angle)
        c.drawImage(
          plate,
          col,
          0,
          1,
          plate.height,
          a.x,
          a.y + (TOP - HINGE_Y) * a.scaleY,
          b.x - a.x + 0.5,
          (320 - TOP) * a.scaleY,
        )
      }
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
        Math.ceil(
          (projectJaw(CENTER_X, (MAX_ANGLE * (i + 1)) / STEPS).y + (320 - HINGE_Y) - TOP) * 2,
        ),
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
  const tip = projectJaw(CENTER_X, (MAX_ANGLE * frame) / STEPS)
  const lowerLip = tip.y + (281 - HINGE_Y) * tip.scaleY
  return boss.y + ((281 + lowerLip) / 2 - 160) * scale
}
