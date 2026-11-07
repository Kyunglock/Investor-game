import Phaser from 'phaser'
import { sfx } from '../fx/sound'
import type { Loadout } from './cards'
import { ENEMIES, type EnemyKind } from './enemies'
import { BATTLE_SECONDS, GENRES, type Genre } from './genres'

/**
 * 멘탈 전투 한 판 (decisions.md 328번). Phaser 3 Arcade로 돈다: 탄·적은 풀에서 재사용하고, 캐릭터 그림은 캔버스에 한 번 그려 둔다. 규칙은 화면 규칙일
 * 뿐이고(얼마나 세지는지는 서버가 정한다), 손맛(번쩍임·밀림·숫자·파편·흔들림·멈칫)이 이 파일의 절반이다. 이 모듈은 Phaser를 담고 있어 import()로 늦게 부른다.
 */

export interface Hud {
  mental: number
  maxMental: number
  secondsLeft: number
  kills: number
  score: number
}

export interface Outcome {
  kills: number
  mentalLeft: number
  win: boolean
}

export interface BattleOptions {
  genre: Genre
  loadout: Loadout
  onHud: (hud: Hud) => void
  onBanner: (text: string, color: string) => void
  onHurt: () => void
  onDone: (outcome: Outcome) => void
}

const INK = '#2b2340'
const BULLET_SPEED = 720
const BULLET_LIFE = 900

type Enemy = Phaser.Physics.Arcade.Image & {
  kind: EnemyKind
  hp: number
  kbx: number
  kby: number
  born: number
  nextShot: number
}
type Bullet = Phaser.Physics.Arcade.Image & { life: number }

/** 동글동글한 그림 하나를 캔버스에 그려 텍스처로 둔다. 매 프레임 그리지 않는다. */
function blob(
  scene: Phaser.Scene,
  key: string,
  r: number,
  fill: string,
  opts: { line?: number; face?: 'happy' | 'angry'; label?: string; font?: number } = {},
) {
  if (scene.textures.exists(key)) {
    return
  }
  const pad = 4
  const size = (r + pad) * 2
  const c = size / 2
  const tex = scene.textures.createCanvas(key, size, size)
  if (!tex) {
    return
  }
  const g = tex.getContext()
  g.lineWidth = opts.line ?? 4
  g.strokeStyle = INK
  g.fillStyle = fill
  g.beginPath()
  g.arc(c, c, r, 0, Math.PI * 2)
  g.fill()
  if (g.lineWidth) {
    g.stroke()
  }
  if (opts.face) {
    const ey = opts.label ? c - r * 0.32 : c - r * 0.1
    const ex = r * 0.32
    g.fillStyle = INK
    g.strokeStyle = INK
    g.lineWidth = Math.max(2, r * 0.12)
    g.lineCap = 'round'
    if (opts.face === 'angry') {
      for (const s of [-1, 1]) {
        g.beginPath()
        g.moveTo(c + s * ex * 1.5, ey - r * 0.14)
        g.lineTo(c + s * ex * 0.5, ey)
        g.stroke()
      }
    } else {
      for (const s of [-1, 1]) {
        g.beginPath()
        g.ellipse(c + s * ex, ey, r * 0.09, r * 0.14, 0, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#ff9bb3'
      for (const s of [-1, 1]) {
        g.beginPath()
        g.ellipse(c + s * ex * 1.55, ey + r * 0.3, r * 0.14, r * 0.08, 0, 0, Math.PI * 2)
        g.fill()
      }
      g.strokeStyle = INK
      g.beginPath()
      g.arc(c, ey + r * 0.22, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI)
      g.stroke()
    }
  }
  if (opts.label) {
    g.fillStyle = INK
    g.font = `${opts.font ?? 12}px "Gowun Dodum", sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(opts.label, c, c + r * 0.28)
  }
  tex.refresh()
}

function checker(scene: Phaser.Scene) {
  if (scene.textures.exists('floor')) {
    return
  }
  const t = scene.textures.createCanvas('floor', 72, 72)
  if (!t) {
    return
  }
  const g = t.getContext()
  g.fillStyle = '#ffe7c2'
  g.fillRect(0, 0, 72, 72)
  g.fillStyle = '#ffdcaa'
  g.fillRect(0, 0, 36, 36)
  g.fillRect(36, 36, 36, 36)
  t.refresh()
}

class BattleScene extends Phaser.Scene {
  private readonly opts: BattleOptions
  private readonly genre
  private bg!: Phaser.GameObjects.TileSprite
  private player!: Phaser.Physics.Arcade.Image
  private vault: Phaser.Physics.Arcade.Image | null = null
  private bullets!: Phaser.Physics.Arcade.Group
  private tears!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private boom!: Record<EnemyKind, Phaser.GameObjects.Particles.ParticleEmitter>
  private pops: Phaser.GameObjects.Text[] = []
  private popIndex = 0
  private keys: Record<
    'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    Phaser.Input.Keyboard.Key
  > | null = null

  private mental = 100
  private score = 0
  private kills = 0
  private elapsed = 0
  private lastFire = 0
  private lastSpawn = 0
  private invulnUntil = 0
  private lastHud = 0
  private over = false
  private stopped = false
  private waves: { at: number; run: () => void }[] = []

  constructor(opts: BattleOptions) {
    super('battle')
    this.opts = opts
    this.genre = GENRES[opts.genre]
  }

  create() {
    checker(this)
    blob(this, 'player', 22, '#ffd84d', { face: 'happy' })
    blob(this, 'vault', 34, '#f5d36b', { label: '금고', font: 15 })
    blob(this, 'bullet', 6, '#fff8ea', { line: 3 })
    blob(this, 'tear', 7, '#9fb4d6', { line: 3 })
    blob(this, 'spark', 5, '#ffffff', { line: 0 })
    for (const [kind, v] of Object.entries(ENEMIES)) {
      blob(this, kind, v.r, v.fill, { face: 'angry', label: v.label, font: v.font })
    }

    const { width: w, height: h } = this.scale
    this.bg = this.add.tileSprite(0, 0, w, h, 'floor').setOrigin(0)
    const onResize = (s: Phaser.Structs.Size) => this.bg.setSize(s.width, s.height)
    this.scale.on('resize', onResize)
    this.events.once('shutdown', () => this.scale.off('resize', onResize))

    this.mental = this.opts.loadout.maxMental
    this.player = this.physics.add.image(
      w / 2,
      this.genre.area === 'bottom' ? h - 120 : h / 2,
      'player',
    )
    this.player.setDepth(5)
    this.player.body?.setCircle(22, 4, 4)
    if (this.genre.target === 'vault') {
      this.vault = this.physics.add
        .image(w / 2, h / 2, 'vault')
        .setDepth(2)
        .setImmovable(true)
      this.vault.body?.setCircle(34, 4, 4)
    }

    // 풀: 탄과 적을 미리 만들어 두고 다시 쓴다.
    this.bullets = this.physics.add.group({ maxSize: 400 })
    this.tears = this.physics.add.group({ maxSize: 120 })
    this.enemies = this.physics.add.group({ maxSize: 700 })

    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
      const bullet = b as Bullet
      const enemy = e as Enemy
      if (!bullet.active || !enemy.active || !bullet.body) {
        return
      }
      bullet.disableBody(true, true)
      this.hit(
        enemy,
        this.opts.loadout.damage,
        Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x),
      )
    })
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Enemy
      if (enemy.active) {
        this.hurt(ENEMIES[enemy.kind].dmg, enemy)
      }
    })
    this.physics.add.overlap(this.player, this.tears, (_p, t) => {
      const tear = t as Phaser.Physics.Arcade.Image
      if (tear.active) {
        tear.disableBody(true, true)
        this.hurt(6)
      }
    })
    if (this.vault) {
      // 디펜스: 적이 금고에 닿으면 멘탈이 깎이고 적은 터진다.
      this.physics.add.overlap(this.vault, this.enemies, (_v, e) => {
        const enemy = e as Enemy
        if (enemy.active) {
          this.hurt(ENEMIES[enemy.kind].dmg)
          this.kill(enemy, false)
        }
      })
    }

    const boom = {} as Record<EnemyKind, Phaser.GameObjects.Particles.ParticleEmitter>
    for (const [kind, v] of Object.entries(ENEMIES)) {
      boom[kind as EnemyKind] = this.add
        .particles(0, 0, 'spark', {
          speed: { min: 90, max: 320 },
          lifespan: { min: 250, max: 500 },
          scale: { start: 1.3, end: 0 },
          tint: Phaser.Display.Color.HexStringToColor(v.fill).color,
          emitting: false,
        })
        .setDepth(6)
    }
    this.boom = boom
    for (let i = 0; i < 40; i++) {
      this.pops.push(
        this.add
          .text(0, 0, '', {
            fontFamily: '"Gowun Dodum", sans-serif',
            fontSize: '20px',
            color: '#ffffff',
            stroke: INK,
            strokeThickness: 5,
          })
          .setOrigin(0.5)
          .setDepth(8)
          .setVisible(false),
      )
    }

    this.keys = this.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as BattleScene['keys']
    this.waves = [
      { at: 9, run: () => this.waveDump() },
      { at: 17, run: () => this.waveSpec() },
      { at: 24, run: () => this.wavePanic() },
      { at: 31, run: () => this.waveDump() },
      { at: 37, run: () => this.waveSpec() },
      { at: 41, run: () => this.wavePanic() },
    ]
    this.opts.onBanner('분기 시작! 멘탈 꽉 잡아', '#3a86ff')
  }

  // ── 생성

  private spawnPoint(): [number, number] {
    const { width: w, height: h } = this.scale
    const m = 40
    if (this.genre.spawn === 'top') {
      return [Phaser.Math.Between(0, w), -m]
    }
    switch (Phaser.Math.Between(0, 3)) {
      case 0:
        return [Phaser.Math.Between(0, w), -m]
      case 1:
        return [w + m, Phaser.Math.Between(0, h)]
      case 2:
        return [Phaser.Math.Between(0, w), h + m]
      default:
        return [-m, Phaser.Math.Between(0, h)]
    }
  }

  private spawn(kind: EnemyKind, at?: [number, number]) {
    const [x, y] = at ?? this.spawnPoint()
    const e = this.enemies.get(x, y, kind) as Enemy | null
    if (!e) {
      return
    }
    const v = ENEMIES[kind]
    e.setTexture(kind)
      .enableBody(true, x, y, true, true)
      .setScale(1)
      .clearTint()
      .setAlpha(1)
      .setDepth(3)
    e.body?.setCircle(v.r, 4, 4)
    e.kind = kind
    e.hp = v.hp
    e.kbx = 0
    e.kby = 0
    e.born = this.elapsed
    e.nextShot = this.elapsed + 1.2
  }

  private waveDump() {
    this.opts.onBanner('투매 물량 쏟아진다!!', '#a98bff')
    const { width: w, height: h } = this.scale
    if (this.genre.spawn === 'top') {
      for (let i = 0; i < 24; i++) {
        this.spawn('dump', [(w / 12) * (i >> 1) + 30, -30 - (i % 2) * 44])
      }
      return
    }
    const left = Math.random() < 0.5
    for (let i = 0; i < 26; i++) {
      this.spawn('dump', [
        left ? -30 - (i % 2) * 40 : w + 30 + (i % 2) * 40,
        (h / 13) * (i >> 1) + 20,
      ])
    }
  }

  private waveSpec() {
    this.opts.onBanner('투기 과열! 터지기 전에 잡아', '#ff4f6d')
    for (let i = 0; i < 3; i++) {
      this.spawn('spec')
    }
  }

  private wavePanic() {
    this.opts.onBanner('패닉셀 떼가 몰려온다!!!', '#3a86ff')
    const { width: w, height: h } = this.scale
    if (this.genre.spawn === 'top') {
      for (let i = 0; i < 40; i++) {
        const a = Math.PI + (i / 39) * Math.PI
        this.spawn('panic', [w / 2 + Math.cos(a) * w * 0.55, h * 0.25 + Math.sin(a) * h * 0.5])
      }
      return
    }
    const radius = Math.max(w, h) * 0.62
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2
      this.spawn('panic', [w / 2 + Math.cos(a) * radius, h / 2 + Math.sin(a) * radius])
    }
  }

  // ── 전투

  private pop(x: number, y: number, text: string, color = '#ffffff', size = 20) {
    const t = this.pops[this.popIndex++ % this.pops.length]
    this.tweens.killTweensOf(t)
    t.setText(text)
      .setColor(color)
      .setFontSize(size)
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(1.3)
      .setVisible(true)
    this.tweens.add({
      targets: t,
      y: y - 36,
      scale: 1,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => t.setVisible(false),
    })
  }

  private hit(e: Enemy, dmg: number, angle: number) {
    e.hp -= dmg
    // 하얗게 번쩍, 뒤로 밀림, 데미지 숫자: 맞은 느낌의 세 가지.
    e.setTintFill(0xffffff)
    this.time.delayedCall(55, () => e.active && e.clearTint())
    const kb = e.kind === 'spec' ? 60 : 240
    e.kbx += Math.cos(angle) * kb
    e.kby += Math.sin(angle) * kb
    this.pop(
      e.x + Phaser.Math.Between(-8, 8),
      e.y - ENEMIES[e.kind].r,
      String(Math.round(dmg * 10)),
      '#ffffff',
      18,
    )
    if (e.hp <= 0) {
      this.kill(e, true)
    }
  }

  private kill(e: Enemy, byPlayer: boolean) {
    const v = ENEMIES[e.kind]
    this.boom[e.kind].explode(e.kind === 'spec' ? 46 : 14, e.x, e.y)
    if (byPlayer) {
      this.kills++
      this.score += v.reward
      sfx.squish()
      if (e.kind === 'spec') {
        this.cameras.main.shake(160, 0.012)
        this.hitstop(70)
        this.pop(e.x, e.y - 40, '투기 진압!', '#ffd84d', 30)
      } else if (e.kind === 'stop') {
        this.pop(e.x, e.y - 30, '손절 안 해!', '#ffd84d', 22)
      } else {
        this.cameras.main.shake(40, 0.002)
      }
    }
    e.disableBody(true, true)
  }

  /** 아주 짧게 멈칫: 큰 적을 잡은 무게. */
  private hitstop(ms: number) {
    if (this.over) {
      return
    }
    this.physics.pause()
    this.stopped = true
    this.time.delayedCall(ms, () => {
      if (!this.over) {
        this.physics.resume()
      }
      this.stopped = false
    })
  }

  private hurt(dmg: number, e?: Enemy) {
    if (this.elapsed < this.invulnUntil || this.over) {
      return
    }
    this.mental = Math.max(0, this.mental - dmg)
    this.invulnUntil = this.elapsed + 0.7
    this.cameras.main.shake(130, 0.009)
    this.opts.onHurt()
    sfx.ouch()
    const target = this.vault && !e ? this.vault : this.player
    this.pop(target.x, target.y - 34, `멘탈 -${dmg}`, '#ff4f6d', 24)
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 80, yoyo: true, repeat: 3 })
    if (e) {
      const a = Math.atan2(e.y - this.player.y, e.x - this.player.x)
      e.kbx += Math.cos(a) * 500
      e.kby += Math.sin(a) * 500
    }
    if (this.mental <= 0) {
      this.finish(false)
    }
  }

  private shoot(now: number) {
    let best: Enemy | null = null
    let bestDist = 520 * 520
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (!e.active) {
        continue
      }
      const d = (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2
      if (d < bestDist) {
        bestDist = d
        best = e
      }
    }
    if (!best) {
      return
    }
    this.lastFire = now
    sfx.shot()
    const base = Math.atan2(best.y - this.player.y, best.x - this.player.x)
    for (const off of this.opts.loadout.spread ? [-0.22, 0, 0.22] : [0]) {
      const b = this.bullets.get(this.player.x, this.player.y, 'bullet') as Bullet | null
      if (!b) {
        return
      }
      b.enableBody(true, this.player.x, this.player.y, true, true).setDepth(4)
      b.body?.setCircle(6, 4, 4)
      b.setVelocity(Math.cos(base + off) * BULLET_SPEED, Math.sin(base + off) * BULLET_SPEED)
      b.life = now + BULLET_LIFE
    }
  }

  private enemyShot(e: Enemy, ux: number, uy: number) {
    const t = this.tears.get(e.x, e.y, 'tear') as Phaser.Physics.Arcade.Image | null
    if (!t) {
      return
    }
    t.enableBody(true, e.x, e.y, true, true).setDepth(4)
    t.body?.setCircle(7, 4, 4)
    t.setVelocity(ux * 260, uy * 260)
  }

  private finish(win: boolean) {
    if (this.over) {
      return
    }
    this.over = true
    this.physics.pause()
    if (!win) {
      this.cameras.main.shake(300, 0.02)
    }
    this.pushHud(true)
    this.time.delayedCall(win ? 300 : 700, () =>
      this.opts.onDone({ kills: this.kills, mentalLeft: Math.ceil(this.mental), win }),
    )
  }

  private pushHud(force = false) {
    const now = performance.now()
    if (!force && now - this.lastHud < 100) {
      return
    }
    this.lastHud = now
    this.opts.onHud({
      mental: Math.ceil(this.mental),
      maxMental: this.opts.loadout.maxMental,
      secondsLeft: Math.max(0, Math.ceil(BATTLE_SECONDS - this.elapsed)),
      kills: this.kills,
      score: this.score,
    })
  }

  update(time: number, dtMs: number) {
    this.pushHud()
    if (this.over || this.stopped) {
      return
    }
    const dt = dtMs / 1000
    this.elapsed += dt
    if (this.elapsed >= BATTLE_SECONDS) {
      this.finish(true)
      return
    }

    // 이동: 키보드, 또는 누르고 있는 곳으로.
    const p = this.player
    const k = this.keys
    const ptr = this.input.activePointer
    let mx = k ? Number(k.D.isDown || k.RIGHT.isDown) - Number(k.A.isDown || k.LEFT.isDown) : 0
    let my = k ? Number(k.S.isDown || k.DOWN.isDown) - Number(k.W.isDown || k.UP.isDown) : 0
    if (ptr.isDown) {
      const dx = ptr.worldX - p.x
      const dy = this.genre.area === 'bottom' ? 0 : ptr.worldY - p.y
      const d = Math.hypot(dx, dy)
      if (d > 8) {
        mx = dx / d
        my = dy / d
      }
    }
    if (this.genre.area === 'bottom') {
      my = 0
    }
    const ml = Math.hypot(mx, my) || 1
    p.setVelocity((mx / ml) * this.opts.loadout.speed, (my / ml) * this.opts.loadout.speed)
    const { width: w, height: h } = this.scale
    p.x = Phaser.Math.Clamp(p.x, 24, w - 24)
    p.y = this.genre.area === 'bottom' ? h - 120 : Phaser.Math.Clamp(p.y, 90, h - 24)
    p.rotation = Math.sin(time / 120) * (mx || my ? 0.12 : 0.03)
    if (this.vault) {
      this.vault.setPosition(w / 2, h / 2)
    }

    if (time - this.lastFire > this.opts.loadout.fireMs) {
      this.shoot(time)
    }

    // 생성: 갈수록 빨라진다.
    const every = Math.max(140, 820 - this.elapsed * 15)
    if (time - this.lastSpawn > every) {
      this.lastSpawn = time
      const r = Math.random()
      this.spawn(r < 0.6 ? 'panic' : r < 0.82 ? 'dump' : r < 0.95 ? 'stop' : 'spec')
    }
    while (this.waves.length && this.elapsed >= this.waves[0].at) {
      this.waves.shift()?.run()
    }

    // 적 움직임: 매 프레임 새 객체를 만들지 않는다.
    const target = this.vault ?? p
    const list = this.enemies.getChildren()
    for (let i = 0; i < list.length; i++) {
      const e = list[i] as Enemy
      if (!e.active) {
        continue
      }
      const v = ENEMIES[e.kind]
      const dx = target.x - e.x
      const dy = target.y - e.y
      const d = Math.hypot(dx, dy) || 1
      let sx = (dx / d) * v.speed
      let sy = (dy / d) * v.speed
      if (e.kind === 'stop') {
        // 손절매: 거리를 두고 플레이어를 향해 멘탈 탄을 쏜다.
        const px = p.x - e.x
        const py = p.y - e.y
        const pd = Math.hypot(px, py) || 1
        if (pd < 200) {
          sx = (-px / pd) * v.speed
          sy = (-py / pd) * v.speed
        } else if (pd < 300) {
          sx = (-py / pd) * v.speed * 0.8
          sy = (px / pd) * v.speed * 0.8
        }
        if (this.elapsed > e.nextShot && pd < 520) {
          e.nextShot = this.elapsed + 1.7
          this.enemyShot(e, px / pd, py / pd)
        }
      }
      if (e.kind === 'spec') {
        // 투기: 부풀다가 터진다.
        const s = 1 + Math.min(1, (this.elapsed - e.born) / 9) * 0.9
        e.setScale(s + Math.sin(time / 90) * 0.04)
        if (s >= 1.9) {
          const pd = Math.hypot(p.x - e.x, p.y - e.y)
          if (pd < 150 || (this.vault && d < 150)) {
            this.hurt(20)
          }
          this.pop(e.x, e.y - 50, '펑!!', '#ff4f6d', 34)
          this.cameras.main.shake(220, 0.015)
          this.kill(e, false)
          continue
        }
      }
      if (e.kind === 'panic') {
        sx += Math.sin(time / 80 + i) * 60
        sy += Math.cos(time / 80 + i) * 60
      }
      e.setVelocity(sx + e.kbx, sy + e.kby)
      e.kbx *= 0.86
      e.kby *= 0.86
      e.rotation = Math.sin(time / 150 + i) * 0.15
    }
    for (const child of this.bullets.getChildren()) {
      const b = child as Bullet
      if (b.active && time > b.life) {
        b.disableBody(true, true)
      }
    }
    for (const child of this.tears.getChildren()) {
      const t = child as Phaser.Physics.Arcade.Image
      if (t.active && (t.x < -50 || t.y < -50 || t.x > w + 50 || t.y > h + 50)) {
        t.disableBody(true, true)
      }
    }
  }
}

/** 한 판을 parent 안에 띄운다. 돌려주는 함수로 끝낸다(창이 닫힐 때). */
export function startBattle(parent: HTMLElement, opts: BattleOptions): () => void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#ffe7c2',
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    physics: { default: 'arcade' },
    render: { antialias: true, powerPreference: 'high-performance' },
    fps: { target: 60 },
    scene: [new BattleScene(opts)],
  })
  return () => game.destroy(true)
}
