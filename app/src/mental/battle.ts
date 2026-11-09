import Phaser from 'phaser'
import { sfx } from '../fx/sound'
import {
  type BattleMode,
  BOSS,
  bossSummonSeconds,
  DEFENSE_BOSS_SECONDS,
  defenseStars,
  formation,
  PER_CHAPTER,
  SCROLL_SECONDS,
  SEGMENTS,
  STAGE_RAMP,
  type StageSpec,
  stageSpec,
  stars,
  TRICKLE_SECONDS,
} from './advance'
import {
  bakeEnemies,
  bakeHero,
  bakeMagic,
  bakeMates,
  bakeStage,
  DPR,
  enemyKey,
  GUN,
  HERO_SIZE,
  mateGunKey,
  mateKey,
  WALL_H,
} from './art'
import { STAGE_ASSETS } from './assets'
import { bulletStats, type Loadout, MAGICS, type Magic, type MagicLevels, xpToNext } from './cards'
import {
  BURN_TICK_SECONDS,
  CRIT_POOL,
  DAMAGE_FONT_PX,
  DAMAGE_POOL,
  DAMAGE_STYLE,
  type DamageKind,
  DamagePool,
  damageLabel,
  scatterOffset,
} from './damageNumbers'
import { ENEMIES, type EnemyKind } from './enemies'
import { WALK_FRAMES, walkFrame } from './enemyWalk'
import { BATTLE_SECONDS, GENRES, type Genre, PACE, WAVE_SECONDS } from './genres'
import type { Hero } from './hero'
import { BULLET_H, BULLET_W, bulletHitbox } from './hitbox'
import {
  chainTargets,
  densest,
  fireStats,
  type LightningStats,
  lightningStats,
  MagicClock,
  magicTier,
  nearestTo,
  strongest,
  sweepHits,
  type WaterStats,
  waterStats,
} from './magic'
import { MATE_LOOKS, mateFormation } from './mates'
import { wallOffset } from './stageArt'
import {
  aimWithJitter,
  FIRE_STYLES,
  pierceOf,
  SLOW_FACTOR,
  SLOW_SECONDS,
  weaponDamage,
} from './weaponEffects'

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
  /** 전진 모드의 스테이지 판 (369번). 없으면 다섯 구간 + 보스. */
  stage?: StageSpec
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
  /** 기관단총에 맞아 이 전투 시각(초)까지 느리다 (376번). */
  slowUntil: number
  /** 느린 동안의 빠르기 배율(기관단총·물 마법, 376·392번). */
  slowFactor: number
  /** 불 마법에 타는 동안(전투 시각, 초)과 초당 피해 (392번). */
  burnUntil: number
  burnDps: number
  /** 화상 피해를 숫자로 묶는 중(391번): 지난 숫자 뒤로 탄 피해와 시간(초). BURN_TICK_SECONDS마다 하나로 띄운다. */
  burnShown: number
  burnTick: number
  /** 지금 칠해 둔 빛: 없음·파랑(느림)·주황(화상). */
  chilled: boolean
  tintKind: 0 | 1 | 2
}
type Bullet = Phaser.Physics.Arcade.Image & {
  life: number
  look: 0 | 1
  damage: number
  power: number
  /** 2단계부터 맞은 자리에서 터져 휘말리게 하는 반지름(px)과 피해. 0이면 없다. */
  splashRadius: number
  splashDamage: number
  /** 앞으로 더 맞힐 수 있는 적의 수(소총 관통, 376번)와 이미 맞힌 적. */
  pierce: number
  hitList: Enemy[]
  /** 꼬리를 남기는 간격(ms): 무기마다 다르다 (#563). 마지막으로 남긴 때. */
  trailMs: number
  trailAt?: number
}
/** 데미지 숫자 한 칸: 합칠 때 다시 튀게 하는 크기 트윈. */
type DamageText = Phaser.GameObjects.Text & { punch: Phaser.Tweens.Tween | null }

/** 마법을 쏘는 주체 (392번): 자리와 마법 시계. 사장냥 하나에 함께 싸우는 고양이(393번)마다 하나씩 더해 같은 마법을 제 자리에서 쓴다. */
interface MagicCaster {
  at: () => { x: number; y: number }
  clock: MagicClock
}
/**
 * 함께 싸우는 고양이 (393번): 그림·총·시전자. 사장냥과 똑같이 세다(같은 수치로 쏘고 같은 마법을 쓴다). 몸(충돌)은 없다: 멘탈벽 뒤에 서서 쏘기만
 * 하고 적에게 맞지 않는다.
 */
interface Mate {
  body: Phaser.GameObjects.Image
  gun: Phaser.GameObjects.Image
  caster: MagicCaster
  aim: number
  lastFire: number
  /** 합류할 때 위에서 떨어지는 높이(px). 트윈이 0으로 줄인다. */
  drop: number
}
/** 여러 시전자가 같은 마법을 한꺼번에 겹쳐 쏘지 않게 시전자마다 늦추는 초. */
const CAST_STAGGER = 0.18
/** 같은 마법 소리를 이 간격(ms) 안에 또 내지 않는다: 고양이 넷이 함께 쏘면 소리가 뭉개지고 폰에서 오디오 노드가 쌓였다. */
const SOUND_GAP_MS = 90
/** 날아가는 물(풀에서 돌려 쓴다): 물방울·물줄기·큰 물결. half·depth는 지금 맞는 폭(sweepHits). */
interface WaterShot {
  img: Phaser.GameObjects.Image
  active: boolean
  level: number
  x: number
  y: number
  dx: number
  dy: number
  half: number
  depth: number
  travelled: number
  hitList: Enemy[]
}
/** 포물선으로 날아가는 불덩이: 출발·도착 자리와 진행(0~1). */
interface FireShot {
  img: Phaser.GameObjects.Image
  active: boolean
  level: number
  sx: number
  sy: number
  tx: number
  ty: number
  height: number
  t: number
  duration: number
}
/** 불덩이가 떨어진 자리에 남는 불길: 그동안 들어온 적도 탄다. */
interface FirePatch {
  img: Phaser.GameObjects.Image
  active: boolean
  level: number
  x: number
  y: number
  until: number
  nextTick: number
}
/** 물이 날아갈 수 있는 거리(px)와, 끝에서 이만큼 남으면 옅어지기 시작한다. */
const WATER_RANGE = 820
const WATER_FADE = 140
/** 불길이 둘레의 적을 태우는 간격(초). */
const PATCH_TICK = 0.25

/** 개발 서버의 확인 스크립트(app/scripts/stageCheck.ts)가 읽는 데미지 숫자 집계. 운영 빌드에는 내보내지 않는다. */
export interface DamageStats {
  /** 새로 띄운 숫자 수(종류별)와 합친 횟수, 죽이는 마지막 한 방에 띄운 숫자 수, 한꺼번에 떠 있던 최대 수. */
  shown: Record<DamageKind, number>
  merged: number
  killing: number
  peak: number
  /** 마법이 나간 횟수 (392번). */
  casts: Record<Magic, number>
  /** 함께 싸우는 고양이가 쏜 총알 수와 지금 고양이 수 (393번). */
  mateShots: number
  mates: number
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
  private readonly spec: StageSpec
  /** 이 판 보스의 최대 체력: 스테이지가 키운다. */
  private bossMax = BOSS.hp
  /** 지금 수치. 개발 서버의 확인 스크립트가 마법 레벨만 바꿔 넣을 때 읽는다(startBattle). */
  loadout: Loadout
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
  /** 디펜스 번호 스테이지(509번): 적 체력 배율과, 보스를 이미 불렀나. EX(스테이지 없음)는 배율 1이고 보스가 없다. */
  private readonly hpScale: number
  /** 디펜스 번호 스테이지의 적 수·빠르기·멘탈 피해 배율 (#565). EX 디펜스는 1. */
  private readonly countScale: number
  private readonly speedScale: number
  private readonly dmgScale: number
  private readonly defenseBoss: boolean
  private bossCalled = false
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
  /** 데미지 숫자 풀(391번): 보통 숫자(종류마다 글자 색, 잉크 윤곽)와 치명타(금빛 글자·빨간 윤곽). */
  private damage!: DamagePool<DamageText>
  private crits!: DamagePool<DamageText>
  readonly damageStats: DamageStats = {
    shown: { bullet: 0, crit: 0, water: 0, fire: 0, lightning: 0, burn: 0, chain: 0 },
    merged: 0,
    killing: 0,
    peak: 0,
    casts: { water: 0, fire: 0, lightning: 0 },
    mateShots: 0,
    mates: 0,
  }
  /** 마법 (392번): 쏘는 주체들과 풀에서 돌려 쓰는 탄·불길·번개 줄기·빛, 마법마다 파티클 하나. */
  private casters: MagicCaster[] = []
  /** 함께 싸우는 고양이 (393번): 들어온 차례대로. */
  private mates: Mate[] = []
  /** 지금 쏠 곳과 그것을 찾은 때(update). */
  private target: { x: number; y: number } | null = null
  private targetAt = 0
  private lastSound: Partial<Record<'splash' | 'whoosh' | 'boom' | 'zap', number>> = {}
  private waters: WaterShot[] = []
  private embers: FireShot[] = []
  private patches: FirePatch[] = []
  private patchIndex = 0
  private bolts: Phaser.GameObjects.Graphics[] = []
  private boltIndex = 0
  private rings: Phaser.GameObjects.Image[] = []
  private ringIndex = 0
  private glows: Phaser.GameObjects.Image[] = []
  private glowIndex = 0
  private pillars: Phaser.GameObjects.Image[] = []
  private pillarIndex = 0
  private waterFx!: Phaser.GameObjects.Particles.ParticleEmitter
  private fireFx!: Phaser.GameObjects.Particles.ParticleEmitter
  private boltFx!: Phaser.GameObjects.Particles.ParticleEmitter
  /** 마법이 노릴 화면 안의 적(magicTargets)과 번개 줄기의 꺾인 점: 매번 새로 만들지 않는다. */
  private targetBuf: Enemy[] = []
  private readonly boltXs = new Float32Array(48)
  private readonly boltYs = new Float32Array(48)

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
    this.spec = opts.stage ?? stageSpec(PER_CHAPTER)
    this.hpScale = opts.stage?.hpScale ?? 1
    const scaled = opts.mode === 'defense' ? opts.stage : undefined
    this.countScale = scaled?.countScale ?? 1
    this.speedScale = scaled?.speedScale ?? 1
    this.dmgScale = scaled?.dmgScale ?? 1
    this.defenseBoss = opts.mode === 'defense' && Boolean(opts.stage?.boss)
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
    for (const m of MAGICS) {
      // 마법을 새로 배우거나 레벨이 올랐다: 새 연출이 곧바로 한 번 나간다. 고양이가 여럿이면 차례로 조금씩 늦게.
      if (loadout[m] > this.loadout[m]) {
        for (const [i, c] of this.casters.entries())
          c.clock.ready(m, this.elapsed + i * CAST_STAGGER)
      }
    }
    this.loadout = { ...loadout, heal: 0 }
    this.syncMates()
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
    bakeMates(this, this.opts.hero)
    bakeEnemies(this)
    bakeMagic(this)

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
      } else if (this.player) {
        this.player.setPosition(this.standX(0), this.playerY())
        this.gun?.setPosition(this.player.x + GUN.dx, this.playerY() + GUN.dy)
      }
      for (const [i, m] of this.mates.entries()) m.body.setX(this.standX(i + 1))
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
      if (bullet.hitList.includes(enemy)) {
        return
      }
      const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x)
      const [bx, by] = [bullet.x, bullet.y]
      this.impact(bx, by, bullet.power)
      // 무기마다 다른 효과 (376번): 소총은 뚫고 지나가고, 리볼버는 치명타, 기관단총은 맞은 적을 느리게 한다.
      bullet.hitList.push(enemy)
      if (--bullet.pierce <= 0) {
        bullet.disableBody(true, true)
      }
      const kind = this.opts.hero.weapon.kind
      const shot = weaponDamage(kind, bullet.damage, Math.random())
      if (kind === 'smg') {
        this.slow(enemy, SLOW_FACTOR, SLOW_SECONDS)
      }
      this.hit(enemy, shot.damage, angle, shot.crit ? 'crit' : 'bullet')
      if (bullet.splashRadius > 0) {
        this.splash(bx, by, bullet.splashRadius, bullet.splashDamage, enemy)
      }
    })
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Enemy
      if (enemy.active && !enemy.dying) {
        this.hurt(
          Math.round(
            (enemy.boss ? BOSS.dmg : ENEMIES[enemy.kind].dmg) * this.staged(this.dmgScale),
          ),
          enemy,
        )
      }
    })
    if (this.wallZone) {
      // 디펜스: 적이 멘탈벽에 닿으면 멘탈이 깎이고 적은 터진다.
      this.physics.add.overlap(this.wallZone, this.enemies, (_z, e) => {
        const enemy = e as Enemy
        if (enemy.active && !enemy.dying) {
          this.hurt(
            Math.round(ENEMIES[enemy.kind].dmg * this.staged(this.dmgScale)),
            undefined,
            enemy.x,
          )
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
        // 고양이 넷이 쏘면 탄이 넷 배라 꼬리 수를 묶는다 (393번).
        maxAliveParticles: 160,
      })
      .setDepth(3)
    this.hitSpark = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 120, max: 260 },
        lifespan: { min: 120, max: 220 },
        scale: { start: 1.6 * TEX, end: 0 },
        tint: [0xffffff, 0xffe08a],
        emitting: false,
        maxAliveParticles: 120,
      })
      .setDepth(7)
    this.createMagic()
    // 총구 화염은 고양이 넷이 함께 쏘아도 모자라지 않게 (393번).
    for (let i = 0; i < 12; i++) {
      this.flashes.push(this.add.image(0, 0, 'flash').setDepth(6).setVisible(false))
    }
    for (let i = 0; i < 20; i++) {
      this.impacts.push(this.add.image(0, 0, 'bullet-impact').setDepth(7).setVisible(false))
    }
    // 알림 글자(멘탈 ±·투기 진압! 같은 말)는 데미지 숫자보다 위에 둔다.
    for (let i = 0; i < 16; i++) {
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
          .setDepth(9)
          .setVisible(false),
      )
    }
    const damageText = (fill: string, stroke: string, thickness: number) =>
      Object.assign(
        this.add
          .text(0, 0, '', {
            fontFamily: '"Jua", "Gowun Dodum", sans-serif',
            fontSize: `${DAMAGE_FONT_PX}px`,
            color: fill,
            stroke,
            strokeThickness: thickness,
            resolution: DPR,
          })
          .setOrigin(0.5)
          .setDepth(8)
          .setVisible(false),
        { punch: null },
      ) as DamageText
    this.damage = new DamagePool(
      Array.from({ length: DAMAGE_POOL }, () => damageText('#ffffff', INK, 5)),
    )
    this.crits = new DamagePool(
      Array.from({ length: CRIT_POOL }, () => damageText('#ffd84d', '#c4123f', 7)),
    )

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

  /**
   * 한 줄로 늘어선 자리의 x (393번, mates.ts): 0은 사장냥, 1부터 함께 싸우는 고양이. 디펜스는 멘탈벽 뒤 가운데에 줄 전체를 두고, 전진 모드는 사장냥을
   * 따라다닌다(화면 밖으로 나가지 않게).
   */
  private standX(i: number) {
    const { w } = this.view()
    const line = mateFormation(this.mates.length + 1, w)
    const off = line[i] ?? 0
    if (this.mode === 'defense' || !this.player) return w / 2 + off
    return Phaser.Math.Clamp(this.player.x + off - line[0], 28, w - 28)
  }

  /** 고양이 수를 수치에 맞춘다. 실제 판에서는 늘기만 하고, 개발 서버의 확인 스크립트가 줄이면 뒤에서부터 뺀다. */
  private syncMates() {
    if (!this.player) return
    const want = Phaser.Math.Clamp(Math.floor(this.loadout.mates), 0, MATE_LOOKS.length)
    while (this.mates.length > want) {
      const m = this.mates.pop()
      if (!m) break
      this.tweens.killTweensOf(m)
      m.body.destroy()
      m.gun.destroy()
      this.casters = this.casters.filter((c) => c !== m.caster)
    }
    while (this.mates.length < want) this.addMate()
    this.damageStats.mates = this.mates.length
  }

  /** 고양이 한 마리가 제자리 위에서 떨어져 내려와 합류한다: 쿵, 고리, 이름. 배운 마법은 곧 한 번씩 보여 준다. */
  private addMate() {
    const i = this.mates.length
    const y = this.mode === 'defense' ? this.playerY() : this.player.y
    const body = this.add
      .image(this.player.x, y, mateKey(i))
      .setDisplaySize(HERO_SIZE.w, HERO_SIZE.h)
      .setDepth(5)
    const gun = this.add
      .image(body.x + GUN.dx, y + GUN.dy, mateGunKey(i))
      .setRotation(this.aim)
      .setOrigin(GUN.ox, GUN.oy)
      .setDisplaySize(GUN.w, GUN.h)
      .setDepth(6)
    const mate: Mate = {
      body,
      gun,
      caster: { at: () => ({ x: body.x, y: body.y - 24 }), clock: new MagicClock() },
      aim: this.aim,
      // 사장냥과 번갈아 쏘게 연사 간격 안에서 조금씩 어긋나게 시작한다.
      lastFire: this.lastFire + (this.loadout.fireMs * (i + 1)) / (MATE_LOOKS.length + 1),
      drop: this.reducedMotion ? 0 : -150,
    }
    this.mates.push(mate)
    this.casters.push(mate.caster)
    for (const m of MAGICS) {
      if (this.loadout[m] > 0)
        mate.caster.clock.ready(m, this.elapsed + 0.45 + this.casters.length * CAST_STAGGER)
    }
    // 늘어선 자리가 바뀌었다: 새 고양이는 제자리에서 내려오고 나머지는 옆으로 비켜선다(update가 미끄러지게 옮긴다).
    body.setPosition(this.standX(i + 1), y + mate.drop)
    gun.setPosition(body.x + GUN.dx, body.y + GUN.dy)
    const land = () => {
      const fx = body.x
      const fy = body.y + 30
      this.ring(fx, fy, 0xffffff, 56, 320)
      this.glow(fx, fy - 20, 0xffe7a8, 60, 360, 0.7)
      this.hitSpark.explode(this.fx(14), fx, fy)
      this.pop(fx, body.y - 56, `${MATE_LOOKS[i].name} 합류!`, '#ffe08a', 22)
      sfx.mateJoin()
      if (!this.reducedMotion) this.cameras.main.shake(120, 0.004)
    }
    if (this.reducedMotion) {
      land()
      return
    }
    this.tweens.add({
      targets: mate,
      drop: 0,
      duration: 460,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        // 튀는 끝값이 부동소수 오차로 0이 아닐 수 있어 딱 맞춘다(내려앉아야 쏜다).
        mate.drop = 0
        land()
      },
    })
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
        // 스테이지가 뒤로 갈수록 길막 적이 단단하다 (369번).
        e.hp = ENEMIES[spot.kind].hp * this.spec.hpScale
        this.blockersLeft++
      }
    }
  }

  /** 길막 적을 다 잡았다: 다음 구간으로 화면이 올라가거나, 마지막이면 깼다. */
  private segmentCleared() {
    this.segment++
    const last = this.segment >= this.spec.segments
    if (last && !this.spec.boss) {
      // 보스가 없는 스테이지는 마지막 구간을 넘으면 바로 깬다 (369번).
      this.opts.onBanner('돌파!! 멘탈 전진 성공', '#ffd84d')
      this.finish(true, 'clear')
      return
    }
    sfx.levelUp()
    this.opts.onBanner(
      last ? `${BOSS.name} 등장!!` : `구간 돌파! ${this.segment}/${this.spec.segments}`,
      last ? '#ff4f6d' : '#7be0c3',
    )
    this.scrolling = SCROLL_SECONDS
    this.pushHud(true)
  }

  /** 디펜스 보스 스테이지 (509번): 한 판의 한가운데에 보스가 나와 위에서 졸개를 부른다. 보스를 쓰러뜨리면 깬다. */
  private defenseBossStep() {
    if (!this.bossCalled) {
      if (this.elapsed >= DEFENSE_BOSS_SECONDS) {
        this.bossCalled = true
        sfx.levelUp()
        this.opts.onBanner(`${BOSS.name} 등장!!`, '#ff4f6d')
        this.startBoss()
      }
      return
    }
    const boss = this.bossEnemy
    if (
      boss?.active &&
      !boss.dying &&
      this.elapsed - this.lastSummon > bossSummonSeconds(boss.hp, this.bossMax)
    ) {
      this.lastSummon = this.elapsed
      this.summon(boss)
    }
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
    this.bossMax = BOSS.hp * this.spec.hpScale
    e.hp = this.bossMax
    e.setScale(ENEMY_K * BOSS.scale)
    this.bossEnemy = e
    this.lastSummon = this.elapsed
    this.cameras.main.shake(260, 0.012)
    this.pushHud(true)
  }

  /** 보스가 졸개를 부른다: 보스 발밑에서 사장냥 쪽으로 부채꼴로 내려간다. */
  private summon(boss: Enemy) {
    const { w } = this.view()
    const count = Math.round(BOSS.summonCount * this.countScale)
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 46
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
    e.slowUntil = 0
    e.slowFactor = 1
    e.burnUntil = 0
    e.burnDps = 0
    e.burnShown = 0
    e.burnTick = 0
    e.chilled = false
    e.tintKind = 0
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
    // 디펜스 번호 스테이지는 뒤로 갈수록 적이 단단하다 (509번).
    e.hp = this.mode === 'defense' ? v.hp * this.staged(this.hpScale) : v.hp
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
        if (this.segment >= this.spec.segments) {
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
        this.elapsed - this.lastSummon > bossSummonSeconds(boss.hp, this.bossMax)
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

  /**
   * 스테이지 배율을 판 안에서 천천히 건다 (#565): 처음에는 STAGE_RAMP.from만큼만, STAGE_RAMP.seconds에 걸쳐 끝까지. 카드가 쌓이기 전 첫 20초에 판이
   * 갈려 결과가 운(첫 카드)에 달리던 것을 줄인다.
   */
  private staged(scale: number) {
    const k = Math.min(
      1,
      STAGE_RAMP.from + ((1 - STAGE_RAMP.from) * this.elapsed) / STAGE_RAMP.seconds,
    )
    return 1 + (scale - 1) * k
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
    const n = Math.round(15 * grow * this.staged(this.countScale))
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
    for (
      let i = 0;
      i < Math.round((1 + Math.floor(this.curve() / 100)) * this.staged(this.countScale));
      i++
    ) {
      this.spawn('spec')
    }
  }

  private wavePanic() {
    this.opts.onBanner('패닉셀 떼가 몰려온다!!!', '#3a86ff')
    const { w, h } = this.view()
    // 두 겹의 반원 떼: 처음 24, 뒤로 갈수록 44까지. 전에는 10~20이라 떼 같지 않았다.
    const n = Math.round((24 + Math.min(20, this.curve() / 8)) * this.staged(this.countScale))
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

  /**
   * 데미지 숫자 하나 (391번): 적이 피해를 받는 모든 경우에 부른다. 종류(총알·치명타·물·불·번개·불 지속·번개 튐)마다 색과 크기가 다르다. 같은 적의 같은
   * 종류는 MERGE_MS 안이면 떠 있는 숫자에 더해 하나로 보이고, 새 숫자는 적 머리 위에서 살짝 흩뿌려 떠오르며 빨리 사라진다. 텍스트는 풀에서 돌려 쓴다:
   * 글자 크기는 하나로 두고 종류별 크기는 배율로만 바꿔, 글자나 색이 바뀔 때만 한 번 다시 그린다.
   */
  private damageNumber(e: Enemy, amount: number, kind: DamageKind) {
    if (amount <= 0) return
    const style = DAMAGE_STYLE[kind]
    const pool = kind === 'crit' ? this.crits : this.damage
    const { slot, merged, n } = pool.take(e, kind, amount, this.time.now)
    const t = slot.item
    const label = damageLabel(kind, slot.total)
    if (t.style.color !== style.color) {
      // 색만 바꾸고(다시 그리지 않음) 아래 setText 또는 updateText로 한 번만 그린다.
      t.style.color = style.color
      if (t.text === label) t.updateText()
    }
    t.setText(label)
    const stats = this.damageStats
    if (e.hp <= 0) stats.killing++
    if (merged) {
      // 합친 숫자는 제자리에서 한 번 더 튄다. 떠오르며 사라지는 트윈은 처음 뜬 때 그대로라 오래 남지 않는다.
      stats.merged++
      t.punch?.stop()
      t.setScale(style.scale * 1.25)
      t.punch = this.tweens.add({ targets: t, scale: style.scale, duration: 90 })
      return
    }
    stats.shown[kind]++
    this.tweens.killTweensOf(t)
    const { w } = this.view()
    const { dx, dy } = scatterOffset(n)
    // 머리 위: 충돌 원 반지름(텍스처 px)에 지금 크기를 곱한다. 부푼 투기·큰 보스도 머리 위에 뜬다.
    const r = ENEMIES[e.kind].r * DPR * Math.abs(e.scaleY)
    const x = Phaser.Math.Clamp(e.x + dx, 16, w - 16)
    const y = e.y - r - 10 + dy
    const big = kind === 'crit' ? 1.7 : 1.3
    t.setPosition(x, y)
      .setAlpha(1)
      .setScale(style.scale * big)
      .setVisible(true)
    t.punch = this.tweens.add({
      targets: t,
      scale: style.scale,
      duration: kind === 'crit' ? 160 : 110,
      ease: 'Back.easeOut',
    })
    this.tweens.add({
      targets: t,
      y: y - style.rise,
      alpha: { value: 0, ease: 'Quad.easeIn' },
      duration: style.life,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        t.setVisible(false)
        pool.release(slot)
      },
    })
    stats.peak = Math.max(stats.peak, this.damage.live() + this.crits.live())
  }

  private hit(e: Enemy, dmg: number, angle: number, kind: DamageKind = 'bullet') {
    e.hp -= dmg
    // 하얗게 번쩍, 들썩임, 데미지 숫자: 맞은 느낌의 세 가지.
    e.setTintFill(0xffffff)
    this.time.delayedCall(55, () => e.active && this.paint(e))
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
    // 데미지 숫자는 모든 적, 죽이는 마지막 한 방까지 (391번, 334번의 "한 방에 안 죽는 적에만"을 뒤집음). 리볼버 치명타(376번)는 크고 노랗다.
    this.damageNumber(e, dmg, kind)
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
      this.opts.onBanner(
        this.mode === 'advance' ? '돌파!! 멘탈 전진 성공' : '보스 격파!! 멘탈 지켜냈다',
        '#ffd84d',
      )
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
    if (!boss?.active || boss.dying || !near || near === boss) {
      return near
    }
    const close = (near.x - this.player.x) ** 2 + (near.y - this.player.y) ** 2 < 150 * 150
    return close ? near : boss
  }

  /** 총구 자리: 쏘는 고양이의 총 피벗에서 겨누는 쪽으로 총 길이만큼. */
  private muzzle(x: number, y: number, aim: number) {
    const px = x + GUN.dx
    const py = y + GUN.dy
    return { x: px + Math.cos(aim) * GUN.len, y: py + Math.sin(aim) * GUN.len }
  }

  /**
   * 이번에 쏠 곳: 디펜스에서 누르고 있으면 누른 자리, 전진 모드는 자동 조준의 과녁, 디펜스에서 안 누르면 사장냥 총에서 520px 안의 가장 가까운 적.
   * 함께 싸우는 고양이도 같은 곳을 제 총에서 겨눠 쏜다(393번: 같은 방향으로).
   */
  private shotTarget(): { x: number; y: number } | null {
    const ptr = this.input.activePointer
    const gx = this.player.x + GUN.dx
    const gy = this.player.y + GUN.dy
    // 전진 모드는 손가락이 이동이라 늘 자동 조준이다 (364번).
    if (ptr.isDown && this.mode === 'defense') return { x: ptr.worldX, y: ptr.worldY }
    if (this.mode === 'advance') return this.autoTarget()
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
    return best
  }

  /** 각도는 총 피벗에서 잰다: 고양이 가운데에서 재면 가까운 적은 총구가 비켜 있어 빗나간다. */
  private angleFrom(x: number, y: number, target: { x: number; y: number }) {
    return Math.atan2(target.y - (y + GUN.dy), target.x - (x + GUN.dx))
  }

  /** 한 발 쏜다. mate가 없으면 사장냥, 있으면 그 고양이가 같은 수치(무기·피해·연사·강화)로 쏜다(393번). */
  private fire(now: number, aim: number, mate?: Mate) {
    const p = mate ? mate.body : this.player
    const kind = this.opts.hero.weapon.kind
    const style = FIRE_STYLES[kind]
    // 무기마다 쏘는 방식 (#563): 총은 겨눈 쪽(aim)을 보고, 탄만 흩어진다(기관단총).
    const base = aimWithJitter(kind, aim, Math.random())
    if (mate) {
      mate.lastFire = now
      mate.aim = aim
      this.damageStats.mateShots++
    } else {
      this.lastFire = now
      // 총소리는 사장냥 것만: 넷이 다 내면 뭉개지고 오디오 노드가 쌓인다.
      sfx.shot(kind)
      this.aim = aim
      if (style.shake && !this.reducedMotion) this.cameras.main.shake(style.shakeMs, style.shake)
    }
    // 총 손맛: 총구 화염, 반동(눌렸다 펴짐). 크기·시간이 무기마다 다르다.
    const m = this.muzzle(p.x, p.y, aim)
    const flash = this.flashes[this.flashIndex++ % this.flashes.length]
    flash
      .setPosition(m.x, m.y)
      .setRotation(aim)
      .setScale(TEX * style.flash)
      .setAlpha(1)
      .setVisible(true)
    this.tweens.killTweensOf(flash)
    this.tweens.add({
      targets: flash,
      scale: 0.6 * TEX * style.flash,
      alpha: 0,
      duration: style.flashMs,
      onComplete: () => flash.setVisible(false),
    })
    // 산탄총: 총구 앞으로 불꽃이 부채꼴로 튄다(탄은 한 덩이, 362번).
    for (let i = 0; i < style.sparks && !this.reducedMotion; i++) {
      const a = aim + ((i / (style.sparks - 1)) * 2 - 1) * 0.45
      this.trail.emitParticleAt(m.x + Math.cos(a) * 18, m.y + Math.sin(a) * 18)
      this.trail.emitParticleAt(m.x + Math.cos(a) * 32, m.y + Math.sin(a) * 32)
    }
    this.tweens.killTweensOf(p)
    const [sx, sy] = [HERO_SIZE.w / p.width, HERO_SIZE.h / p.height]
    p.setScale(sx * (1 + 0.1 * style.recoil), sy * (1 - 0.08 * style.recoil))
    this.tweens.add({
      targets: p,
      scaleX: sx,
      scaleY: sy,
      duration: 80 + 30 * style.recoil,
      ease: 'Back.easeOut',
    })
    const stats = bulletStats(this.loadout)
    const b = this.bullets.get(m.x, m.y, 'bullet-0') as Bullet | null
    if (!b) return
    b.setTexture('bullet-0').enableBody(true, m.x, m.y, true, true).setDepth(4)
    b.look = 0
    b.trailMs = style.trailMs
    b.damage = stats.damage
    b.power = stats.power
    b.splashRadius = stats.splashRadius
    b.splashDamage = stats.splashDamage
    b.pierce = pierceOf(kind)
    b.hitList = []
    b.setDisplaySize(
      BULLET_W * stats.scale * style.length,
      BULLET_H * stats.scale * style.width,
    ).setRotation(base)
    // 무기 빛 위에 강화 단계가 오를수록 주황을 더 섞는다.
    const powerTint = [0xffffff, 0xffdd99, 0xffb966, 0xff9955][stats.power]
    b.setTint(stats.power && kind === 'pistol' ? powerTint : style.tint)
    const hb = bulletHitbox(b.width, b.height, style.length)
    b.body?.setCircle(hb.radius, hb.ox, hb.oy)
    b.setVelocity(
      Math.cos(base) * this.loadout.bulletSpeed,
      Math.sin(base) * this.loadout.bulletSpeed,
    )
    b.life = now + BULLET_LIFE
  }

  /** 적의 빛: 화상이면 주황, 느리면 파랑, 아니면 원래대로. */
  private paint(e: Enemy) {
    if (e.tintKind === 2) e.setTint(0xffb38a)
    else if (e.tintKind === 1) e.setTint(0x9fd4ff)
    else e.clearTint()
  }

  /** 느리게 한다: 더 느린 쪽, 더 오래 가는 쪽을 남긴다. */
  private slow(e: Enemy, factor: number, seconds: number) {
    const active = e.slowUntil > this.elapsed
    e.slowFactor = active ? Math.min(e.slowFactor, factor) : factor
    e.slowUntil = Math.max(e.slowUntil, this.elapsed + seconds)
  }

  // ── 마법 (392번): 총알과 따로, 제 주기에 스스로 나간다. 레벨이 오를수록 연출이 세 단계로 화려해진다.

  /** 마법의 풀과 파티클을 만든다. 탄·불길·줄기·빛은 미리 만들어 돌려 쓰고, 파티클은 한꺼번에 살아 있는 수를 묶어 폰에서 끊기지 않게 한다. */
  private createMagic() {
    this.casters.push({
      at: () => ({ x: this.player.x, y: this.player.y - 24 }),
      clock: new MagicClock(),
    })
    const soft = (config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) =>
      this.add
        .particles(0, 0, 'magic-soft', { emitting: false, maxAliveParticles: 140, ...config })
        .setDepth(6)
    this.waterFx = soft({
      speed: { min: 60, max: 240 },
      lifespan: { min: 260, max: 520 },
      scale: { start: 0.9 * TEX, end: 0 },
      alpha: { start: 1, end: 0.3 },
      gravityY: 420,
      tint: [0xffffff, 0xbfe8ff, 0x6cc0ff, 0x2f8fe8],
    })
    this.fireFx = soft({
      speed: { min: 30, max: 190 },
      lifespan: { min: 300, max: 640 },
      scale: { start: 1.3 * TEX, end: 0.2 * TEX },
      alpha: { start: 1, end: 0 },
      gravityY: -160,
      tint: [0xfff6c0, 0xffd04d, 0xff8a2a, 0xff4a1a, 0xd9261a],
    })
    this.boltFx = this.add
      .particles(0, 0, 'spark', {
        emitting: false,
        maxAliveParticles: 100,
        speed: { min: 120, max: 380 },
        lifespan: { min: 120, max: 300 },
        scale: { start: 1.8 * TEX, end: 0 },
        tint: [0xffffff, 0xfff27a, 0xffd23f, 0x9d8cff],
      })
      .setDepth(7)
    const hidden = (key: string, depth: number) =>
      this.add.image(0, 0, key).setDepth(depth).setVisible(false)
    // 풀은 고양이 넷이 같은 마법을 써도 모자라지 않게 392번의 두 배로 잡는다 (393번). 파티클은 위의 상한이 묶는다.
    for (let i = 0; i < 16; i++) {
      this.waters.push({
        img: hidden('magic-drop', 4),
        active: false,
        level: 1,
        x: 0,
        y: 0,
        dx: 0,
        dy: -1,
        half: 0,
        depth: 0,
        travelled: 0,
        hitList: [],
      })
    }
    for (let i = 0; i < 12; i++) {
      this.embers.push({
        img: hidden('magic-ember', 6),
        active: false,
        level: 1,
        sx: 0,
        sy: 0,
        tx: 0,
        ty: 0,
        height: 0,
        t: 0,
        duration: 1,
      })
      this.patches.push({
        img: hidden('magic-scorch', 2.5),
        active: false,
        level: 1,
        x: 0,
        y: 0,
        until: 0,
        nextTick: 0,
      })
      this.bolts.push(this.add.graphics().setDepth(6).setVisible(false))
    }
    for (let i = 0; i < 20; i++) {
      this.rings.push(hidden('magic-ring', 6))
      this.glows.push(hidden('magic-glow', 5))
    }
    for (let i = 0; i < 6; i++) this.pillars.push(hidden('magic-pillar', 6).setOrigin(0.5, 1))
  }

  /** 마법 소리: 같은 소리는 SOUND_GAP_MS 안에 한 번만 (393번, 고양이 넷이 함께 쓸 때). */
  private magicSound(key: 'splash' | 'whoosh' | 'boom' | 'zap') {
    const now = performance.now()
    if (now - (this.lastSound[key] ?? Number.NEGATIVE_INFINITY) < SOUND_GAP_MS) return
    this.lastSound[key] = now
    sfx[key]()
  }

  /** 줄인 움직임이면 파티클을 반만. */
  private fx(n: number) {
    return this.reducedMotion ? Math.ceil(n / 2) : n
  }

  /** 4·5레벨은 3단계 연출이 조금씩 더 커진다. */
  private grow(level: number) {
    return 1 + Math.max(0, level - 3) * 0.12
  }

  /** 풀에서 꺼낸 빛·고리 하나를 한 번 퍼뜨린다. from·to는 텍스처 크기에 대한 배율. */
  private flare(
    img: Phaser.GameObjects.Image,
    x: number,
    y: number,
    tint: number,
    from: number,
    to: number,
    ms: number,
    alpha = 1,
  ) {
    this.tweens.killTweensOf(img)
    img
      .setPosition(x, y)
      .setTint(tint)
      .setScale(from * TEX)
      .setAlpha(alpha)
      .setVisible(true)
    this.tweens.add({
      targets: img,
      scale: to * TEX,
      alpha: 0,
      duration: ms,
      ease: 'Cubic.easeOut',
      onComplete: () => img.setVisible(false),
    })
  }

  /** 반지름 r(px)의 고리와 빛. 고리 텍스처는 반지름 36, 빛은 32. */
  private ring(x: number, y: number, tint: number, r: number, ms: number) {
    this.flare(this.rings[this.ringIndex++ % this.rings.length], x, y, tint, 0.25, r / 36, ms)
  }
  private glow(x: number, y: number, tint: number, r: number, ms: number, alpha = 0.8) {
    this.flare(this.glows[this.glowIndex++ % this.glows.length], x, y, tint, 0.3, r / 32, ms, alpha)
  }

  /** 마법이 노릴 수 있는 적: 살아 있고 화면 안에 들어온 적. 같은 배열을 다시 채운다. */
  private magicTargets(): Enemy[] {
    const buf = this.targetBuf
    buf.length = 0
    const { w, h } = this.view()
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (e.active && !e.dying && e.y > 12 && e.y < h && e.x > 0 && e.x < w) buf.push(e)
    }
    return buf
  }

  /** 시전자마다 주기가 된 마법을 쏜다. 노릴 적이 없거나 풀이 다 날고 있으면 잠시 뒤 다시 본다. */
  private castMagic() {
    for (const caster of this.casters) {
      for (const m of MAGICS) {
        const level = this.loadout[m]
        if (!caster.clock.due(m, level, this.elapsed)) continue
        const from = caster.at()
        const cast =
          m === 'water'
            ? this.castWater(from, level)
            : m === 'fire'
              ? this.castFire(from, level)
              : this.castLightning(from, level)
        if (cast) {
          caster.clock.cast(m, level, this.elapsed)
          this.damageStats.casts[m]++
        } else {
          caster.clock.retry(m, this.elapsed)
        }
      }
    }
  }

  private updateMagic(dt: number) {
    for (const s of this.waters) if (s.active) this.moveWater(s, dt)
    for (const s of this.embers) if (s.active) this.moveEmber(s, dt)
    for (const p of this.patches) if (p.active) this.burnPatch(p)
  }

  /** 불에 탄다: 타는 중이면 더 센 불과 더 긴 시간을 남긴다. 피해는 update의 화상 틱이 준다. */
  private ignite(e: Enemy, dps: number, seconds: number) {
    const burning = e.burnUntil > this.elapsed
    e.burnDps = burning ? Math.max(e.burnDps, dps) : dps
    e.burnUntil = Math.max(e.burnUntil, this.elapsed + seconds)
  }

  // 물: 가까운 적에게 물방울(Lv.1, 맞으면 터져 둘레를 적신다) → 물줄기(Lv.2, 꿰뚫는다) → 큰 물결(Lv.3, 넓게 쓸고 간다). 맞은 적은 느려진다.

  private castWater(from: { x: number; y: number }, level: number): boolean {
    const target = nearestTo(this.magicTargets(), from)
    const s = this.waters.find((w) => !w.active)
    if (!target || !s) return false
    const tier = magicTier(level)
    const a = Math.atan2(target.y - from.y, target.x - from.x)
    s.active = true
    s.level = level
    s.x = from.x
    s.y = from.y
    s.dx = Math.cos(a)
    s.dy = Math.sin(a)
    s.travelled = 0
    s.hitList.length = 0
    s.depth = tier === 3 ? 18 : 12
    s.img
      .setTexture(tier === 3 ? 'magic-wave' : 'magic-drop')
      .setPosition(s.x, s.y)
      .setRotation(a)
      .setAlpha(1)
      .setVisible(true)
    if (tier === 1) s.img.setDisplaySize(36, 23)
    else if (tier === 2) s.img.setDisplaySize(92, 26)
    this.moveWater(s, 0)
    this.waterFx.explode(this.fx(3 * tier), from.x, from.y)
    this.magicSound('splash')
    return true
  }

  private moveWater(s: WaterShot, dt: number) {
    const st = waterStats(s.level)
    const tier = magicTier(s.level)
    const step = st.speed * dt
    s.x += s.dx * step
    s.y += s.dy * step
    s.travelled += step
    // 큰 물결은 나아가며 넓어진다.
    s.half = tier === 3 ? Math.min(st.half, 24 + s.travelled * 0.5) : st.half
    const { w, h } = this.view()
    const left = WATER_RANGE - s.travelled
    if (left <= 0 || s.y < -80 || s.y > h + 80 || s.x < -80 || s.x > w + 80) {
      this.endWater(s)
      return
    }
    s.img.setPosition(s.x, s.y).setAlpha(Math.min(1, left / WATER_FADE))
    if (tier === 3) s.img.setDisplaySize(58 * this.grow(s.level), s.half * 2.1)
    if (dt > 0) {
      // 꼬리 물보라: 물방울은 가끔, 물줄기는 촘촘히, 물결은 폭 전체에서 거품이 튄다.
      if (tier === 1) {
        if (Math.random() < 0.5) this.waterFx.emitParticleAt(s.x - s.dx * 12, s.y - s.dy * 12)
      } else if (tier === 2) {
        this.waterFx.emitParticleAt(s.x - s.dx * 30, s.y - s.dy * 30, 2)
      } else {
        for (let i = 0; i < this.fx(2); i++) {
          const k = (Math.random() * 2 - 1) * s.half
          this.waterFx.emitParticleAt(s.x - s.dy * k, s.y + s.dx * k)
        }
      }
    }
    const angle = Math.atan2(s.dy, s.dx)
    for (const e of this.magicTargets()) {
      if (s.hitList.includes(e) || !sweepHits(s, e, ENEMIES[e.kind].r)) continue
      if (!st.pierce) {
        this.waterSplash(s, st, e.x, e.y)
        return
      }
      s.hitList.push(e)
      this.waterFx.explode(this.fx(2 + tier), e.x, e.y)
      this.waterHit(e, st, angle)
    }
  }

  /** 물방울이 처음 맞은 적에서 터진다: 둘레의 적이 모두 젖는다. */
  private waterSplash(s: WaterShot, st: WaterStats, x: number, y: number) {
    this.endWater(s)
    this.ring(x, y, 0x6cc0ff, st.splash, 260)
    this.glow(x, y, 0xbfe8ff, st.splash * 0.8, 200, 0.6)
    this.waterFx.explode(this.fx(10), x, y)
    const angle = Math.atan2(s.dy, s.dx)
    for (const e of this.magicTargets()) {
      const reach = st.splash + ENEMIES[e.kind].r
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= reach * reach) this.waterHit(e, st, angle)
    }
  }

  private waterHit(e: Enemy, st: WaterStats, angle: number) {
    this.slow(e, st.slowFactor, st.slowSeconds)
    this.hit(e, st.damage * this.loadout.damage, angle, 'water')
  }

  private endWater(s: WaterShot) {
    s.active = false
    s.img.setVisible(false)
  }

  // 불: 적이 가장 많이 모인 곳에 불씨(Lv.1) → 불덩이(Lv.2) → 불기둥과 폭발(Lv.3)을 던진다. 떨어진 둘레가 타고 불길이 잠시 남는다.

  private castFire(from: { x: number; y: number }, level: number): boolean {
    const st = fireStats(level)
    const target = densest(this.magicTargets(), st.radius)
    const s = this.embers.find((f) => !f.active)
    if (!target || !s) return false
    const tier = magicTier(level)
    const d = Math.hypot(target.x - from.x, target.y - from.y)
    s.duration = 0.36 + d / 1600
    // 내려오는 적이 닿을 자리를 앞질러 노린다.
    const v = target.body?.velocity
    s.active = true
    s.level = level
    s.sx = from.x
    s.sy = from.y
    s.tx = target.x + (v?.x ?? 0) * s.duration
    s.ty = target.y + (v?.y ?? 0) * s.duration
    s.height = Math.min(140, d * 0.35)
    s.t = 0
    s.img
      .setPosition(from.x, from.y)
      .setScale(TEX * [0.75, 1.15, 1.6][tier - 1] * this.grow(level))
      .setAlpha(1)
      .setVisible(true)
    this.magicSound('whoosh')
    return true
  }

  private moveEmber(s: FireShot, dt: number) {
    s.t = Math.min(1, s.t + dt / s.duration)
    const x = s.sx + (s.tx - s.sx) * s.t
    const y = s.sy + (s.ty - s.sy) * s.t - Math.sin(Math.PI * s.t) * s.height
    s.img.setPosition(x, y).setRotation(s.img.rotation + dt * 9)
    this.fireFx.emitParticleAt(x, y, magicTier(s.level) === 3 ? 2 : 1)
    if (s.t >= 1) {
      s.active = false
      s.img.setVisible(false)
      this.fireExplode(s.tx, s.ty, s.level)
    }
  }

  private fireExplode(x: number, y: number, level: number) {
    const st = fireStats(level)
    const tier = magicTier(level)
    const grow = this.grow(level)
    this.ring(x, y, 0xff8a2a, st.radius, 260 + tier * 60)
    this.glow(x, y, 0xffc04d, st.radius * 0.9, 240 + tier * 40, 0.85)
    this.fireFx.explode(this.fx([8, 16, 28][tier - 1]), x, y)
    if (tier >= 2) this.glow(x, y, 0xff5a1f, st.radius * 0.55, 380)
    if (tier === 3) {
      // 불기둥: 솟구쳤다 사그라든다. 두 번째 고리가 늦게 퍼지며 폭발이 크게 보인다.
      const pillar = this.pillars[this.pillarIndex++ % this.pillars.length]
      this.tweens.killTweensOf(pillar)
      pillar
        .setPosition(x, y + st.radius * 0.25)
        .setScale(TEX * 1.1 * grow, 0)
        .setAlpha(1)
        .setVisible(true)
      this.tweens.add({
        targets: pillar,
        scaleY: TEX * 1.25 * grow,
        duration: 180,
        ease: 'Back.easeOut',
        onComplete: () =>
          this.tweens.add({
            targets: pillar,
            alpha: 0,
            scaleX: TEX * 0.6 * grow,
            delay: 120,
            duration: 520,
            onComplete: () => pillar.setVisible(false),
          }),
      })
      this.time.delayedCall(90, () => this.ring(x, y, 0xffd04d, st.radius * 1.25, 360))
      if (!this.reducedMotion) this.cameras.main.shake(110, 0.004)
    }
    this.magicSound('boom')
    const dmg = st.damage * this.loadout.damage
    const dps = st.burnDps * this.loadout.damage
    for (const e of this.magicTargets()) {
      const reach = st.radius + ENEMIES[e.kind].r
      if ((e.x - x) ** 2 + (e.y - y) ** 2 > reach * reach) continue
      this.ignite(e, dps, st.burnSeconds)
      this.hit(e, dmg, Math.atan2(e.y - y, e.x - x), 'fire')
    }
    const p = this.patches[this.patchIndex++ % this.patches.length]
    p.active = true
    p.level = level
    p.x = x
    p.y = y
    p.until = this.elapsed + st.patchSeconds
    p.nextTick = this.elapsed + PATCH_TICK
    p.img
      .setPosition(x, y)
      .setDisplaySize(st.radius * 2.2, st.radius * 1.2)
      .setAlpha(0.75)
      .setVisible(true)
  }

  /** 남은 불길: 틱마다 불꽃이 일렁이고 둘레에 들어온 적에 불이 붙는다. 끝나기 0.4초 전부터 옅어진다. */
  private burnPatch(p: FirePatch) {
    const left = p.until - this.elapsed
    if (left <= 0) {
      p.active = false
      p.img.setVisible(false)
      return
    }
    p.img.setAlpha(Math.min(0.75, (left / 0.4) * 0.75))
    if (this.elapsed < p.nextTick) return
    p.nextTick = this.elapsed + PATCH_TICK
    const st = fireStats(p.level)
    for (let i = 0; i < this.fx(magicTier(p.level)); i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * st.radius * 0.8
      this.fireFx.emitParticleAt(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.55)
    }
    const dps = st.burnDps * this.loadout.damage
    for (const e of this.magicTargets()) {
      const reach = st.radius + ENEMIES[e.kind].r
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= reach * reach) this.ignite(e, dps, st.burnSeconds)
    }
  }

  // 번개: 하늘에서 체력이 가장 많은 적에게 내리꽂혀 옆 적에게 차례로 튄다. 가는 줄기(Lv.1) → 굵은 번개(Lv.2) → 여러 갈래(Lv.3).

  private castLightning(from: { x: number; y: number }, level: number): boolean {
    const st = lightningStats(level)
    const list = this.magicTargets()
    const struck: Enemy[] = []
    for (let i = 0; i < st.bolts; i++) {
      const target = strongest(list, from, struck)
      if (!target) break
      struck.push(target)
    }
    if (struck.length === 0) return false
    // 맞아 죽은 적이 목록에서 빠지기 전에 튈 곳까지 정한다.
    const plans = struck.map((t) => ({
      t,
      chain: chainTargets(t, list, st.chains, st.chainRadius),
    }))
    for (const { t, chain } of plans) this.strike(t, chain, st, level)
    this.magicSound('zap')
    return true
  }

  private strike(target: Enemy, chain: Enemy[], st: LightningStats, level: number) {
    const tier = magicTier(level)
    const width = [2, 4, 5.5][tier - 1] * this.grow(level)
    const g = this.bolts[this.boltIndex++ % this.bolts.length]
    this.tweens.killTweensOf(g)
    g.clear().setAlpha(1).setVisible(true)
    this.drawBolt(
      g,
      target.x + Phaser.Math.Between(-40, 40),
      -20,
      target.x,
      target.y,
      width,
      [0, 1, 3][tier - 1],
    )
    let prev = target
    for (const o of chain) {
      this.drawBolt(g, prev.x, prev.y, o.x, o.y, Math.max(1.5, width * 0.55), 0)
      prev = o
    }
    this.glow(target.x, target.y, 0xfff27a, [24, 40, 60][tier - 1] * this.grow(level), 220)
    if (tier >= 2) this.ring(target.x, target.y, 0xffe94d, [0, 42, 66][tier - 1], 240)
    this.boltFx.explode(this.fx([6, 12, 22][tier - 1]), target.x, target.y)
    // 번쩍임: 단계가 높을수록 여러 번 깜박인 뒤 사라진다.
    this.tweens.add({
      targets: g,
      alpha: 0.25,
      duration: 45,
      yoyo: true,
      repeat: tier - 1,
      onComplete: () =>
        this.tweens.add({
          targets: g,
          alpha: 0,
          duration: 110 + tier * 50,
          onComplete: () => g.setVisible(false),
        }),
    })
    const dmg = st.damage * this.loadout.damage
    this.hit(target, dmg, Math.PI / 2, 'lightning')
    prev = target
    for (const o of chain) {
      this.boltFx.explode(this.fx(3), o.x, o.y)
      if (o.active && !o.dying) {
        this.hit(o, dmg * st.chainDamage, Math.atan2(o.y - prev.y, o.x - prev.x), 'chain')
      }
      prev = o
    }
  }

  /**
   * 번개 줄기 하나: 두 점 사이를 꺾인 선으로, 보랏빛 번짐(밝은 바닥에서도 보이게) → 노란 줄기 → 흰 심 세 겹. forks만큼 곁가지가 아래로 갈라진다.
   */
  private drawBolt(
    g: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    forks: number,
  ) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    const xs = this.boltXs
    const ys = this.boltYs
    const n = Math.min(xs.length - 1, Math.max(4, Math.round(len / 22)))
    const nx = -(y2 - y1) / len
    const ny = (x2 - x1) / len
    const jag = Math.min(16, len * 0.08)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const off = i === 0 || i === n ? 0 : (Math.random() * 2 - 1) * jag
      xs[i] = x1 + (x2 - x1) * t + nx * off
      ys[i] = y1 + (y2 - y1) * t + ny * off
    }
    const stroke = (lw: number, color: number, alpha: number) => {
      g.lineStyle(lw, color, alpha)
      g.beginPath()
      g.moveTo(xs[0], ys[0])
      for (let i = 1; i <= n; i++) g.lineTo(xs[i], ys[i])
      g.strokePath()
    }
    stroke(width * 3.2, 0x6b5cff, 0.28)
    stroke(width, 0xffe24d, 1)
    stroke(Math.max(1, width * 0.4), 0xffffff, 1)
    // 곁가지는 꺾인 점을 다 쓴 뒤에 그린다(같은 버퍼를 다시 쓰므로 갈라질 자리를 먼저 적어 둔다).
    const main = Math.atan2(y2 - y1, x2 - x1)
    const starts: [number, number, number][] = []
    for (let f = 0; f < forks; f++) {
      const i = 1 + Math.floor(Math.random() * Math.max(1, n * 0.7))
      const a = main + (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.45)
      starts.push([xs[i], ys[i], a])
    }
    for (const [fx, fy, a] of starts) {
      const l = 40 + Math.random() * 50
      this.drawBolt(g, fx, fy, fx + Math.cos(a) * l, fy + Math.sin(a) * l, width * 0.5, 0)
    }
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
            : this.opts.stage
              ? defenseStars(win, this.mental, this.loadout.maxMental)
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
          ? { at: Math.min(this.spec.segments, this.segment + 1), total: this.spec.segments }
          : null,
      boss: this.bossEnemy
        ? { name: BOSS.name, hp: Math.max(0, this.bossEnemy.hp) / this.bossMax }
        : null,
    })
  }

  /** 함께 싸우는 고양이: 제자리로 미끄러지고, 숨 쉬고, 같은 곳을 겨눠 연사 간격마다 쏜다 (393번). */
  private updateMates(time: number, dt: number, target: { x: number; y: number } | null) {
    const y = this.mode === 'defense' ? this.playerY() : this.player.y
    const k = Math.min(1, dt * 8)
    const turn = Math.min(1, dt * 10)
    for (const [i, m] of this.mates.entries()) {
      const b = m.body
      b.setPosition(b.x + (this.standX(i + 1) - b.x) * k, y + m.drop)
      if (!this.tweens.isTweening(b)) {
        b.setDisplaySize(HERO_SIZE.w, HERO_SIZE.h * (1 + Math.sin(time / 260 + i * 1.7) * 0.025))
      }
      if (target) {
        const want = this.angleFrom(b.x, b.y, target)
        if (m.drop === 0 && time - m.lastFire > this.loadout.fireMs) {
          this.fire(time, want, m)
        } else {
          m.aim += Phaser.Math.Angle.Wrap(want - m.aim) * turn
        }
      }
      m.gun
        .setPosition(b.x + GUN.dx, b.y + GUN.dy)
        .setRotation(m.aim)
        .setFlipY(Math.cos(m.aim) < 0)
    }
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
      // 디펜스는 버티면 이기고, 전진 모드와 디펜스 보스 스테이지는 시간 안에 못 넘으면(보스를 못 잡으면) 진다 (364·509번).
      if (this.mode === 'advance' || this.defenseBoss) {
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
      // 고양이가 늘면 줄이 넓어지며 사장냥도 제자리로 미끄러진다 (393번).
      p.setPosition(p.x + (this.standX(0) - p.x) * Math.min(1, dt * 8), this.playerY())
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

    // 사장냥과 함께 싸우는 고양이가 같은 곳을 저마다 제 총으로 쏜다 (393번). 과녁 찾기는 적 풀 전체를 도니 누가 쏠 때거나 80ms마다만 새로 찾는다.
    const fireMs = this.loadout.fireMs
    const due = time - this.lastFire > fireMs || this.mates.some((m) => time - m.lastFire > fireMs)
    if (due || time - this.targetAt > 80) {
      this.target = this.shotTarget()
      this.targetAt = time
    }
    const target = this.target
    if (target && time - this.lastFire > fireMs) {
      this.fire(time, this.angleFrom(p.x, p.y, target))
    }
    this.updateMates(time, dt, target)
    // 마법은 총알과 따로 제 주기에 스스로 나간다 (392번).
    this.castMagic()
    this.updateMagic(dt)

    if (this.mode === 'advance') {
      this.advanceStep(dt, h)
    } else if (this.defenseBoss) {
      this.defenseBossStep()
    }

    // 생성: 한 판(2분)에 걸쳐 갈수록 빨라진다. 파도는 15초마다 투매 → 투기 → 패닉 순으로 돌고 뒤로 갈수록 커진다 (340·363번).
    const every = Math.max(200, 700 - this.curve() * 2.6) / this.staged(this.countScale)
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
      // 기관단총·물 마법에 맞으면 잠깐 느리고 파르스름하다 (376·392번). 불 마법에 맞으면 타며 주황빛이다.
      const slowed = e.slowUntil > this.elapsed
      const burning = e.burnUntil > this.elapsed
      if (burning) {
        const burn = e.burnDps * dt
        e.hp -= burn
        // 화상 숫자는 틱마다 작게 (391번): 매 프레임 띄우면 숫자로 덮이니 BURN_TICK_SECONDS 동안 탄 만큼을 하나로.
        e.burnShown += burn
        e.burnTick += dt
        if (e.burnTick >= BURN_TICK_SECONDS || e.hp <= 0) {
          this.damageNumber(e, e.burnShown, 'burn')
          e.burnShown = 0
          e.burnTick = 0
        }
        if (e.hp <= 0) {
          this.kill(e, true)
          continue
        }
      } else if (e.burnShown > 0) {
        // 틱 사이에 불이 꺼졌다: 남은 만큼 마저 띄운다.
        this.damageNumber(e, e.burnShown, 'burn')
        e.burnShown = 0
        e.burnTick = 0
      }
      e.chilled = slowed
      const tintKind = burning ? 2 : slowed ? 1 : 0
      if (tintKind !== e.tintKind) {
        e.tintKind = tintKind
        this.paint(e)
      }
      const speed = v.speed * this.staged(this.speedScale)
      const sy = slowed ? speed * e.slowFactor : speed
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
      if (e.boss) {
        // 보스: 화면 위쪽(높이의 18%)까지 내려와 좌우로 오간다. 밀리지 않고 벽까지 내려오지 않는다.
        const tx = w / 2 + Math.sin(this.elapsed * 0.8) * w * 0.28
        e.kbx = 0
        e.kby = 0
        e.setVelocity((tx - e.x) * 2, (h * 0.18 - e.y) * 2)
      } else if (this.mode === 'advance') {
        // 길막 적은 천천히 사장냥 쪽으로 다가오고, 아래로 지나가면 다시 위에서 내려온다. 달려드는 패닉은 지나가면 사라진다.
        if (e.y > h + 50) {
          if (e.blocker) {
            e.setPosition(Phaser.Math.Between(Math.round(w * 0.16), Math.round(w * 0.84)), -40)
          } else {
            e.disableBody(true, true)
            continue
          }
        }
        const drift = Phaser.Math.Clamp(p.x - e.x, -1, 1) * 25
        e.setVelocity(e.kbx + (e.blocker ? drift : 0), (e.blocker ? sy * 0.55 : sy * 1.4) + e.kby)
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
      if (time - (b.trailAt ?? 0) >= b.trailMs) {
        b.trailAt = time
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
  if (import.meta.env.DEV) {
    // 개발 서버에서만: 확인 스크립트가 데미지 숫자·마법 집계를 읽고, 마법 레벨을 바로 넣어 레벨마다 연출을 찍는다(stageCheck.ts).
    const dev = window as unknown as {
      __mentalDamage?: DamageStats
      __mentalMagic?: (levels: Partial<MagicLevels>) => void
      __mentalMates?: (mates: number) => void
    }
    dev.__mentalDamage = scene.damageStats
    dev.__mentalMagic = (levels) => scene.applyLoadout({ ...scene.loadout, ...levels })
    dev.__mentalMates = (mates) => scene.applyLoadout({ ...scene.loadout, mates })
  }
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
