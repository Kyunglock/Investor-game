import Phaser from 'phaser'
import { sfx } from '../fx/sound'
import { bakeEnemies, bakeHero, bakeStage, DPR, enemyKey, GUN, HERO_SIZE, WALL_H } from './art'
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
  /** 레벨이 올랐다(맨 처음엔 Lv.1, 339번): 전투는 멈춰 있고, 카드를 고른 뒤 applyLoadout으로 이어 간다 (330번). */
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
const BULLET_LIFE = 900

type Enemy = Phaser.Physics.Arcade.Image & {
  kind: EnemyKind
  hp: number
  kbx: number
  kby: number
  born: number
  look: 0 | 1
  /** 죽는 연출 중: 몸은 이미 꺼졌고 그림만 부풀며 사라진다. */
  dying: boolean
}
type Bullet = Phaser.Physics.Arcade.Image & { life: number; look: 0 | 1 }

/** 적 그림(64×64)의 충돌 원: 가운데에 반지름 r. */
function enemyBody(e: Enemy, r: number) {
  // 충돌 원은 텍스처 px 단위(배율만큼 큼).
  e.body?.setCircle(r * DPR, (32 - r) * DPR, (32 - r) * DPR)
}

const HURT_MS = 450
/**
 * 적 그림 크기(333·344번): 64px 그림을 이만큼 줄여 보인다(CSS px 기준). 충돌 원도 같이 줄어든다. 사장냥보다 확실히 작다. 텍스처는 화면 배율만큼 크게
 * 구워져 있어(art.ts) 화면에 놓을 때는 배율로 나눈다: 전에는 안 나눠 폰에서 적이 두세 배로 컸다.
 */
const ENEMY_SCALE = 0.62
const ENEMY_K = ENEMY_SCALE / DPR
/** 구워 둔 텍스처(배율만큼 큼)를 CSS px 크기로 놓는 배율. 파티클·화염에 쓴다. */
const TEX = 1 / DPR

class BattleScene extends Phaser.Scene {
  private readonly opts: BattleOptions
  private readonly genre
  private loadout: Loadout
  private bg!: Phaser.GameObjects.TileSprite
  private player!: Phaser.Physics.Arcade.Image
  /** 권총: 사장냥의 손에서 겨누는 쪽으로 돈다 (341번). */
  private gun!: Phaser.GameObjects.Image
  /** 겨누는 각도(라디안). 누르면 그쪽, 아니면 가장 가까운 적. */
  private aim = -Math.PI / 2
  /** 디펜스의 멘탈벽: 그림(가로로 이어 붙인 벽돌)과 닿음 판정. 적이 닿으면 멘탈이 깎인다. */
  private wall: Phaser.GameObjects.TileSprite | null = null
  private wallZone: Phaser.GameObjects.Zone | null = null
  private bullets!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private boom!: Record<EnemyKind, Phaser.GameObjects.Particles.ParticleEmitter>
  /** 총 손맛: 탄 꼬리, 맞는 자리의 불꽃, 총구 화염 풀. */
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter
  private hitSpark!: Phaser.GameObjects.Particles.ParticleEmitter
  private flashes: Phaser.GameObjects.Image[] = []
  private flashIndex = 0
  private pops: Phaser.GameObjects.Text[] = []
  private popIndex = 0

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
  /** 레벨이 올라(또는 맨 처음) 카드를 고르는 동안 멈춰 있다. */
  private choosing = false
  /** 첫 카드를 골라 싸움이 시작됐다 (339번). */
  private begun = false
  private nextWave = 20
  /** 한 화면에 함께 있는 적의 최대 수(334·340번): 더 있으면 새로 만들지 않는다. */
  private static readonly MAX_ALIVE = 60

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
    if (!this.begun) {
      this.begun = true
      this.opts.onBanner('분기 시작! 멘탈 꽉 잡아', '#3a86ff')
    }
    if (!this.over) {
      this.physics.resume()
    }
    this.pushHud(true)
  }

  create() {
    bakeStage(this, this.opts.genre)
    bakeHero(this, this.opts.hero)
    bakeEnemies(this)

    // 선명하게(344번): 캔버스는 화면 배율만큼 크고(startBattle), 카메라를 그만큼 당겨 논리 좌표(view)는 CSS px 그대로다.
    const fitView = () => {
      const { w, h } = this.view()
      this.cameras.main.setZoom(DPR).centerOn(w / 2, h / 2)
      this.bg?.setSize(w, h)
    }
    fitView()
    const { w, h } = this.view()
    this.bg = this.add
      .tileSprite(0, 0, w, h, `floor-${this.opts.genre}`)
      .setOrigin(0)
      .setTileScale(TEX)
    this.scale.on('resize', fitView)
    this.events.once('shutdown', () => this.scale.off('resize', fitView))

    this.mental = this.loadout.maxMental
    this.placeProps()
    // 아군은 사장냥(341번): 상자 100×110의 0.72배. 몸통 가운데에 충돌 원을 둔다. 둘 다 아래에 붙박이.
    this.player = this.physics.add.image(w / 2, this.playerY(), 'hero-idle')
    this.player.setDisplaySize(HERO_SIZE.w, HERO_SIZE.h).setDepth(5)
    const pr = 22
    const tex = this.textures.get('hero-idle').getSourceImage() as { width: number; height: number }
    const k = tex.width / HERO_SIZE.w
    this.player.body?.setCircle(pr * k, (HERO_SIZE.w / 2 - pr) * k, (HERO_SIZE.h / 2 - pr + 4) * k)
    this.gun = this.add
      .image(0, 0, 'gun')
      .setOrigin(GUN.ox, GUN.oy)
      .setDisplaySize(GUN.w, GUN.h)
      .setDepth(6)
    if (this.genre.target === 'wall') {
      this.wall = this.add
        .tileSprite(0, this.wallY() - WALL_H, w, WALL_H * 2, 'wall')
        .setTileScale(TEX)
        .setOrigin(0)
        .setDepth(2)
      this.wallZone = this.add.zone(w / 2, this.wallY(), w, WALL_H * 2)
      this.physics.add.existing(this.wallZone, true)
    }

    // 풀: 탄과 적을 미리 만들어 두고 다시 쓴다.
    this.bullets = this.physics.add.group({ maxSize: 400 })
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
          lifespan: { min: 200, max: 380 },
          scale: { start: 1.6 * TEX, end: 0 },
          tint: Phaser.Display.Color.HexStringToColor(v.fill).color,
          emitting: false,
        })
        .setDepth(6)
    }
    this.boom = boom
    this.trail = this.add
      .particles(0, 0, 'trail', {
        lifespan: 110,
        scale: { start: 2 * TEX, end: 0.4 * TEX },
        alpha: { start: 0.6, end: 0 },
        tint: [0xffe08a, 0xffb300],
        emitting: false,
      })
      .setDepth(3)
    this.hitSpark = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 120, max: 260 },
        lifespan: { min: 120, max: 220 },
        scale: { start: 1.6 * TEX, end: 0 },
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
            resolution: DPR,
          })
          .setOrigin(0.5)
          .setDepth(8)
          .setVisible(false),
      )
    }

    // 첫 카드는 전장이 열린 뒤 고른다 (339번): 멈춘 채로 Lv.1 카드 고르기를 띄운다.
    this.choosing = true
    this.physics.pause()
    this.pushHud(true)
    this.opts.onLevelUp(this.level)
  }

  /** 장르별 소품 (341번): 공격은 위쪽 가장자리의 나무들, 디펜스는 멘탈벽 양 끝의 풀숲. 장식일 뿐 부딪히지 않는다. */
  /** 논리 화면 크기(CSS px). 캔버스 크기(scale)는 배율만큼 크다. */
  private view() {
    return { w: this.scale.width / DPR, h: this.scale.height / DPR }
  }

  private placeProps() {
    const { w, h } = this.view()
    if (this.opts.genre === 'ASSAULT') {
      const count = Math.max(2, Math.floor(w / 120))
      for (let i = 0; i < count; i++) {
        this.add
          .image(((i + 0.5) * w) / count + (i % 2 ? 12 : -12), i % 2 ? 44 : 30, 'tree')
          .setScale(TEX)
          .setDepth(1)
      }
      return
    }
    this.add
      .image(26, h - 150 - 30, 'bush')
      .setScale(TEX)
      .setDepth(1)
    this.add
      .image(w - 26, h - 150 - 30, 'bush')
      .setScale(TEX)
      .setDepth(1)
  }

  /** 멘탈벽의 세로 자리: 화면 아래쪽. */
  private wallY() {
    return this.view().h - 150
  }

  /** 플레이어의 세로 자리(붙박이, 332·340번): 공격은 화면 아래, 디펜스는 멘탈벽 뒤(아래)에 숨어 벽 너머로 쏜다. */
  private playerY() {
    return this.genre.target === 'wall' ? this.wallY() + 78 : this.view().h - 120
  }

  // ── 생성

  private spawnPoint(): [number, number] {
    return [Phaser.Math.Between(16, this.view().w - 16), -40]
  }

  private spawn(kind: EnemyKind, at?: [number, number]) {
    if (this.enemies.countActive() >= BattleScene.MAX_ALIVE) {
      return
    }
    const [x, y] = at ?? this.spawnPoint()
    const e = this.enemies.get(x, y, kind) as Enemy | null
    if (!e) {
      return
    }
    const v = ENEMIES[kind]
    e.setTexture(enemyKey(kind, 0))
      .enableBody(true, x, y, true, true)
      .setScale(ENEMY_K)
      .clearTint()
      .setAlpha(1)
      .setDepth(3)
    enemyBody(e, v.r)
    e.look = 0
    e.dying = false
    e.kind = kind
    if (kind !== 'spec') {
      e.setScale(0.3 * ENEMY_K)
      this.tweens.add({ targets: e, scale: ENEMY_K, duration: 220, ease: 'Back.easeOut' })
    }
    e.hp = v.hp
    e.kbx = 0
    e.kby = 0
    e.born = this.elapsed
  }

  private waveDump() {
    this.opts.onBanner('투매 물량 쏟아진다!!', '#a98bff')
    const { w } = this.view()
    const grow = 1 + Math.min(1.5, this.elapsed / 120)
    const n = Math.round(6 * grow)
    for (let i = 0; i < n; i++) {
      this.spawn('dump', [((i >> 1) + 0.5) * (w / Math.ceil(n / 2)), -30 - (i % 2) * 44])
    }
  }

  private waveSpec() {
    this.opts.onBanner('투기 과열! 터지기 전에 잡아', '#ff4f6d')
    for (let i = 0; i < 1 + Math.floor(this.elapsed / 100); i++) {
      this.spawn('spec')
    }
  }

  private wavePanic() {
    this.opts.onBanner('패닉셀 떼가 몰려온다!!!', '#3a86ff')
    const { w, h } = this.view()
    const n = Math.round(10 + Math.min(10, this.elapsed / 16))
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
    this.hitSpark.explode(3, e.x - Math.cos(angle) * 10, e.y - Math.sin(angle) * 10)
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
    // 데미지 숫자는 한 방에 안 죽는 적(투기·손절매·투매)에만: 패닉까지 띄우면 화면이 숫자로 덮인다 (334번).
    if (ENEMIES[e.kind].hp > 1 && e.hp > 0) {
      this.pop(
        e.x + Phaser.Math.Between(-8, 8),
        e.y - ENEMIES[e.kind].r - 10,
        String(Math.round(dmg * 10)),
        '#ffffff',
        16,
      )
    }
    if (e.hp <= 0) {
      this.kill(e, true)
    }
  }

  private kill(e: Enemy, byPlayer: boolean) {
    const v = ENEMIES[e.kind]
    this.boom[e.kind].explode(e.kind === 'spec' ? 28 : 7, e.x, e.y)
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

  /** 살아 있는 적 가운데 가장 가까운 것. */
  private nearestEnemy(): Enemy | null {
    let best: Enemy | null = null
    let bd = Number.POSITIVE_INFINITY
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (!e.active || e.dying) {
        continue
      }
      const d = (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2
      if (d < bd) {
        bd = d
        best = e
      }
    }
    return best
  }

  /** 총구 자리: 총 피벗에서 겨누는 쪽으로 총 길이만큼. */
  private muzzle() {
    const px = this.player.x + GUN.dx
    const py = this.player.y + GUN.dy
    return { x: px + Math.cos(this.aim) * GUN.len, y: py + Math.sin(this.aim) * GUN.len }
  }

  private shoot(now: number) {
    const ptr = this.input.activePointer
    if (ptr.isDown) {
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
    this.aim = base
    // 총 손맛: 총구 화염, 반동(눌렸다 펴짐), 화면이 살짝 흔들린다.
    const m = this.muzzle()
    const flash = this.flashes[this.flashIndex++ % this.flashes.length]
    flash.setPosition(m.x, m.y).setRotation(base).setScale(TEX).setAlpha(1).setVisible(true)
    this.tweens.killTweensOf(flash)
    this.tweens.add({
      targets: flash,
      scale: 0.6 * TEX,
      alpha: 0,
      duration: 90,
      onComplete: () => flash.setVisible(false),
    })
    this.tweens.killTweensOf(p)
    const [sx, sy] = [p.scaleX, p.scaleY]
    p.setScale(sx * 1.1, sy * 0.92)
    this.tweens.add({ targets: p, scaleX: sx, scaleY: sy, duration: 110, ease: 'Back.easeOut' })
    const offs =
      this.loadout.streams >= 3
        ? [-0.22, 0, 0.22]
        : this.loadout.streams === 2
          ? [-0.12, 0.12]
          : [0]
    for (const off of offs) {
      const b = this.bullets.get(m.x, m.y, 'bullet-0') as Bullet | null
      if (!b) {
        return
      }
      b.setTexture('bullet-0').enableBody(true, m.x, m.y, true, true).setDepth(4)
      b.look = 0
      b.setDisplaySize(32, 10).setRotation(base + off)
      b.body?.setCircle(5 * (b.width / 32), b.width - 10 * (b.width / 32), 0)
      b.setVelocity(
        Math.cos(base + off) * this.loadout.bulletSpeed,
        Math.sin(base + off) * this.loadout.bulletSpeed,
      )
      b.life = now + BULLET_LIFE
    }
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

    // 붙박이 (332번): 자리는 고정, 누르고 있는 쪽을 쏜다. 그림(341번)은 맞았으면 울상(총을 놓친다), 누르고 있으면 눈썹 꾹, 아니면 가만히.
    // 총은 따로 겨누는 쪽으로 돈다: 누르면 그쪽, 아니면 가장 가까운 적.
    const p = this.player
    const ptr = this.input.activePointer
    const { w } = this.view()
    p.setVelocity(0, 0)
    p.setPosition(w / 2, this.playerY())
    const hurting = time < this.hurtUntil
    p.setTexture(hurting ? 'hero-hurt' : ptr.isDown ? 'hero-fire' : 'hero-idle')
    // 숨쉬기: 살짝 눌렸다 펴진다.
    if (!this.tweens.isTweening(p)) {
      p.setDisplaySize(HERO_SIZE.w, HERO_SIZE.h * (1 + Math.sin(time / 260) * 0.025))
    }
    if (!ptr.isDown) {
      const near = this.nearestEnemy()
      if (near) {
        const want = Math.atan2(near.y - p.y, near.x - p.x)
        this.aim +=
          Phaser.Math.Angle.ShortestBetween(
            Phaser.Math.RadToDeg(this.aim),
            Phaser.Math.RadToDeg(want),
          ) *
          (Math.PI / 180) *
          Math.min(1, dt * 10)
      }
    }
    this.gun
      .setVisible(!hurting)
      .setPosition(p.x + GUN.dx, p.y + GUN.dy)
      .setRotation(this.aim)
      .setFlipY(Math.cos(this.aim) < 0)
    if (this.wall && this.wallZone) {
      this.wall.setPosition(0, this.wallY() - WALL_H).setSize(w, WALL_H * 2)
      this.wallZone.setPosition(w / 2, this.wallY()).setSize(w, WALL_H * 2)
      ;(this.wallZone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
    }

    if (time - this.lastFire > this.loadout.fireMs) {
      this.shoot(time)
    }

    // 생성: 4분에 걸쳐 갈수록 빨라진다. 파도는 20초마다 투매 → 투기 → 패닉 순으로 돌고 뒤로 갈수록 커진다 (340번: 334번보다 두 배쯤 많이).
    const every = Math.max(200, 700 - this.elapsed * 2.6)
    if (time - this.lastSpawn > every) {
      this.lastSpawn = time
      const r = Math.random()
      this.spawn(r < 0.6 ? 'panic' : r < 0.82 ? 'dump' : r < 0.95 ? 'stop' : 'spec')
    }
    if (this.elapsed >= this.nextWave) {
      const n = Math.floor(this.nextWave / 20) % 3
      if (n === 1) {
        this.waveDump()
      } else if (n === 2) {
        this.waveSpec()
      } else {
        this.wavePanic()
      }
      this.nextWave += 20
    }

    // 적 움직임: 매 프레임 새 객체를 만들지 않는다.
    const list = this.enemies.getChildren()
    for (let i = 0; i < list.length; i++) {
      const e = list[i] as Enemy
      if (!e.active || e.dying) {
        continue
      }
      const v = ENEMIES[e.kind]
      // 일자로 내려온다 (333번): 옆으로 흔들리거나 돌지 않는다. 목표는 멘탈벽 또는 플레이어의 높이.
      const targetY = this.wallZone ? this.wallY() : p.y
      const d = Math.abs(targetY - e.y) || 1
      // 원거리 공격은 없다 (340번): 손절매도 다른 적처럼 곧장 내려와 부딪힌다.
      const sy = v.speed
      if (e.kind === 'spec') {
        // 투기: 부풀다가 터진다.
        const s = 1 + Math.min(1, (this.elapsed - e.born) / 9) * 0.9
        e.setScale(ENEMY_K * (s + Math.sin(time / 90) * 0.04))
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
      e.setVelocity(e.kbx, sy + e.kby)
      e.kbx *= 0.86
      e.kby *= 0.86
      // 두 프레임을 번갈아: 패닉은 빠르게 떨고, 나머지는 느긋하게. 바뀔 때만 텍스처를 바꾼다.
      const frame = (Math.floor(time / (e.kind === 'panic' ? 110 : 260) + i) % 2) as 0 | 1
      if (frame !== e.look) {
        e.look = frame
        e.setTexture(enemyKey(e.kind, frame))
      }
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
      if (Math.floor(time / 16) % 2 === 0) {
        this.trail.emitParticleAt(b.x, b.y)
      }
    }
  }
}

/** 한 판을 parent 안에 띄운다. 손잡이로 카드를 쌓고(레벨 업) 끝낸다(창이 닫힐 때). */
export function startBattle(parent: HTMLElement, opts: BattleOptions): BattleHandle {
  const scene = new BattleScene(opts)
  // 선명하게(344번): RESIZE 모드는 zoom을 무시해 폰에서 캔버스가 CSS px 크기로 흐렸다. 캔버스를 배율만큼 크게 잡고 zoom으로 CSS 크기에 맞춘다.
  // 부모 크기가 바뀌면 직접 다시 잡는다.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#cfe3a0',
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.round(parent.clientWidth * DPR),
      height: Math.round(parent.clientHeight * DPR),
      zoom: 1 / DPR,
    },
    physics: { default: 'arcade' },
    // 벡터 그림(341번): 부드럽게.
    render: { pixelArt: false, antialias: true, powerPreference: 'high-performance' },
    fps: { target: 60 },
    scene: [scene],
  })
  const ro = new ResizeObserver(() => {
    const w = Math.round(parent.clientWidth * DPR)
    const h = Math.round(parent.clientHeight * DPR)
    if (w > 0 && h > 0 && (w !== game.scale.width || h !== game.scale.height)) {
      game.scale.resize(w, h)
    }
  })
  ro.observe(parent)
  return {
    applyLoadout: (loadout) => scene.applyLoadout(loadout),
    stop: () => {
      ro.disconnect()
      game.destroy(true)
    },
  }
}
