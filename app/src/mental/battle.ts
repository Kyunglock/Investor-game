import Phaser from 'phaser'
import { sfx } from '../fx/sound'
import {
  type BattleMode,
  BOSS,
  bossSummonSeconds,
  formation,
  SCROLL_SECONDS,
  SEGMENTS,
  stars,
  TRICKLE_SECONDS,
} from './advance'
import { bakeEnemies, bakeHero, bakeStage, DPR, enemyKey, GUN, HERO_SIZE, WALL_H } from './art'
import { STAGE_ASSETS } from './assets'
import { bulletStats, type Loadout, xpToNext } from './cards'
import { ENEMIES, type EnemyKind } from './enemies'
import { WALK_FRAMES, walkFrame } from './enemyWalk'
import { BATTLE_SECONDS, GENRES, type Genre, PACE, WAVE_SECONDS } from './genres'
import type { Hero } from './hero'
import { BULLET_H, BULLET_W, bulletHitbox } from './hitbox'
import { wallOffset } from './stageArt'

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
  /** 전진 모드의 구간: 지금 몇 번째(1부터)를 싸우는지와 전체 수. 디펜스는 null. */
  segment: { at: number; total: number } | null
  /** 보스가 나와 있으면 이름과 남은 체력 비율(0~1). */
  boss: { name: string; hp: number } | null
}

export interface Outcome {
  kills: number
  mentalLeft: number
  win: boolean
  /** 왜 끝났나: 깼다(디펜스는 시간을 버텼다), 시간이 다 됐다(전진 모드 실패), 멘탈이 무너졌다. */
  reason: 'clear' | 'time' | 'mental'
  /** 전진 모드에서 넘긴 구간 수와 별(0~3, 364번). 디펜스는 0. */
  segments: number
  stars: number
}

export interface BattleOptions {
  /** 전진 모드(주 콘텐츠) 또는 디펜스(EX) (364번). */
  mode: BattleMode
  genre: Genre
  hero: Hero
  loadout: Loadout
  onReady?: () => void
  onError?: (message: string) => void
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
  /** 나가기 물음 동안 멈춘다/이어 간다 (345번). 카드 고르기·끝난 뒤에는 아무것도 안 한다. */
  setPaused: (paused: boolean) => void
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
  walkOffset: number
  look: number
  /** 죽는 연출 중: 몸은 이미 꺼졌고 그림만 부풀며 사라진다. */
  dying: boolean
  /** 전진 모드에서 길을 막는 적: 다 잡아야 다음 구간이 열린다. 아래로 지나가면 다시 위에서 내려온다. */
  blocker: boolean
  /** 전진 모드의 마지막 보스(364번). */
  boss: boolean
}
type Bullet = Phaser.Physics.Arcade.Image & {
  life: number
  look: 0 | 1
  damage: number
  power: number
  /** 2단계부터 맞은 자리에서 터져 휘말리게 하는 반지름(px)과 피해. 0이면 없다. */
  splashRadius: number
  splashDamage: number
}

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
  private readonly mode: BattleMode
  private loadout: Loadout
  private bg!: Phaser.GameObjects.Image
  /** 전진 모드: 위에 이어 붙인 둘째 배경. 둘이 함께 내려가며 길이 올라가는 것처럼 보인다. */
  private bg2: Phaser.GameObjects.Image | null = null
  /** 전진 모드의 구간 (364번): 지금 구간 번호(0부터), 남은 길막 적, 화면이 올라가는 중이면 남은 초. */
  private segment = 0
  private blockersLeft = 0
  private scrolling = 0
  private lastTrickle = 0
  /** 마지막 보스와 마지막으로 졸개를 부른 때(초). */
  private bossEnemy: Enemy | null = null
  private lastSummon = 0
  /** 전진 모드의 드래그: 누른 자리와 그때 사장냥 자리. 손가락이 움직인 만큼 사장냥이 따라간다. */
  private drag: { px: number; py: number; cx: number; cy: number } | null = null
  private player!: Phaser.Physics.Arcade.Image
  /** 권총: 사장냥의 손에서 겨누는 쪽으로 돈다 (341번). */
  private gun!: Phaser.GameObjects.Image
  /** 겨누는 각도(라디안). 누르면 그쪽, 아니면 가장 가까운 적. */
  private aim = -Math.PI / 2
  /** 디펜스의 멘탈벽: 그림(반투명 보호막)과 닿음 판정. 적이 닿으면 멘탈이 깎인다. */
  private wall: Phaser.GameObjects.Image | null = null
  private ripples: Phaser.GameObjects.Image[] = []
  private rippleIndex = 0
  private wallZone: Phaser.GameObjects.Zone | null = null
  private bullets!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private boom!: Record<EnemyKind, Phaser.GameObjects.Particles.ParticleEmitter>
  /** 총 손맛: 탄 꼬리, 맞는 자리의 불꽃, 총구 화염 풀. */
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter
  private hitSpark!: Phaser.GameObjects.Particles.ParticleEmitter
  private flashes: Phaser.GameObjects.Image[] = []
  private flashIndex = 0
  private impacts: Phaser.GameObjects.Image[] = []
  private impactIndex = 0
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
  private reducedMotion = false
  private level = 1
  private xp = 0
  /** 레벨이 올라(또는 맨 처음) 카드를 고르는 동안 멈춰 있다. */
  private choosing = false
  /** 나가기 물음으로 멈춤 (345번). */
  private paused = false
  /** 첫 카드를 골라 싸움이 시작됐다 (339번). */
  private begun = false
  private nextWave = WAVE_SECONDS
  /** 한 화면에 함께 있는 적의 최대 수(334·340번): 더 있으면 새로 만들지 않는다. */
  /** 동시에 살아 있는 적의 최대: 파도(투매 최대 36, 패닉 최대 44)가 잘리지 않게 넉넉히. */
  private static readonly MAX_ALIVE = 100

  constructor(opts: BattleOptions) {
    super('battle')
    this.opts = opts
    this.genre = GENRES[opts.genre]
    this.mode = opts.mode
    this.loadout = opts.loadout
  }

  /** 카드를 고른 뒤: 새 수치를 받고(회복 포함) 전투를 이어 간다. */
  setPaused(paused: boolean) {
    if (this.paused === paused || this.over) {
      return
    }
    this.paused = paused
    if (this.choosing) {
      return
    }
    if (paused) {
      this.physics.pause()
    } else {
      this.physics.resume()
    }
    this.pushHud(true)
  }

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
      this.opts.onBanner(
        this.mode === 'advance' ? '전진! 길을 막는 불안을 치워라' : '분기 시작! 멘탈 꽉 잡아',
        '#3a86ff',
      )
    }
    if (!this.over && !this.paused) {
      this.physics.resume()
    }
    this.pushHud(true)
  }

  preload() {
    for (const [key, url] of Object.entries(STAGE_ASSETS)) this.load.image(`art-${key}`, url)
  }

  create() {
    if (Object.keys(STAGE_ASSETS).some((key) => !this.textures.exists(`art-${key}`))) {
      this.over = true
      this.opts.onError?.('전장 그림을 불러오지 못했어요. 다시 시도해주세요.')
      return
    }
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.opts.onReady?.()
    bakeStage(this, this.opts.genre)
    bakeHero(this, this.opts.hero)
    bakeEnemies(this)

    // 선명하게(344번): 캔버스는 화면 배율만큼 크고(startBattle), 카메라를 그만큼 당겨 논리 좌표(view)는 CSS px 그대로다.
    let previousWidth = this.view().w
    const fitView = () => {
      const { w, h } = this.view()
      this.cameras.main.setZoom(DPR).centerOn(w / 2, h / 2)
      this.bg?.setDisplaySize(w, h)
      this.bg2?.setDisplaySize(w, h)
      if (previousWidth !== w) {
        for (const group of [this.enemies, this.bullets]) {
          for (const object of group?.getChildren() ?? []) {
            const sprite = object as Phaser.Physics.Arcade.Image
            sprite.setX((sprite.x * w) / previousWidth)
          }
        }
      }
      previousWidth = w
      if (this.mode === 'advance') {
        if (this.player) this.movePlayer(this.player.x, this.player.y)
        this.drag = null
      } else {
        this.player?.setPosition(w / 2, this.playerY())
        this.gun?.setPosition(w / 2 + GUN.dx, this.playerY() + GUN.dy)
      }
      this.wall?.setPosition(0, this.wallY() - WALL_H).setDisplaySize(w, WALL_H * 3)
      if (this.wallZone) {
        this.wallZone.setPosition(w / 2, this.wallY()).setSize(w, WALL_H * 2)
        ;(this.wallZone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
      }
    }
    fitView()
    const { w, h } = this.view()
    this.bg = this.add.image(0, 0, 'art-street').setOrigin(0).setDisplaySize(w, h)
    if (this.mode === 'advance') {
      // 같은 그림을 위에 하나 더 이어 붙여 함께 내린다: 그림 하나로 끝없이 올라가는 길. 뒤집어 붙이면 이음매는 맞지만 집이 거꾸로 보였다.
      this.bg2 = this.add.image(0, -h, 'art-street').setOrigin(0).setDisplaySize(w, h)
      this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        this.drag = { px: ptr.worldX, py: ptr.worldY, cx: this.player.x, cy: this.player.y }
      })
      const release = () => {
        this.drag = null
      }
      this.input.on('pointerup', release)
      this.input.on('pointerupoutside', release)
    }
    this.scale.on('resize', fitView)
    this.events.once('shutdown', () => this.scale.off('resize', fitView))

    this.mental = this.loadout.maxMental
    // 아군은 사장냥(341번): 상자 100×110의 0.72배. 몸통 가운데에 충돌 원을 둔다. 둘 다 아래에 붙박이.
    this.player = this.physics.add.image(w / 2, this.playerY(), 'hero-idle')
    this.player.setDisplaySize(HERO_SIZE.w, HERO_SIZE.h).setDepth(5)
    const pr = 22
    const tex = this.textures.get('hero-idle').getSourceImage() as { width: number; height: number }
    const k = tex.width / HERO_SIZE.w
    this.player.body?.setCircle(pr * k, (HERO_SIZE.w / 2 - pr) * k, (HERO_SIZE.h / 2 - pr + 4) * k)
    this.gun = this.add
      .image(this.player.x + GUN.dx, this.player.y + GUN.dy, 'gun')
      .setRotation(this.aim)
      .setOrigin(GUN.ox, GUN.oy)
      .setDisplaySize(GUN.w, GUN.h)
      .setDepth(6)
    if (this.mode === 'defense' && this.genre.target === 'wall') {
      this.wall = this.add
        .image(0, this.wallY() - WALL_H, 'wall')
        .setDisplaySize(w, WALL_H * 3)
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
      const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x)
      const [bx, by] = [bullet.x, bullet.y]
      this.impact(bx, by, bullet.power)
      bullet.disableBody(true, true)
      this.hit(enemy, bullet.damage, angle)
      if (bullet.splashRadius > 0) {
        this.splash(bx, by, bullet.splashRadius, bullet.splashDamage, enemy)
      }
    })
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Enemy
      if (enemy.active && !enemy.dying) {
        this.hurt(enemy.boss ? BOSS.dmg : ENEMIES[enemy.kind].dmg, enemy)
      }
    })
    if (this.wallZone) {
      // 디펜스: 적이 멘탈벽에 닿으면 멘탈이 깎이고 적은 터진다.
      this.physics.add.overlap(this.wallZone, this.enemies, (_z, e) => {
        const enemy = e as Enemy
        if (enemy.active && !enemy.dying) {
          this.hurt(ENEMIES[enemy.kind].dmg, undefined, enemy.x)
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
    for (let i = 0; i < 20; i++) {
      this.impacts.push(this.add.image(0, 0, 'bullet-impact').setDepth(7).setVisible(false))
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

    for (let i = 0; i < 6; i++)
      this.ripples.push(this.add.image(0, 0, 'wall-ripple').setDepth(7).setVisible(false))

    if (this.mode === 'advance') {
      this.startSegment()
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

  /** 멘탈벽의 세로 자리: 화면 아래쪽. */
  private wallY() {
    return this.view().h - wallOffset(this.view().h)
  }

  /** 플레이어의 세로 자리(붙박이, 332·340번): 디펜스는 멘탈벽 뒤(아래)에 숨어 벽 너머로 쏜다. 전진 모드는 처음 자리(아래쪽)다. */
  private playerY() {
    return this.mode === 'defense' && this.genre.target === 'wall'
      ? this.wallY() + 78
      : this.view().h - 140
  }

  /** 전진 모드: 사장냥을 옮긴다. 화면 가장자리와 위쪽 길막 줄에는 못 간다. */
  private movePlayer(x: number, y: number) {
    const { w, h } = this.view()
    const px = Phaser.Math.Clamp(x, 28, w - 28)
    const py = Phaser.Math.Clamp(y, h * 0.4, h - 70)
    this.player.setPosition(px, py)
  }

  // ── 전진 모드의 구간 (364번)

  /** 구간을 연다: 길막 적이 줄지어 위에서 들어온다. */
  private startSegment() {
    const { w } = this.view()
    const spots = formation(SEGMENTS[this.segment], w)
    this.blockersLeft = 0
    for (const spot of spots) {
      const e = this.spawn(spot.kind, [spot.x, spot.y], true)
      if (e) {
        e.blocker = true
        this.blockersLeft++
      }
    }
  }

  /** 길막 적을 다 잡았다: 다음 구간으로 화면이 올라가거나, 마지막이면 깼다. */
  private segmentCleared() {
    this.segment++
    sfx.levelUp()
    this.opts.onBanner(
      this.segment >= SEGMENTS.length
        ? `${BOSS.name} 등장!!`
        : `구간 돌파! ${this.segment}/${SEGMENTS.length}`,
      this.segment >= SEGMENTS.length ? '#ff4f6d' : '#7be0c3',
    )
    this.scrolling = SCROLL_SECONDS
    this.pushHud(true)
  }

  /** 마지막 보스를 부른다: 화면 위 가운데에서 크게 내려온다. 보통 적 수 제한과 상관없이 나온다. */
  private startBoss() {
    const { w } = this.view()
    const e = this.spawn(BOSS.kind, [w / 2, -90], true)
    if (!e) {
      // 풀이 꽉 차 보스를 못 꺼내면 판이 끝나지 않으니 그대로 깬 것으로 친다.
      this.finish(true, 'clear')
      return
    }
    this.tweens.killTweensOf(e)
    e.boss = true
    e.hp = BOSS.hp
    e.setScale(ENEMY_K * BOSS.scale)
    this.bossEnemy = e
    this.lastSummon = this.elapsed
    this.cameras.main.shake(260, 0.012)
    this.pushHud(true)
  }

  /** 보스가 졸개를 부른다: 보스 발밑에서 사장냥 쪽으로 부채꼴로 내려간다. */
  private summon(boss: Enemy) {
    const { w } = this.view()
    for (let i = 0; i < BOSS.summonCount; i++) {
      const spread = (i - (BOSS.summonCount - 1) / 2) * 46
      const x = Phaser.Math.Clamp(boss.x + spread, w * 0.1, w * 0.9)
      this.spawn('panic', [x, boss.y + 40])
    }
    this.pop(boss.x, boss.y - 70, '다 팔아!!', '#3a86ff', 26)
  }

  // ── 생성

  private spawnPoint(): [number, number] {
    const w = this.view().w
    return [Phaser.Math.Between(Math.round(w * 0.16), Math.round(w * 0.84)), -40]
  }

  /** 적 하나를 꺼낸다. 길막 적(force)은 화면에 적이 많아도 꺼낸다: 못 꺼내면 구간이 안 끝난다. */
  private spawn(kind: EnemyKind, at?: [number, number], force = false): Enemy | null {
    if (!force && this.enemies.countActive() >= BattleScene.MAX_ALIVE) {
      return null
    }
    const [x, y] = at ?? this.spawnPoint()
    const e = this.enemies.get(x, y, kind) as Enemy | null
    if (!e) {
      return null
    }
    e.blocker = false
    e.boss = false
    const v = ENEMIES[kind]
    e.setTexture(enemyKey(kind, 0))
      .enableBody(true, x, y, true, true)
      .setScale(ENEMY_K)
      .clearTint()
      .setAlpha(1)
      .setDepth(3)
    enemyBody(e, v.r)
    e.look = 0
    e.walkOffset = Phaser.Math.Between(0, WALK_FRAMES - 1)
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
    return e
  }

  /** 전진 모드의 한 프레임: 화면이 올라가는 중이면 배경을 내리고, 다 올라가면 다음 구간을 연다. 싸우는 중에는 패닉이 이따금 달려든다. */
  private advanceStep(dt: number, h: number) {
    if (this.scrolling > 0) {
      const move = (h / SCROLL_SECONDS) * 0.6 * dt
      for (const bg of [this.bg, this.bg2]) {
        if (!bg) continue
        bg.y += move
        if (bg.y >= h) bg.y -= 2 * h
      }
      this.scrolling -= dt
      if (this.scrolling <= 0) {
        this.scrolling = 0
        if (this.segment >= SEGMENTS.length) {
          this.startBoss()
        } else {
          this.startSegment()
        }
      }
      return
    }
    const boss = this.bossEnemy
    if (boss) {
      if (
        boss.active &&
        !boss.dying &&
        this.elapsed - this.lastSummon > bossSummonSeconds(boss.hp)
      ) {
        this.lastSummon = this.elapsed
        this.summon(boss)
      }
      return
    }
    if (this.elapsed - this.lastTrickle > TRICKLE_SECONDS) {
      // 사장냥 머리 위 언저리로 떨어져 피하거나 쏴야 한다: 아무 데나 떨어지면 거의 닿지 않았다.
      this.lastTrickle = this.elapsed
      const { w } = this.view()
      const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-80, 80), w * 0.12, w * 0.88)
      this.spawn('panic', [x, -40])
    }
  }

  /** 난이도 곡선의 시각(초): 예전 4분 판 기준으로 잡은 곡선을 2분 판에 맞춰 PACE배 빨리 돈다 (363번). */
  private curve() {
    return this.elapsed * PACE
  }

  private waveDump() {
    this.opts.onBanner('투매 물량 쏟아진다!!', '#a98bff')
    const { w } = this.view()
    const grow = 1 + Math.min(1.5, this.curve() / 120)
    // 세 줄로 쏟아진다: 처음 15, 뒤로 갈수록 36까지. 전에는 6~15로 '쏟아진다'는 말이 무색했다.
    const n = Math.round(15 * grow)
    const cols = Math.ceil(n / 3)
    for (let i = 0; i < n; i++) {
      this.spawn('dump', [
        w * 0.16 + (Math.floor(i / 3) + 0.5) * ((w * 0.68) / cols),
        -30 - (i % 3) * 44,
      ])
    }
  }

  private waveSpec() {
    this.opts.onBanner('투기 과열! 터지기 전에 잡아', '#ff4f6d')
    for (let i = 0; i < 1 + Math.floor(this.curve() / 100); i++) {
      this.spawn('spec')
    }
  }

  private wavePanic() {
    this.opts.onBanner('패닉셀 떼가 몰려온다!!!', '#3a86ff')
    const { w, h } = this.view()
    // 두 겹의 반원 떼: 처음 24, 뒤로 갈수록 44까지. 전에는 10~20이라 떼 같지 않았다.
    const n = Math.round(24 + Math.min(20, this.curve() / 8))
    const half = Math.ceil(n / 2)
    for (let i = 0; i < n; i++) {
      const ring = i < half ? 0 : 1
      const j = ring ? i - half : i
      const m = ring ? n - half : half
      const a = Math.PI + ((j + 0.5) / m) * Math.PI
      const rw = w * (0.28 + ring * 0.05)
      const rh = h * (0.5 + ring * 0.14)
      this.spawn('panic', [w / 2 + Math.cos(a) * rw, h * 0.25 + Math.sin(a) * rh])
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
    // 하얗게 번쩍, 들썩임, 데미지 숫자: 맞은 느낌의 세 가지.
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
    // 탄에 맞아도 밀려나지 않는다: 밀리면 내려오던 줄이 흐트러져 조준이 어긋났다. 밀림은 사장냥에 부딪혔을 때(hurt)만.
    // 데미지 숫자는 한 방에 안 죽는 적(투기·손절매·투매)에만: 패닉까지 띄우면 화면이 숫자로 덮인다 (334번).
    if ((ENEMIES[e.kind].hp > 1 || e.boss) && e.hp > 0) {
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
    if (e.boss) {
      e.boss = false
      this.bossEnemy = null
      this.cameras.main.shake(420, 0.02)
      this.hitstop(140)
      this.boom[e.kind].explode(40, e.x, e.y)
      this.opts.onBanner('돌파!! 멘탈 전진 성공', '#ffd84d')
      this.finish(true, 'clear')
    }
    if (e.blocker) {
      e.blocker = false
      this.blockersLeft--
      if (this.blockersLeft <= 0 && !this.over) {
        this.segmentCleared()
      }
    }
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
      if (!this.over && !this.paused && !this.choosing) {
        this.physics.resume()
      }
      this.stopped = false
    })
  }

  private hurt(dmg: number, e?: Enemy, contactX?: number) {
    if (this.elapsed < this.invulnUntil || this.over) {
      return
    }
    this.mental = Math.max(0, this.mental - dmg)
    this.invulnUntil = this.elapsed + 0.7
    if (this.wall && contactX != null) {
      const ripple = this.ripples[this.rippleIndex++ % this.ripples.length]
      this.tweens.killTweensOf(ripple)
      ripple
        .setPosition(contactX, this.wallY() - 8)
        .setScale(TEX * 0.45)
        .setAlpha(1)
        .setVisible(true)
      this.tweens.add({
        targets: ripple,
        scale: TEX * 1.1,
        alpha: 0,
        duration: 420,
        onComplete: () => ripple.setVisible(false),
      })
    }
    // 멘탈벽에 닿은 건 자주 일어나니 살짝만, 사장냥이 직접 맞은 건 더 세게 흔든다.
    if (this.wallZone && !e) {
      this.cameras.main.shake(80, 0.003)
    } else {
      this.cameras.main.shake(130, 0.009)
    }
    this.opts.onHurt()
    sfx.ouch()
    if (e) this.hurtUntil = this.time.now + HURT_MS
    const target = this.wallZone && !e ? this.wallZone : this.player
    this.pop(target.x, target.y - 34, `멘탈 -${dmg}`, '#ff4f6d', 24)
    if (e)
      this.tweens.add({ targets: this.player, alpha: 0.3, duration: 80, yoyo: true, repeat: 3 })
    if (e) {
      const a = Math.atan2(e.y - this.player.y, e.x - this.player.x)
      e.kbx += Math.cos(a) * 500
      e.kby += Math.sin(a) * 500
    }
    if (this.mental <= 0) {
      this.finish(false, 'mental')
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

  /**
   * 자동 조준의 과녁. 보통은 가장 가까운 적이다. 보스가 나와 있으면 보스를 노리되, 졸개가 사장냥 바로 곁(150px)까지 오면 그 졸개를 먼저 쏜다. 가장 가까운
   * 적만 노리면 보스가 계속 부르는 졸개만 쏘다 시간이 다 갔다.
   */
  private autoTarget(): Enemy | null {
    const near = this.nearestEnemy()
    const boss = this.bossEnemy
    if (!boss || !boss.active || boss.dying || !near || near === boss) {
      return near
    }
    const close = (near.x - this.player.x) ** 2 + (near.y - this.player.y) ** 2 < 150 * 150
    return close ? near : boss
  }

  /** 총구 자리: 총 피벗에서 겨누는 쪽으로 총 길이만큼. */
  private muzzle() {
    const px = this.player.x + GUN.dx
    const py = this.player.y + GUN.dy
    return { x: px + Math.cos(this.aim) * GUN.len, y: py + Math.sin(this.aim) * GUN.len }
  }

  private shoot(now: number) {
    // 각도는 총 피벗에서 잰다: 사장냥 가운데에서 재면 가까운 적은 총구가 비켜 있어 빗나간다.
    const ptr = this.input.activePointer
    const gx = this.player.x + GUN.dx
    const gy = this.player.y + GUN.dy
    // 전진 모드는 손가락이 이동이라 늘 자동 조준이다 (364번).
    if (ptr.isDown && this.mode === 'defense') {
      this.fire(now, Math.atan2(ptr.worldY - gy, ptr.worldX - gx))
      return
    }
    if (this.mode === 'advance') {
      const target = this.autoTarget()
      if (target) {
        this.fire(now, Math.atan2(target.y - gy, target.x - gx))
      }
      return
    }
    let best: Enemy | null = null
    let bestDist = 520 * 520
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (!e.active || e.dying) {
        continue
      }
      const d = (e.x - gx) ** 2 + (e.y - gy) ** 2
      if (d < bestDist) {
        bestDist = d
        best = e
      }
    }
    if (!best) {
      return
    }
    this.fire(now, Math.atan2(best.y - gy, best.x - gx))
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
    const stats = bulletStats(this.loadout)
    const b = this.bullets.get(m.x, m.y, 'bullet-0') as Bullet | null
    if (!b) return
    b.setTexture('bullet-0').enableBody(true, m.x, m.y, true, true).setDepth(4)
    b.look = 0
    b.damage = stats.damage
    b.power = stats.power
    b.splashRadius = stats.splashRadius
    b.splashDamage = stats.splashDamage
    b.setDisplaySize(BULLET_W * stats.scale, BULLET_H * stats.scale).setRotation(base)
    b.setTint([0xffffff, 0xffdd99, 0xffb966, 0xff9955][stats.power])
    const hb = bulletHitbox(b.width, b.height)
    b.body?.setCircle(hb.radius, hb.ox, hb.oy)
    b.setVelocity(
      Math.cos(base) * this.loadout.bulletSpeed,
      Math.sin(base) * this.loadout.bulletSpeed,
    )
    b.life = now + BULLET_LIFE
  }

  /** 범위 피해 (decisions.md 362번): 맞은 적을 뺀, 터진 자리 반지름 안의 적이 함께 맞는다. 바깥으로 밀어내는 각도로 맞는다. */
  private splash(x: number, y: number, radius: number, dmg: number, except: Enemy) {
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (e === except || !e.active || e.dying) {
        continue
      }
      const reach = radius + ENEMIES[e.kind].r
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= reach * reach) {
        this.hit(e, dmg, Math.atan2(e.y - y, e.x - x))
      }
    }
  }

  /** 명중 폭발: 재사용 풀로 섬광과 충격파를 함께 펼친다. */
  private impact(x: number, y: number, power: number) {
    const effect = this.impacts[this.impactIndex++ % this.impacts.length]
    this.tweens.killTweensOf(effect)
    const size = TEX * (0.65 + power * 0.22)
    effect
      .setPosition(x, y)
      .setScale(size * 0.3)
      .setAlpha(1)
      .setRotation(Math.random() * Math.PI)
      .setVisible(true)
    this.hitSpark.explode(5 + power * 3, x, y)
    this.tweens.add({
      targets: effect,
      scale: size,
      alpha: 0,
      duration: 210 + power * 25,
      ease: 'Cubic.easeOut',
      onComplete: () => effect.setVisible(false),
    })
  }

  private finish(win: boolean, reason: Outcome['reason']) {
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
      this.opts.onDone({
        kills: this.kills,
        mentalLeft: Math.ceil(this.mental),
        win,
        reason,
        segments: this.mode === 'advance' ? this.segment : 0,
        stars:
          this.mode === 'advance'
            ? stars(
                {
                  win,
                  seconds: this.elapsed,
                  mentalLeft: this.mental,
                  maxMental: this.loadout.maxMental,
                },
                BATTLE_SECONDS,
              )
            : 0,
      }),
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
      segment:
        this.mode === 'advance'
          ? { at: Math.min(SEGMENTS.length, this.segment + 1), total: SEGMENTS.length }
          : null,
      boss: this.bossEnemy
        ? { name: BOSS.name, hp: Math.max(0, this.bossEnemy.hp) / BOSS.hp }
        : null,
    })
  }

  update(time: number, dtMs: number) {
    if (this.over && !this.player) return
    this.pushHud()
    if (this.over || this.stopped || this.choosing || this.paused) {
      return
    }
    const dt = dtMs / 1000
    this.elapsed += dt
    if (this.elapsed >= BATTLE_SECONDS) {
      // 디펜스는 버티면 이기고, 전진 모드는 시간 안에 못 넘으면 진다 (364번).
      if (this.mode === 'advance') {
        this.finish(false, 'time')
      } else {
        this.finish(true, 'clear')
      }
      return
    }

    // 붙박이 (332번): 자리는 고정, 누르고 있는 쪽을 쏜다. 그림(341번)은 맞았으면 울상(총을 놓친다), 누르고 있으면 눈썹 꾹, 아니면 가만히.
    // 총은 따로 겨누는 쪽으로 돈다: 누르면 그쪽, 아니면 가장 가까운 적.
    const p = this.player
    const ptr = this.input.activePointer
    const { w, h } = this.view()
    p.setVelocity(0, 0)
    if (this.mode === 'advance') {
      // 드래그 이동 (364번): 손가락이 움직인 만큼 따라가되, 한 프레임에 갈 수 있는 거리는 moveSpeed로 묶는다.
      if (this.drag && ptr.isDown) {
        const tx = this.drag.cx + (ptr.worldX - this.drag.px)
        const ty = this.drag.cy + (ptr.worldY - this.drag.py)
        const dx = tx - p.x
        const dy = ty - p.y
        const dist = Math.hypot(dx, dy)
        const step = Math.min(dist, this.loadout.moveSpeed * dt)
        if (dist > 0.5) {
          this.movePlayer(p.x + (dx / dist) * step, p.y + (dy / dist) * step)
        }
      }
    } else {
      p.setPosition(w / 2, this.playerY())
    }
    const hurting = time < this.hurtUntil
    p.setTexture(hurting ? 'hero-hurt' : ptr.isDown ? 'hero-fire' : 'hero-idle')
    // 숨쉬기: 살짝 눌렸다 펴진다.
    if (!this.tweens.isTweening(p)) {
      p.setDisplaySize(HERO_SIZE.w, HERO_SIZE.h * (1 + Math.sin(time / 260) * 0.025))
    }
    if (!ptr.isDown || this.mode === 'advance') {
      const near = this.mode === 'advance' ? this.autoTarget() : this.nearestEnemy()
      if (near) {
        const want = Math.atan2(near.y - (p.y + GUN.dy), near.x - (p.x + GUN.dx))
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
      this.wall.setPosition(0, this.wallY() - WALL_H).setDisplaySize(w, WALL_H * 3)
      this.wall.setTexture(this.mental <= this.loadout.maxMental / 2 ? 'wall-cracked' : 'wall')
      this.wall.setAlpha(0.55 + (0.45 * this.mental) / this.loadout.maxMental)
      this.wallZone.setPosition(w / 2, this.wallY()).setSize(w, WALL_H * 2)
      ;(this.wallZone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
    }

    if (time - this.lastFire > this.loadout.fireMs) {
      this.shoot(time)
    }

    if (this.mode === 'advance') {
      this.advanceStep(dt, h)
    }

    // 생성: 한 판(2분)에 걸쳐 갈수록 빨라진다. 파도는 15초마다 투매 → 투기 → 패닉 순으로 돌고 뒤로 갈수록 커진다 (340·363번).
    const every = Math.max(200, 700 - this.curve() * 2.6)
    if (this.mode === 'defense' && time - this.lastSpawn > every) {
      this.lastSpawn = time
      const r = Math.random()
      this.spawn(r < 0.6 ? 'panic' : r < 0.82 ? 'dump' : r < 0.95 ? 'stop' : 'spec')
    }
    if (this.mode === 'defense' && this.elapsed >= this.nextWave) {
      const n = Math.floor(this.nextWave / WAVE_SECONDS) % 3
      if (n === 1) {
        this.waveDump()
      } else if (n === 2) {
        this.waveSpec()
      } else {
        this.wavePanic()
      }
      this.nextWave += WAVE_SECONDS
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
      if (this.mode === 'advance') {
        // 길막 적은 천천히 사장냥 쪽으로 다가오고, 아래로 지나가면 다시 위에서 내려온다. 달려드는 패닉은 지나가면 사라진다.
        if (e.y > h + 50) {
          if (e.blocker) {
            e.setPosition(Phaser.Math.Between(Math.round(w * 0.16), Math.round(w * 0.84)), -40)
          } else {
            e.disableBody(true, true)
            continue
          }
        }
        if (e.boss) {
          // 보스: 화면 위쪽(높이의 18%)까지 내려와 좌우로 오간다. 밀리지 않는다.
          const tx = w / 2 + Math.sin(this.elapsed * 0.8) * w * 0.28
          e.kbx = 0
          e.kby = 0
          e.setVelocity((tx - e.x) * 2, (h * 0.18 - e.y) * 2)
        } else {
          const drift = Phaser.Math.Clamp(p.x - e.x, -1, 1) * 25
          e.setVelocity(e.kbx + (e.blocker ? drift : 0), (e.blocker ? sy * 0.55 : sy * 1.4) + e.kby)
        }
      } else {
        e.setVelocity(e.kbx, sy + e.kby)
      }
      e.kbx *= 0.86
      e.kby *= 0.86
      // 전투 시간 기준이라 일시정지·카드 선택 뒤에도 같은 발걸음에서 이어진다.
      const frame = walkFrame(e.kind, this.elapsed - e.born, e.walkOffset, this.reducedMotion)
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
    backgroundColor: '#bfe8cf',
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
    setPaused: (paused) => scene.setPaused(paused),
    stop: () => {
      ro.disconnect()
      game.destroy(true)
    },
  }
}
