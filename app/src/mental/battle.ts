import Phaser from 'phaser'
import { sfx } from '../fx/sound'
import { bakeEnemies, bakeHero, bakeStage, enemyKey, WALL_H } from './art'
import { type Loadout, xpToNext } from './cards'
import { ENEMIES, type EnemyKind } from './enemies'
import { BATTLE_SECONDS, GENRES, type Genre } from './genres'
import type { Hero } from './hero'

/**
 * 멘탈 전투 한 판 (decisions.md 328번). Phaser 3 Arcade로 돈다: 탄·적은 풀에서 재사용하고, 도트 그림(art.ts)은 캔버스에 한 번 구워 둔다. 규칙은 화면
 * 규칙일 뿐이고(얼마나 세지는지는 서버가 정한다), 손맛(번쩍임·밀림·숫자·파편·흔들림·멈칫)이 이 파일의 절반이다. 이 모듈은 Phaser를 담고 있어 import()로 늦게
 * 부른다.
 */

export interface Hud {
  mental: number
  maxMental: number
  secondsLeft: number
  kills: number
  score: number
  level: number
  /** 다음 레벨까지 찬 비율(0~1). */
  xp: number
}

export interface Outcome {
  kills: number
  mentalLeft: number
  win: boolean
}

export interface BattleOptions {
  genre: Genre
  hero: Hero
  loadout: Loadout
  onHud: (hud: Hud) => void
  onBanner: (text: string, color: string) => void
  onHurt: () => void
  /** 레벨이 올랐다: 전투는 멈춰 있고, 카드를 고른 뒤 applyLoadout으로 이어 간다 (330번). */
  onLevelUp: (level: number) => void
  onDone: (outcome: Outcome) => void
}

/** 돌고 있는 한 판을 바깥(카드 고르기)에서 다루는 손잡이. */
export interface BattleHandle {
  /** 고른 카드를 쌓은 새 수치를 넣고 전투를 이어 간다. heal이 있으면 그만큼 회복한다. */
  applyLoadout: (loadout: Loadout) => void
  stop: () => void
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
  look: 0 | 1
  /** 죽는 연출 중: 몸은 이미 꺼졌고 그림만 부풀며 사라진다. */
  dying: boolean
}
type Bullet = Phaser.Physics.Arcade.Image & { life: number; look: 0 | 1 }

/** 적 그림(64×64)의 충돌 원: 가운데에 반지름 r. */
function enemyBody(e: Enemy, r: number) {
  e.body?.setCircle(r, 32 - r, 32 - r)
}

/** 걷기 한 걸음(ms): 옆모습 두 프레임을 번갈아 보인다. */
const STEP_MS = 140
const HURT_MS = 450

class BattleScene extends Phaser.Scene {
  private readonly opts: BattleOptions
  private readonly genre
  private loadout: Loadout
  private bg!: Phaser.GameObjects.TileSprite
  private player!: Phaser.Physics.Arcade.Image
  /** 디펜스의 멘탈벽: 그림(가로로 이어 붙인 벽돌)과 닿음 판정. 적이 닿으면 멘탈이 깎인다. */
  private wall: Phaser.GameObjects.TileSprite | null = null
  private wallZone: Phaser.GameObjects.Zone | null = null
  private bullets!: Phaser.Physics.Arcade.Group
  private tears!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private boom!: Record<EnemyKind, Phaser.GameObjects.Particles.ParticleEmitter>
  /** 총 손맛: 탄 꼬리, 맞는 자리의 불꽃, 총구 화염 풀. */
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter
  private hitSpark!: Phaser.GameObjects.Particles.ParticleEmitter
  private flashes: Phaser.GameObjects.Image[] = []
  private flashIndex = 0
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
  private hurtUntil = 0
  private level = 1
  private xp = 0
  /** 레벨이 올라 카드를 고르는 동안 멈춰 있다. */
  private choosing = false
  private nextWave = 12

  constructor(opts: BattleOptions) {
    super('battle')
    this.opts = opts
    this.genre = GENRES[opts.genre]
    this.loadout = opts.loadout
  }

  /** 카드를 고른 뒤: 새 수치를 받고(회복 포함) 전투를 이어 간다. */
  applyLoadout(loadout: Loadout) {
    this.loadout = { ...loadout, heal: 0 }
    if (loadout.heal > 0) {
      this.mental = Math.min(loadout.maxMental, this.mental + loadout.heal)
      this.pop(this.player.x, this.player.y - 40, `멘탈 +${loadout.heal}`, '#7be0c3', 24)
    }
    if (!this.choosing) {
      return
    }
    this.choosing = false
    if (!this.over) {
      this.physics.resume()
    }
    this.pushHud(true)
  }

  create() {
    bakeStage(this, this.opts.genre)
    bakeHero(this, this.opts.hero)
    bakeEnemies(this)

    const { width: w, height: h } = this.scale
    this.bg = this.add.tileSprite(0, 0, w, h, `floor-${this.opts.genre}`).setOrigin(0)
    const onResize = (s: Phaser.Structs.Size) => this.bg.setSize(s.width, s.height)
    this.scale.on('resize', onResize)
    this.events.once('shutdown', () => this.scale.off('resize', onResize))

    this.mental = this.loadout.maxMental
    this.placeProps()
    // 아군 그림은 64×88(그림자 포함): 몸통(얼굴부터 발까지) 가운데에 충돌 원을 둔다.
    // 둘 다 아래에 선다. 디펜스는 멘탈벽 바로 앞에 붙박이.
    this.player = this.physics.add.image(w / 2, this.playerY(), 'hero-front')
    this.player.setDepth(5)
    this.player.body?.setCircle(20, 12, 24)
    if (this.genre.target === 'wall') {
      this.wall = this.add
        .tileSprite(0, this.wallY() - WALL_H, w, WALL_H * 2, 'wall')
        .setOrigin(0)
        .setDepth(2)
      this.wallZone = this.add.zone(w / 2, this.wallY(), w, WALL_H * 2)
      this.physics.add.existing(this.wallZone, true)
    }

    // 풀: 탄과 적을 미리 만들어 두고 다시 쓴다.
    this.bullets = this.physics.add.group({ maxSize: 400 })
    this.tears = this.physics.add.group({ maxSize: 120 })
    this.enemies = this.physics.add.group({ maxSize: 700 })

    this.physics.add.overlap(this.bullets, this.enemies, (b, e) => {
      const bullet = b as Bullet
      const enemy = e as Enemy
      if (!bullet.active || !enemy.active || enemy.dying || !bullet.body) {
        return
      }
      bullet.disableBody(true, true)
      this.hit(
        enemy,
        this.loadout.damage,
        Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x),
      )
    })
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Enemy
      if (enemy.active && !enemy.dying) {
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
    if (this.wallZone) {
      // 디펜스: 적이 멘탈벽에 닿으면 멘탈이 깎이고 적은 터진다.
      this.physics.add.overlap(this.wallZone, this.enemies, (_z, e) => {
        const enemy = e as Enemy
        if (enemy.active && !enemy.dying) {
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
          scale: { start: 2, end: 0 },
          tint: Phaser.Display.Color.HexStringToColor(v.fill).color,
          emitting: false,
        })
        .setDepth(6)
    }
    this.boom = boom
    this.trail = this.add
      .particles(0, 0, 'trail', {
        lifespan: 160,
        scale: { start: 3, end: 0.5 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xffe08a, 0xffb300],
        emitting: false,
      })
      .setDepth(3)
    this.hitSpark = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 120, max: 260 },
        lifespan: { min: 120, max: 220 },
        scale: { start: 1.6, end: 0 },
        tint: [0xffffff, 0xffe08a],
        emitting: false,
      })
      .setDepth(7)
    for (let i = 0; i < 6; i++) {
      this.flashes.push(this.add.image(0, 0, 'flash').setDepth(6).setVisible(false))
    }
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
    this.opts.onBanner('분기 시작! 멘탈 꽉 잡아', '#3a86ff')
  }

  /** 장르별 소품: 객장은 위쪽 전광판과 책상 줄, 금고실은 네 귀퉁이 기둥과 금괴 상자. 장식일 뿐 부딪히지 않는다. */
  private placeProps() {
    const { width: w, height: h } = this.scale
    if (this.opts.genre === 'ASSAULT') {
      this.add.tileSprite(0, 64, w, 16, 'ticker').setOrigin(0).setDepth(1)
      const count = Math.max(2, Math.floor(w / 110))
      for (let i = 0; i < count; i++) {
        this.add.image(((i + 0.5) * w) / count, 118, 'desk').setDepth(1)
      }
      return
    }
    for (const x of [28, w - 28]) {
      this.add.image(x, 110, 'pillar').setDepth(1)
    }
    // 멘탈벽 뒤(아래)에 지키는 금괴 상자
    this.add.image(w / 2 - 90, h - 46, 'crate').setDepth(1)
    this.add.image(w / 2 + 90, h - 46, 'crate').setDepth(1)
  }

  /** 멘탈벽의 세로 자리: 화면 아래쪽. */
  private wallY() {
    return this.scale.height - 150
  }

  /** 플레이어의 세로 자리: 공격은 아래 띠, 디펜스는 멘탈벽 바로 앞(위). */
  private playerY() {
    return this.genre.area === 'bottom' ? this.scale.height - 120 : this.wallY() - 70
  }

  // ── 생성

  private spawnPoint(): [number, number] {
    return [Phaser.Math.Between(16, this.scale.width - 16), -40]
  }

  private spawn(kind: EnemyKind, at?: [number, number]) {
    const [x, y] = at ?? this.spawnPoint()
    const e = this.enemies.get(x, y, kind) as Enemy | null
    if (!e) {
      return
    }
    const v = ENEMIES[kind]
    e.setTexture(enemyKey(kind, 0))
      .enableBody(true, x, y, true, true)
      .setScale(1)
      .clearTint()
      .setAlpha(1)
      .setDepth(3)
    enemyBody(e, v.r)
    e.look = 0
    e.dying = false
    e.kind = kind
    if (kind !== 'spec') {
      e.setScale(0.3)
      this.tweens.add({ targets: e, scale: 1, duration: 220, ease: 'Back.easeOut' })
    }
    e.hp = v.hp
    e.kbx = 0
    e.kby = 0
    e.born = this.elapsed
    e.nextShot = this.elapsed + 1.2
  }

  private waveDump() {
    this.opts.onBanner('투매 물량 쏟아진다!!', '#a98bff')
    const { width: w } = this.scale
    const grow = 1 + Math.min(1.5, this.elapsed / 120)
    const n = Math.round(12 * grow)
    for (let i = 0; i < n; i++) {
      this.spawn('dump', [((i >> 1) + 0.5) * (w / Math.ceil(n / 2)), -30 - (i % 2) * 44])
    }
  }

  private waveSpec() {
    this.opts.onBanner('투기 과열! 터지기 전에 잡아', '#ff4f6d')
    for (let i = 0; i < 2 + Math.floor(this.elapsed / 80); i++) {
      this.spawn('spec')
    }
  }

  private wavePanic() {
    this.opts.onBanner('패닉셀 떼가 몰려온다!!!', '#3a86ff')
    const { width: w, height: h } = this.scale
    const n = Math.round(24 + Math.min(30, this.elapsed / 6))
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI
      this.spawn('panic', [w / 2 + Math.cos(a) * w * 0.55, h * 0.25 + Math.sin(a) * h * 0.5])
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
    // 맞는 자리에 불꽃이 튀고 살짝 들썩인다.
    this.hitSpark.explode(6, e.x - Math.cos(angle) * 10, e.y - Math.sin(angle) * 10)
    sfx.hit()
    this.tweens.killTweensOf(e)
    this.tweens.add({
      targets: e,
      scaleX: e.scaleX * 1.18,
      scaleY: e.scaleY * 0.84,
      duration: 50,
      yoyo: true,
    })
    const kb = e.kind === 'spec' ? 60 : 240
    e.kbx += Math.cos(angle) * kb
    e.kby += Math.sin(angle) * kb
    this.pop(
      e.x + Phaser.Math.Between(-8, 8),
      e.y - ENEMIES[e.kind].r - 10,
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
      this.gainXp(v.reward)
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
    // 몸은 바로 꺼지고 그림만 부풀며 사라진다. 풀로 돌아가는 것은 연출이 끝난 뒤.
    e.dying = true
    if (e.body) {
      e.body.enable = false
    }
    this.tweens.killTweensOf(e)
    this.tweens.add({
      targets: e,
      scale: e.scale * 1.5,
      alpha: 0,
      duration: 170,
      ease: 'Quad.easeOut',
      onComplete: () => e.disableBody(true, true),
    })
  }

  /** 경험치: 적의 값만큼. 다음 레벨에 닿으면 전투를 멈추고 카드를 고르게 한다 (330번). */
  private gainXp(amount: number) {
    this.xp += amount
    if (this.xp < xpToNext(this.level) || this.over || this.choosing) {
      return
    }
    this.xp -= xpToNext(this.level)
    this.level++
    this.choosing = true
    this.physics.pause()
    this.cameras.main.flash(180, 255, 236, 150)
    sfx.levelUp()
    this.pushHud(true)
    this.opts.onLevelUp(this.level)
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
    if (this.wall && this.mental <= this.loadout.maxMental / 2) {
      this.wall.setTexture('wall-cracked')
    }
    this.cameras.main.shake(130, 0.009)
    this.opts.onHurt()
    sfx.ouch()
    this.hurtUntil = this.time.now + HURT_MS
    const target = this.wallZone && !e ? this.wallZone : this.player
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
    const ptr = this.input.activePointer
    if (this.genre.area === 'fixed' && ptr.isDown) {
      this.fire(now, Math.atan2(ptr.worldY - this.player.y, ptr.worldX - this.player.x))
      return
    }
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
    this.fire(now, Math.atan2(best.y - this.player.y, best.x - this.player.x))
  }

  private fire(now: number, base: number) {
    this.lastFire = now
    sfx.shot()
    const p = this.player
    p.setFlipX(Math.cos(base) < -0.3)
    // 총 손맛: 총구 화염, 반동(눌렸다 펴짐), 화면이 살짝 흔들린다.
    const flash = this.flashes[this.flashIndex++ % this.flashes.length]
    flash
      .setPosition(p.x + Math.cos(base) * 34, p.y - 6 + Math.sin(base) * 34)
      .setRotation(base)
      .setScale(2.2)
      .setAlpha(1)
      .setVisible(true)
    this.tweens.killTweensOf(flash)
    this.tweens.add({
      targets: flash,
      scale: 0.6,
      alpha: 0,
      duration: 90,
      onComplete: () => flash.setVisible(false),
    })
    this.tweens.killTweensOf(p)
    p.setScale(1.14, 0.88)
    this.tweens.add({ targets: p, scaleX: 1, scaleY: 1, duration: 110, ease: 'Back.easeOut' })
    this.cameras.main.shake(30, 0.0012)
    const offs =
      this.loadout.streams >= 3
        ? [-0.22, 0, 0.22]
        : this.loadout.streams === 2
          ? [-0.12, 0.12]
          : [0]
    for (const off of offs) {
      const b = this.bullets.get(this.player.x, this.player.y, 'bullet-0') as Bullet | null
      if (!b) {
        return
      }
      b.setTexture('bullet-0')
        .enableBody(true, this.player.x, this.player.y, true, true)
        .setDepth(4)
      b.look = 0
      b.setScale(1.5)
      b.body?.setCircle(6, 1, 1)
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
    t.body?.setCircle(5, 0, 3)
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
      maxMental: this.loadout.maxMental,
      secondsLeft: Math.max(0, Math.ceil(BATTLE_SECONDS - this.elapsed)),
      kills: this.kills,
      score: this.score,
      level: this.level,
      xp: Math.min(1, this.xp / xpToNext(this.level)),
    })
  }

  update(time: number, dtMs: number) {
    this.pushHud()
    if (this.over || this.stopped || this.choosing) {
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
    my = 0
    if (this.genre.area === 'fixed') {
      mx = 0
    }
    const ml = Math.hypot(mx, my) || 1
    p.setVelocity((mx / ml) * this.loadout.speed, (my / ml) * this.loadout.speed)
    const { width: w, height: h } = this.scale
    p.x = Phaser.Math.Clamp(p.x, 24, w - 24)
    p.y = this.playerY()
    // 아군 그림: 맞았으면 우는 얼굴, 걸으면 옆모습 두 프레임(왼쪽이면 뒤집는다), 가만히 있으면 정면.
    if (time < this.hurtUntil) {
      p.setTexture('hero-hurt').setFlipX(false)
    } else if (this.genre.area === 'fixed') {
      p.setTexture(ptr.isDown ? 'hero-side' : 'hero-front')
    } else if (mx || my) {
      p.setTexture(Math.floor(time / STEP_MS) % 2 ? 'hero-walk' : 'hero-side')
      if (mx) {
        p.setFlipX(mx < 0)
      }
    } else {
      p.setTexture('hero-front').setFlipX(false)
    }
    // 숨쉬기: 가만히 있으면 살짝 눌렸다 펴진다.
    if (!this.tweens.isTweening(p)) {
      p.setScale(1, mx || my ? 1 : 1 + Math.sin(time / 260) * 0.025)
    }
    if (this.wall && this.wallZone) {
      this.wall.setPosition(0, this.wallY() - WALL_H).setSize(w, WALL_H * 2)
      this.wallZone.setPosition(w / 2, this.wallY()).setSize(w, WALL_H * 2)
      ;(this.wallZone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
    }

    if (time - this.lastFire > this.loadout.fireMs) {
      this.shoot(time)
    }

    // 생성: 4분에 걸쳐 갈수록 빨라진다. 파도는 12초마다 투매 → 투기 → 패닉 순으로 돌고 뒤로 갈수록 커진다.
    const every = Math.max(150, 900 - this.elapsed * 3.1)
    if (time - this.lastSpawn > every) {
      this.lastSpawn = time
      const r = Math.random()
      this.spawn(r < 0.6 ? 'panic' : r < 0.82 ? 'dump' : r < 0.95 ? 'stop' : 'spec')
    }
    if (this.elapsed >= this.nextWave) {
      const n = Math.floor(this.nextWave / 12) % 3
      if (n === 1) {
        this.waveDump()
      } else if (n === 2) {
        this.waveSpec()
      } else {
        this.wavePanic()
      }
      this.nextWave += 12
    }

    // 적 움직임: 매 프레임 새 객체를 만들지 않는다.
    const list = this.enemies.getChildren()
    for (let i = 0; i < list.length; i++) {
      const e = list[i] as Enemy
      if (!e.active || e.dying) {
        continue
      }
      const v = ENEMIES[e.kind]
      const dx = this.wallZone ? 0 : p.x - e.x
      const dy = (this.wallZone ? this.wallY() : p.y) - e.y
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
          if (pd < 150 || (this.wallZone && d < 150)) {
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
      // 두 프레임을 번갈아: 패닉은 빠르게 떨고, 나머지는 느긋하게. 바뀔 때만 텍스처를 바꾼다.
      const frame = (Math.floor(time / (e.kind === 'panic' ? 110 : 260) + i) % 2) as 0 | 1
      if (frame !== e.look) {
        e.look = frame
        e.setTexture(enemyKey(e.kind, frame))
      }
      e.setFlipX(dx < 0 && e.kind !== 'dump')
    }
    for (const child of this.bullets.getChildren()) {
      const b = child as Bullet
      if (!b.active) {
        continue
      }
      if (time > b.life) {
        b.disableBody(true, true)
        continue
      }
      const look = (Math.floor(time / 70) % 2) as 0 | 1
      if (look !== b.look) {
        b.look = look
        b.setTexture(`bullet-${look}`)
      }
      this.trail.emitParticleAt(b.x, b.y)
    }
    for (const child of this.tears.getChildren()) {
      const t = child as Phaser.Physics.Arcade.Image
      if (t.active && (t.x < -50 || t.y < -50 || t.x > w + 50 || t.y > h + 50)) {
        t.disableBody(true, true)
      }
    }
  }
}

/** 한 판을 parent 안에 띄운다. 손잡이로 카드를 쌓고(레벨 업) 끝낸다(창이 닫힐 때). */
export function startBattle(parent: HTMLElement, opts: BattleOptions): BattleHandle {
  const scene = new BattleScene(opts)
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1c2238',
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    physics: { default: 'arcade' },
    // 도트 그림: 흐리게 키우지 않는다.
    render: { pixelArt: true, powerPreference: 'high-performance' },
    fps: { target: 60 },
    scene: [scene],
  })
  return { applyLoadout: (loadout) => scene.applyLoadout(loadout), stop: () => game.destroy(true) }
}
