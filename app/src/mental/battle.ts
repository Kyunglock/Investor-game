import type { IdleAttackKind } from '@web/features/raising/idleContacts'
import Phaser from 'phaser'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { ACTIVE_BANNERS, ACTIVES, type ActiveCode } from './actives'
import {
  type BattleMode,
  BOSS,
  bossSummonSeconds,
  DEFENSE_BOSS_SECONDS,
  defenseStars,
  formation,
  numberedStageScale,
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
  bakeCatRuns,
  bakeEnemies,
  bakeHero,
  bakeMagic,
  bakeMates,
  bakeOrders,
  bakeStage,
  CELL_CRACKS,
  cellKey,
  DPR,
  enemyKey,
  HERO_SIZE,
  mateKey,
  RAM_ART,
  WALL_H,
  WALL_LABEL_STYLE,
} from './art'
import {
  ASSAULT_BOSS,
  ASSAULT_MOTION,
  ASSAULT_SECONDS,
  type AssaultSpec,
  type AssaultWall,
  assaultPrice,
  assaultSpec,
  assaultStars,
  assaultTarget,
  cellShares,
  climbSpeed,
  idleAssaultSpec,
  MID_BOSS_NAME,
  pickFlow,
  rowHps,
  rushSpawnSeconds,
  spawnSeconds,
  swarmSize,
  wallBreakXp,
  wallCols,
  whaleSummonSeconds,
} from './assault'
import { STAGE_ASSETS } from './assets'
import { BUY_WALL, BuyWall, buyOrderX, idleBuyOrderDamage, pushedByCollapse } from './buyWall'
import { BuyWallFx } from './buyWallFx'
import {
  awakenedMateCount,
  bulletStats,
  type Loadout,
  MAGICS,
  type Magic,
  type MagicLevels,
  type MateGun,
  xpToNext,
} from './cards'
import { catAim, catMuzzle, mateModel } from './catModels'
import { catRunFrame, catRunKey } from './catRun'
import { CIRCUIT_BREAKER, CircuitBreaker } from './circuitBreaker'
import { CircuitBreakerFx } from './circuitBreakerFx'
import {
  CRIT_POOL,
  DAMAGE_FONT_PX,
  DAMAGE_POOL,
  DAMAGE_STYLE,
  type DamageKind,
  DamagePool,
  damageLabel,
  scatterOffset,
} from './damageNumbers'
import {
  crossOrders,
  ENEMIES,
  isOrder,
  orderHp,
  orderShares,
  quantityOrder,
  UNITS,
  type UnitKind,
} from './enemies'
import { WALK_FRAMES, walkFrame } from './enemyWalk'
import { type GameSpeed, simScale } from './gameSpeed'
import { BATTLE_SECONDS, GENRES, type Genre, PACE, WAVE_SECONDS } from './genres'
import { DEFAULT_WEAPON, type Hero, type Weapon } from './hero'
import { BULLET_W, bulletHitbox } from './hitbox'
import { IdleWallQueueFx, idleWallLayout } from './idleWallQueue'
import {
  densest,
  type EarthStats,
  earthStats,
  type LightningStats,
  lightningPlan,
  lightningStats,
  MagicClock,
  magicTier,
  meteorFalloff,
  meteorStats,
  nearestTo,
  ramSpeed,
  siegeTarget,
  sweepHits,
  type WaterStats,
  waterStats,
} from './magic'
import { MATE_LOOKS, mateFormation, spreadTargets } from './mates'
import { OrderBarrierQueue } from './orderBarrier'
import { shareLabel } from './shares'
import { wallOffset } from './stageArt'
import {
  IDLE_RAID,
  IDLE_RAID_BANNERS,
  type IdleRaidKind,
  idleRaidGap,
  idleRaidKind,
  PANIC_RUSH,
  panicRushGap,
  waveKind,
} from './waves'
import {
  aimWithJitter,
  pierceOf,
  SHOT_WEIGHT,
  SLOW_FACTOR,
  SLOW_SECONDS,
  WEAPON_TRAITS,
  type WeaponKind,
  weaponDamage,
} from './weaponEffects'
import { BULLET_ART, BULLET_VISUAL_SCALE, GRADE_FIRE, gradeTint, sparkles } from './weaponVisuals'

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
  /** 공격 판(413번)의 가격 눈금과 벽: 지금 가격·시작가·목표가, 부순 벽과 전체, 벽 앞에 막혀 있나. 다른 모드는 null. */
  assault: AssaultHud | null
}

export interface AssaultHud {
  name: string
  price: number
  start: number
  target: number
  wallsBroken: number
  wallsTotal: number
  /** 지금 벽 앞에 멈춰 쏘는 중. */
  stuck: boolean
}

export interface Outcome {
  kills: number
  mentalLeft: number
  /** 이 판의 최대 멘탈(자본 체력 강화 410번·카드 포함). */
  maxMental: number
  win: boolean
  /** 왜 끝났나: 깼다(디펜스는 시간을 버텼다), 시간이 다 됐다(전진·공격 판 실패), 멘탈이 무너졌다. */
  reason: 'clear' | 'time' | 'mental'
  /** 전진 모드에서 넘긴 구간 수(공격 판은 부순 벽 수). 디펜스는 0. */
  segments: number
  /** 별(0~3): 전진·공격 판은 364번(깨면 1, 절반 시간 안 +1, 멘탈 반 넘게 +1), 디펜스 번호 스테이지는 375번. */
  stars: number
  /** 싸운 시간(초, 소수 한 자리). 카드를 고르거나 멈춘 동안은 빼고 잰다. */
  seconds: number
  /** 공격 판(413번)에서 부순 매도벽 수와 전체 벽 수. 다른 모드는 0. */
  wallsBroken: number
  wallsTotal: number
  /** 공격 판의 시작 가격과 끝난 때의 가격(벽·잡은 물량으로 오른 만큼, #591·#593). 다른 모드는 0. */
  priceStart: number
  priceEnd: number
}

export interface IdleSnapshot {
  circuitSeconds?: number
  upcoming?: { wall: number; hp: number; maxHp: number }[]
  wall: number
  hp: number
  maxHp: number
  /** 서버가 마지막으로 처리한 접속 신호의 순번: 이 순번까지 보낸 명중은 hp에 들어 있다 (496번). */
  sequence?: number
}

export interface BattleOptions {
  /** Foreground idle mode: wall health and progression are server-authoritative. */
  idle?: () => IdleSnapshot
  onIdleHit?: (wall: number, kind: IdleAttackKind, damage: number) => void
  /** 자동 전투의 몬스터 습격 알림 (500번). */
  onIdleRaid?: (text: string, color: string) => void

  /** 처음 배속(gameSpeed.ts). 없으면 1배. */
  speed?: GameSpeed
  /** 전진 모드 또는 디펜스(EX·번호 스테이지) (364번), 공격 판 (413번). */
  mode: BattleMode
  /** 전진 모드의 스테이지 판 (369번). 없으면 다섯 구간 + 보스. */
  stage?: StageSpec
  /** 공격 판의 판 (413번, assault.ts assaultSpec). 없으면 assaultSpec(1). */
  assault?: AssaultSpec
  genre: Genre
  hero: Hero
  loadout: Loadout
  onReady?: () => void
  onError?: (message: string) => void
  onHud: (hud: Hud) => void
  onBanner: (text: string, color: string) => void
  onWallGain?: (amount: number, start: number) => void
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
  /** 전투 배속(gameSpeed.ts): 1배가 예전 빠르기의 절반. */
  setSpeed: (speed: GameSpeed) => void
  /** 자동 전투: 지금까지 맞힌 것이 이 순번의 접속 신호에 실려 나갔다 (496번). */
  idleHitsSent: (sequence: number) => void
  /** 자동 전투: 보내려던 명중을 버렸다(멈춤·끊김). 먼저 빼 둔 피해도 잊는다. */
  clearIdleHits: () => void
  /** 테스트판: 그 종류의 몬스터 습격을 바로 부른다. */
  callIdleRaid: (kind: IdleRaidKind) => void
  /** 자동 전투: 액티브 스킬의 연출과 효과를 낸다 (503번). */
  castActive: (code: ActiveCode) => void
  stop: () => void
}

const INK = '#2b2340'
const BULLET_LIFE = 900
/**
 * 자동 전투에서 먼저 빼 둔 피해를 서버 답 없이 들고 있는 상한(실제 ms). 평소에는 서버가 처리한 순번으로 잊고(496번), 답이 영영 오지 않을 때만
 * 이 시간으로 잊는다. 서버가 늦은 접속 신호를 받아 주는 10초(497번)보다 길다.
 */
const IDLE_HIT_MS = 12000
/** 사격 모션 (513번): 반동 1일 때 뒤로 밀리는 거리(px), 눌리는 비율, 넓어지는 비율, 젖혀지는 각(rad), 그리고 초당 줄어드는 빠르기. */
const RECOIL = { back: 5, squash: 0.07, wide: 0.05, lean: 0.07, decay: 16 }
const recoilDecay = (kick: number, dt: number) =>
  kick < 0.01 ? 0 : kick * Math.exp(-RECOIL.decay * dt)
/** 자동 전투에서 벽 앞에 막힌 시간으로 셈하는 상한(초): 물량 간격이 바탕의 절반까지만 줄어든다 (assault.ts spawnSeconds, 494번). */
const IDLE_STUCK_MAX = 25

type Enemy = Phaser.Physics.Arcade.Image & {
  kind: UnitKind
  hp: number
  /** 처음 체력: 매도벽 칸의 금과 물량 숫자에 쓴다. */
  maxHp: number
  /** 공격 판의 매도벽 칸(413번): 움직이지 않고 벽(wall)과 함께 내려온다. */
  cell: AssaultCell | null
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
  /** 새 매수벽이 몹을 밀어내는 종료 시각(초). */
  wallPushUntil: number
  /** 기관단총에 맞아 이 전투 시각(초)까지 느리다 (376번). */
  slowUntil: number
  /** 느린 동안의 빠르기 배율(기관단총·물 마법, 376·392번). */
  slowFactor: number
  /** 메테오에 맞아 멈추는 종료 시각(초). */
  stunUntil: number
  /** 지금 칠해 둔 빛: 없음·파랑(느림)·주황(기절). */
  chilled: boolean
  tintKind: 0 | 1 | 2
  /** 제 크기(배율): 맞아 들썩인 뒤 늘 여기로 돌아온다. 들썩임이 겹쳐 가로세로가 따로 불어 찌그러지던 것을 막는다. */
  baseK: number
}
type Bullet = Phaser.Physics.Arcade.Image & {
  life: number
  /** 쏜 총 (488번): 고양이가 따로 든 총이면 사장냥 것과 다르다. */
  kind: WeaponKind
  grade: Weapon['grade']
  /** 쏜 총의 치명타 배율에 곱하는 값 (492번, 고양이 특성). */
  critical: number
  look: 0 | 1
  damage: number
  power: number
  /** 2단계부터 맞은 자리에서 터져 휘말리게 하는 반지름(px)과 피해. 0이면 없다. */
  splashRadius: number
  splashDamage: number
  /** 자동 전투에서 사장냥이 매도벽을 겨눠 쏜 탄 (504번): 길 위의 물량을 맞히고 뚫고 지나가 벽까지 간다 (516번). */
  wallShot: boolean
  /** 앞으로 더 맞힐 수 있는 적의 수(소총 관통, 376번)와 이미 맞힌 적. */
  pierce: number
  hitList: Enemy[]
  /** 꼬리를 남기는 간격(ms): 무기마다 다르다 (#563). 마지막으로 남긴 때. */
  trailMs: number
  trailAt?: number
  /** 쏜 자리와 날아갈 수 있는 거리(px, #587). 끝없으면 Infinity. */
  fromX: number
  fromY: number
  range: number
}
/** 데미지 숫자 한 칸: 합칠 때 다시 튀게 하는 크기 트윈. */
type DamageText = Phaser.GameObjects.Text & { punch: Phaser.Tweens.Tween | null }

/** 마법을 쏘는 주체 (392번): 자리와 마법 시계. 사장냥과 각성한 동료가 각자의 시계를 가진다. */
interface MagicCaster {
  mate?: number
  at: () => { x: number; y: number }
  clock: MagicClock
}
/**
 * 함께 싸우는 고양이 (393번): 그림·총. 사장냥과 같은 수치로 쏜다. 각성 카드를 고르면 마법도 쓴다. 몸(충돌)은 없다: 멘탈벽
 * 뒤에 서서 쏘기만 하고 적에게 맞지 않는다.
 */
interface Mate {
  magicMark: Phaser.GameObjects.Text
  body: Phaser.GameObjects.Image
  aim: number
  lastFire: number
  /** 재장전 전까지 쏜 탄 수 (#587, 리볼버). */
  shots: number
  /** 합류할 때 위에서 떨어지는 높이(px). 트윈이 0으로 줄인다. */
  drop: number
  /** 쏜 직후의 반동(0이면 가만히, 513번). 쏠 때 채우고 금세 줄어든다. */
  kick: number
}
/** 공격 판(413번)의 매도벽 하나: 칸들(적 풀의 'cell')과 뒤 판, 가격 이름표. y는 맨 아랫줄의 아래 끝(화면 y)이고 오를 때 함께 내려온다. */
interface WallState {
  spec: AssaultWall
  index: number
  y: number
  cols: number
  cells: Enemy[]
  left: number
  band: Phaser.GameObjects.Image
  price: Phaser.GameObjects.Text
  /** 멈춤 줄에 닿아 사장냥이 멈춰 쏘는 중. */
  arrived: boolean
  bossStarted?: boolean
  broken: boolean
  /** 맨 아래 자리(wall.y에 닿는 층)의 row. 층은 row - base 번째 자리에 서고, 아래층이 부서져도 내려앉지 않는다. */
  base: number
}
/** 매도벽 칸 하나: 자리(줄·칸), 얹힌 물량 글자, 지금 보이는 물량·금 간 정도, 약한 칸인가. */
interface AssaultCell {
  wall: WallState
  row: number
  col: number
  label: Phaser.GameObjects.Text
  shares: number
  crack: number
  weak: boolean
}
/** 매도벽 층 사이 틈(px). 층 높이는 layerHeight, 폭은 길 폭을 칸 수로 나눈다. */
const CELL_GAP = 3
/** 한 덩어리 매도벽(416번)의 체력 = 줄·칸 체력의 합 × 이 비율. stageCheck로 맞췄다. */
const CHUNK_HP = 0.65
/** 매수벽·매도벽·서킷브레이커 조립 벽은 같은 폭을 유지하고 화면 중앙에 맞춘다. */
const LANE_LEFT = 33
const LANE_RIGHT = 33
/** 같은 소리를 이 간격(ms) 안에 또 내지 않는다(체결·금 가는 소리, 마법 소리). */
type SoundKey = 'splash' | 'whoosh' | 'boom' | 'zap' | 'rumble' | 'ram' | 'coin' | 'thud' | 'squish'

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
/** 미리 만든 운석·경고 원·크레이터를 돌려 쓴다. */
interface MeteorShot {
  img: Phaser.GameObjects.Image
  warning: Phaser.GameObjects.Image
  crater: Phaser.GameObjects.Image
  active: boolean
  level: number
  tx: number
  ty: number
  t: number
  delay: number
}
/** 공격 판 클리어 연출(clearShow)을 보이는 시간(ms): 끝나면 결과 화면으로 넘어간다. */
const CLEAR_SHOW_MS = 2300
/** 돌진하는 바위 충차 (433번): 물처럼 곧게 가며 보통 적은 밀쳐 꿰뚫고, 벽 칸·큰손에 닿으면 들이받고 멈춘다. t는 출발한 뒤 시간(초). */
interface RamShot {
  img: Phaser.GameObjects.Image
  active: boolean
  level: number
  x: number
  y: number
  dx: number
  dy: number
  half: number
  depth: number
  t: number
  travelled: number
  /** 다음 돌기둥이 솟을 거리(대지 충차). */
  nextSpike: number
  hitList: Enemy[]
}
/** 충차가 박차고 나가기 전 뒤로 당기는 시간(초). */
const RAM_WINDUP = 0.16
/** 충차가 달릴 수 있는 거리(px). */
const RAM_RANGE = 1500
/** 대지 충차(3단계)가 지나간 길에 돌기둥이 솟는 간격(px). */
const SPIKE_GAP = 48
/** 물이 날아갈 수 있는 거리(px)와, 끝에서 이만큼 남으면 옅어지기 시작한다. */
const WATER_RANGE = 820
const WATER_FADE = 140

/** 개발 서버의 확인 스크립트(app/scripts/stageCheck.ts)가 읽는 데미지 숫자 집계. 운영 빌드에는 내보내지 않는다. */
export interface DamageStats {
  /** 새로 띄운 숫자 수(종류별)와 합친 횟수, 죽이는 마지막 한 방에 띄운 숫자 수, 한꺼번에 떠 있던 최대 수. */
  shown: Record<DamageKind, number>
  merged: number
  killing: number
  peak: number
  /** 마법이 나간 횟수 (392번)와 땅 충차가 벽·큰손을 들이받은 횟수 (433번). */
  rams: number
  casts: Record<Magic, number>
  /** 함께 싸우는 고양이가 쏜 총알 수와 지금 고양이 수 (393번). */
  mateCasts: number[]
  awakenedMates: number
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
/** 종류마다 그림 배율: 매도 물량(413번)은 주문서 숫자가 읽히게 고양이 적보다 크다. */
const unitK = (kind: UnitKind) => ENEMY_K * (UNITS[kind].scale ?? 1)
/** 구워 둔 텍스처(배율만큼 큼)를 CSS px 크기로 놓는 배율. 파티클·화염에 쓴다. */
const TEX = 1 / DPR

/** 공격 판에서 손절·투기·공매도가 처음 나올 때의 배너. */
const ASSAULT_MOB_BANNERS: Record<'stop' | 'spec' | 'short', [string, string]> = {
  stop: ['손절매 출현! 단단하게 들이받는다', '#9ba2ad'],
  spec: ['투기 몬스터 출현! 부풀면 터진다', '#ea4d6a'],
  short: ['공매도 출현! 방패로 버틴다', '#9eb7ff'],
}

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
  private hpScale: number
  /** 디펜스 번호 스테이지의 적 수·빠르기·멘탈 피해 배율 (#565). EX 디펜스는 1. */
  private countScale: number
  private speedScale: number
  private dmgScale: number
  private readonly defenseBoss: boolean
  private bossCalled = false
  /** 공격 판 (413번): 판, 화면에 있는 벽(지금 벽과 다음 벽), 부순 벽 수, 벽을 뚫은 뒤 지난 초, 지금 벽 앞에 막힌 초, 마지막으로 물량이 나온 때. */
  private readonly assault: AssaultSpec | null
  private walls: WallState[] = []
  private idleQueue?: IdleWallQueueFx
  private idleWall = 0
  /** 지금 벽에 방금 맞힌 피해(실제 ms와 양). 서버 값이 따라올 때까지 화면의 벽 체력에서 먼저 뺀다 (493번). */
  /** 먼저 빼 둔 명중. sequence는 실려 나간 접속 신호의 순번이고, 아직 안 나갔으면 없다 (496번). */
  private idleHits: { at: number; amount: number; sequence?: number }[] = []
  private idleTransition = false
  private runRush = 0
  private wallsBroken = 0
  private sinceBreak = 0
  private stuck = 0
  private lastFlow = 0
  /** 벽 사이 잡몹 구간(#593)의 남은 초. 0이면 아니다. 끝나면 다음 벽이 내려온다. */
  private circuitSellQueue = new OrderBarrierQueue()
  private circuitSellClock = 0
  private circuitBuyClock = 0
  private circuit: CircuitBreaker | null = null
  private circuitFx: CircuitBreakerFx | null = null
  private circuitIndex = 0
  private circuitWall: WallState | null = null
  private marketStats = {
    panic: 0,
    dump: 0,
    circuits: 0,
    recovered: 0,
    formedWalls: 0,
    formedPieces: 0,
    wallHpBefore: 0,
    wallHpAfter: 0,
  }
  private rushLeft = 0
  private nextWallIn = 0
  /** 지금 나와 있는 큰손이 중간 큰손인가(#593): 잡아도 판이 끝나지 않고 다음 구간이 열린다. */
  private bossMid = false
  /** 중간 매도벽을 부쉈는데 중간 큰손이 아직 살아 있다: 잡으면 잡몹 구간이 시작된다. */
  private buyWall: BuyWall | null = null
  private buyWallFx: BuyWallFx | null = null
  /** 지금 오르는 빠르기(px/s)와 지금까지 오른 거리(px): 배경·호가 줄·가격 눈금이 이만큼 내려간다. */
  private climbV = 0
  private climbed = 0
  private book: Phaser.GameObjects.Graphics | null = null
  /** 공격 판의 큰손 체력 막대 (457번): 위 HUD가 아니라 보스 바로 아래에 붙어 따라다닌다. */
  private bossBar: Phaser.GameObjects.Graphics | null = null
  private ladder: Phaser.GameObjects.Graphics | null = null
  private speedLines: Phaser.GameObjects.Image[] = []
  private chips: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private fills: Phaser.GameObjects.Text[] = []
  private fillIndex = 0
  /** 개발 서버의 확인 스크립트가 켜는 자동 조종: 약한 벽 칸 밑으로 가고 바로 위 물량은 비킨다. */
  autopilot = false
  private simSpeed = 1
  /** 플레이어가 고른 배속의 실제 빠르기(gameSpeed.ts simScale)와, 확인 스크립트가 덮어쓴 빠르기(개발 서버). */
  private playerScale = simScale(1)
  private devSpeed: number | null = null
  private player!: Phaser.Physics.Arcade.Image
  /** 겨누는 각도(라디안). 누르면 그쪽, 아니면 가장 가까운 적. */
  private aim = -Math.PI / 2
  /** 디펜스의 멘탈벽: 그림(반투명 보호막)과 닿음 판정. 적이 닿으면 멘탈이 깎인다. */
  private wall: Phaser.GameObjects.Image | null = null
  private ripples: Phaser.GameObjects.Image[] = []
  private rippleIndex = 0
  private wallZone: Phaser.GameObjects.Zone | null = null
  private bullets!: Phaser.Physics.Arcade.Group
  private enemies!: Phaser.Physics.Arcade.Group
  private boom!: Record<UnitKind, Phaser.GameObjects.Particles.ParticleEmitter>
  /** 총 손맛: 탄 꼬리, 맞는 자리의 불꽃, 총구 화염 풀. */
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter
  private twinkle!: Phaser.GameObjects.Particles.ParticleEmitter
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
    shown: {
      bullet: 0,
      crit: 0,
      water: 0,
      meteor: 0,
      lightning: 0,
      earth: 0,
      siege: 0,
      chain: 0,
    },
    rams: 0,
    merged: 0,
    killing: 0,
    peak: 0,
    casts: { water: 0, meteor: 0, lightning: 0, earth: 0 },
    mateCasts: [0, 0, 0],
    awakenedMates: 0,
    mateShots: 0,
    mates: 0,
  }
  /** 마법 (392번): 쏘는 주체들과 풀에서 돌려 쓰는 탄·운석·번개 줄기·빛, 마법마다 파티클 하나. */
  private casters: MagicCaster[] = []
  /** 함께 싸우는 고양이 (393번): 들어온 차례대로. */
  private mates: Mate[] = []
  /** 지금 쏠 곳과 그것을 찾은 때(update). */
  private targets: ({ x: number; y: number } | null)[] = []
  private targetAt = 0
  private lastSound: Partial<Record<SoundKey, number>> = {}
  private waters: WaterShot[] = []
  private meteors: MeteorShot[] = []
  private bolts: Phaser.GameObjects.Graphics[] = []
  private boltIndex = 0
  private rings: Phaser.GameObjects.Image[] = []
  private ringIndex = 0
  private glows: Phaser.GameObjects.Image[] = []
  private glowIndex = 0
  private rams: RamShot[] = []
  /** 충차의 "쿵!" 글자(넷을 돌려 쓴다). */
  private thumps: Phaser.GameObjects.Text[] = []
  private thumpIndex = 0
  private spikes: Phaser.GameObjects.Image[] = []
  private spikeIndex = 0
  private waterFx!: Phaser.GameObjects.Particles.ParticleEmitter
  private fireFx!: Phaser.GameObjects.Particles.ParticleEmitter
  private boltFx!: Phaser.GameObjects.Particles.ParticleEmitter
  /** 땅 (433번): 흙먼지와 튀는 돌 조각. */
  private dustFx!: Phaser.GameObjects.Particles.ParticleEmitter
  private rockFx!: Phaser.GameObjects.Particles.ParticleEmitter
  /** 마법이 노릴 화면 안의 적(magicTargets)과 번개 줄기의 꺾인 점: 매번 새로 만들지 않는다. */
  private targetBuf: Enemy[] = []
  private readonly boltXs = new Float32Array(48)
  private readonly boltYs = new Float32Array(48)

  private mental = 100
  private score = 0
  private kills = 0
  private elapsed = 0
  private lastFire = 0
  /** 사장냥이 쏜 탄 수(재장전, #587). */
  private heroShots = 0
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
  /** 공격 판에서 이미 출현 배너를 띄운 몹(손절·투기·공매도). */
  private assaultSeen = new Set<string>()
  /** 다음 패닉셀 러시 시각(초)과, 러시 중이면 아직 나올 패닉셀 수·다음 한 마리까지 남은 시간. */
  private nextPanicRush: number = PANIC_RUSH.first + panicRushGap(Math.random()) / 2
  private panicRushLeft = 0
  /** 자동 전투의 다음 몬스터 습격 시각(전투 초)과 지금까지의 습격 수 (500번). */
  private nextIdleRaid: number = IDLE_RAID.first
  private idleRaids = 0
  /** 사장냥이 쏜 발 수: 자동 전투에서 혼자일 때 세 발에 한 발은 벽을 노린다 (504번). */
  private heroAims = 0
  /** 액티브 스킬 (503번): 매수세례의 남은 주문 수와 시계, 불장이 끝나는 전투 초, 지금 알리는 명중의 종류. */
  private barrageLeft = 0
  private barrageClock = 0
  private rallyUntil = 0
  private reportAs: IdleAttackKind | null = null
  private calledRaid: IdleRaidKind | null = null
  private panicRushClock = 0
  private panicRushEvery = 0
  /** 한 화면에 함께 있는 적의 최대 수(334·340번): 더 있으면 새로 만들지 않는다. */
  /** 동시에 살아 있는 적의 최대: 파도(투매 최대 36, 패닉 최대 44)가 잘리지 않게 넉넉히. */
  private static readonly MAX_ALIVE = 100

  constructor(opts: BattleOptions) {
    super('battle')
    this.opts = opts
    this.genre = GENRES[opts.genre]
    this.mode = opts.mode
    this.spec = opts.stage ?? stageSpec(PER_CHAPTER)
    this.assault = opts.mode === 'assault' ? (opts.assault ?? assaultSpec(1)) : null
    this.hpScale = this.assault?.enemyHp ?? opts.stage?.hpScale ?? 1
    const scaled = opts.mode === 'defense' ? opts.stage : undefined
    this.countScale = this.assault?.enemyCount ?? scaled?.countScale ?? 1
    this.speedScale = this.assault?.enemySpeed ?? scaled?.speedScale ?? 1
    this.dmgScale = this.assault?.enemyDmg ?? scaled?.dmgScale ?? 1
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
    } else if (!this.circuit && !this.stopped) {
      this.physics.resume()
    }
    this.pushHud(true)
  }

  /** 자동 전투의 매수벽은 물량과 같은 배율로 두꺼워진다 (498번): 매수 대 매도의 균형은 그대로이고, 물량을 지우는 데 드는 화력만 는다. */
  private buyWallMental() {
    return this.loadout.maxMental * (this.opts.idle ? this.hpScale : 1)
  }

  idleHitsSent(sequence: number) {
    for (const hit of this.idleHits) hit.sequence ??= sequence
  }

  clearIdleHits() {
    this.idleHits = []
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
    this.buyWall?.resize(this.buyWallMental())
    this.bakeMateGuns()
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
        this.mode === 'assault'
          ? '매도벽을 부수고 다음 벽으로!'
          : this.mode === 'advance'
            ? '전진! 길을 막는 불안을 치워라'
            : '분기 시작! 멘탈 꽉 잡아',
        this.mode === 'assault' ? '#e8434f' : '#3a86ff',
      )
      // 공격 판은 첫 카드를 고르면 한 번 쭉 치고 오르며 시작한다.
      this.sinceBreak = 0
    }
    if (!this.over && !this.paused && !this.circuit && !this.stopped) {
      this.physics.resume()
    }
    this.pushHud(true)
  }

  preload() {
    for (const [key, url] of Object.entries(STAGE_ASSETS)) this.load.image(`art-${key}`, url)
  }

  create() {
    this.applySpeed()
    if (Object.keys(STAGE_ASSETS).some((key) => !this.textures.exists(`art-${key}`))) {
      this.over = true
      this.opts.onError?.('전장 그림을 불러오지 못했어요. 다시 시도해주세요.')
      return
    }
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.opts.onReady?.()
    bakeStage(this, this.opts.genre)
    bakeHero(this, this.opts.hero.weapon.grade)
    this.bakeMateGuns()
    bakeEnemies(this)
    bakeMagic(this)
    if (this.assault) bakeOrders(this, this.hpScale)

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
        if (this.player) this.moveHero()
      } else if (this.mode === 'assault') {
        if (this.player) this.moveHero()
        for (const wall of this.walls) {
          if (this.opts.idle) {
            wall.y = wall.arrived ? this.stopY() : Math.min(wall.y, this.stopY())
          }
          this.layoutWall(wall)
          this.placeWall(wall)
        }
      } else if (this.player) {
        this.player.setPosition(this.standX(0), this.playerY())
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
    if (this.mode === 'assault') {
      this.createAssault(w, h)
    }
    if (this.mode === 'advance') {
      // 같은 그림을 위에 하나 더 이어 붙여 함께 내린다: 그림 하나로 끝없이 올라가는 길. 뒤집어 붙이면 이음매는 맞지만 집이 거꾸로 보였다.
      this.bg2 = this.add.image(0, -h, 'art-street').setOrigin(0).setDisplaySize(w, h)
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
      if (bullet.hitList.includes(enemy) || this.beyondWall(enemy)) {
        return
      }
      // 벽을 겨눈 탄은 길 위의 물량을 맞히고 뚫고 지나간다 (516번). 전에는 맞히지 않고 그냥 지나쳐(504번) 탄이 물량을 통과하는 것처럼 보였다.
      const through = bullet.wallShot && !enemy.cell && !enemy.boss
      const angle = Math.atan2(bullet.body.velocity.y, bullet.body.velocity.x)
      const [bx, by] = [bullet.x, bullet.y]
      this.impact(bx, by, bullet.power, bullet.grade)
      // 무기마다 다른 효과 (376번): 소총은 뚫고 지나가고, 리볼버는 치명타, 기관단총은 맞은 적을 느리게 한다.
      bullet.hitList.push(enemy)
      // 매도벽은 뚫고 지나가지 못한다 (457번): 소총도 벽 칸에서 멈춘다.
      if (!through && (--bullet.pierce <= 0 || enemy.cell)) {
        bullet.disableBody(true, true)
      }
      const kind = bullet.kind
      const shot = weaponDamage(
        kind,
        bullet.damage,
        Math.random(),
        (1 + this.loadout.critBonus) * bullet.critical - 1,
      )
      if (kind === 'smg') {
        this.slow(enemy, SLOW_FACTOR, SLOW_SECONDS)
      }
      this.hit(enemy, shot.damage, angle, shot.crit ? 'crit' : 'bullet')
      // 산탄총은 맞은 적을 밀어낸다 (#587). 보스·매도벽은 밀리지 않는다.
      const push = WEAPON_TRAITS[kind].knockback
      if (push > 0 && !enemy.boss && !enemy.cell && !enemy.dying) {
        enemy.kbx += Math.cos(angle) * push
        enemy.kby += Math.sin(angle) * push
      }
      if (bullet.splashRadius > 0) {
        this.splash(bx, by, bullet.splashRadius, bullet.splashDamage, enemy)
      }
    })
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Enemy
      if (!enemy.active || enemy.dying || enemy.cell || enemy.wallPushUntil > this.elapsed) return
      const base = enemy.boss && !this.assault ? BOSS.dmg : UNITS[enemy.kind].dmg
      const damage = Math.round(base * this.staged(this.dmgScale))
      if (this.buyWall?.active && !enemy.boss) this.hitBuyWall(this.sellAttack(enemy), enemy.x)
      else this.hurt(damage, enemy)
      // 공격 판: 매도 물량은 사장냥에 닿으면 멘탈을 깎고 사라진다(되튀어 계속 닿지 않게). 보스는 남는다.
      if (this.assault && !enemy.boss && enemy.wallPushUntil <= this.elapsed)
        this.kill(enemy, false)
    })
    if (this.wallZone) {
      // 디펜스: 적이 멘탈벽에 닿으면 멘탈이 깎이고 적은 터진다.
      this.physics.add.overlap(this.wallZone, this.enemies, (_z, e) => {
        const enemy = e as Enemy
        if (enemy.active && !enemy.dying) {
          this.hurt(
            Math.round(UNITS[enemy.kind].dmg * this.staged(this.dmgScale)),
            undefined,
            enemy.x,
          )
          this.kill(enemy, false)
        }
      })
    }

    const boom = {} as Record<UnitKind, Phaser.GameObjects.Particles.ParticleEmitter>
    for (const [kind, v] of Object.entries(this.assault ? UNITS : ENEMIES)) {
      boom[kind as UnitKind] = this.add
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
        lifespan: 150,
        scale: { start: 2 * TEX, end: 0.4 * TEX },
        alpha: { start: 0.85, end: 0 },
        tint: gradeTint(this.opts.hero.weapon.grade),
        emitting: false,
        // 고양이 넷이 쏘면 탄이 넷 배라 꼬리 수를 묶는다 (393번).
        maxAliveParticles: 160,
      })
      .setDepth(5.5)
    // S 등급부터 탄이 흘리는 반짝이 (512번): 작은 별이 흩어지며 사라진다.
    this.twinkle = this.add
      .particles(0, 0, 'twinkle', {
        lifespan: { min: 220, max: 420 },
        speed: { min: 8, max: 46 },
        scale: { start: 1.1 * TEX, end: 0 },
        rotate: { min: 0, max: 180 },
        alpha: { start: 1, end: 0 },
        emitting: false,
        maxAliveParticles: 70,
      })
      .setDepth(5.6)
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
      this.impacts.push(
        this.add.image(0, 0, `impact-${this.opts.hero.weapon.grade}`).setDepth(7).setVisible(false),
      )
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
    if (this.assault) {
      this.createAssaultPools()
      this.buyWall = new BuyWall(
        this.buyWallMental(),
        Math.random,
        this.opts.idle ? BUY_WALL.idleRebuildSeconds : undefined,
      )
      this.buyWallFx = new BuyWallFx(this, unitK('order'))
      this.drawBuyWall()
      // 자동 전투는 쌓인 벽 앞에서 시작하고, 기존 스테이지는 첫 카드 선택 뒤 벽까지 전진한다.
      if (this.opts.idle) {
        this.idleWall = this.opts.idle().wall
        this.idleQueue = new IdleWallQueueFx(this)
      }
      this.addWall(
        0,
        this.opts.idle ? this.stopY() : Math.min(this.holdY(), this.stopY() - h * 0.5),
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

  /** 멘탈벽의 세로 자리: 화면 아래쪽. */
  private wallY() {
    return this.view().h - wallOffset(this.view().h)
  }

  /** 플레이어의 세로 자리(붙박이, 332·340번): 디펜스는 멘탈벽 뒤(아래)에 숨어 벽 너머로 쏜다. 전진 모드는 처음 자리(아래쪽)다. */
  private playerY() {
    return this.mode === 'defense' && this.genre.target === 'wall'
      ? this.wallY() + 78
      : this.view().h - (this.assault ? 175 : 140)
  }

  /**
   * 한 줄로 늘어선 자리의 x (393번, mates.ts): 0은 사장냥, 1부터 함께 싸우는 고양이. 디펜스는 멘탈벽 뒤 가운데에 줄 전체를 두고, 전진 모드는 사장냥을
   * 따라다닌다(화면 밖으로 나가지 않게).
   */
  private standX(i: number) {
    const { w } = this.view()
    const line = mateFormation(this.mates.length + 1, w)
    const off = line[i] ?? 0
    if (this.assault) {
      // 공격 판 (413번): 사장냥도 붙박이라, 사장냥을 화면 가운데에 두고 줄을 붙이면 넷일 때 줄이 반 칸 오른쪽으로 밀리고 끝 고양이가 가장자리에
      // 막혀 간격이 좁아졌다. 줄 전체를 레인 가운데에 둔다.
      const { left, width } = this.lane()
      return left + width / 2 + off
    }
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
      m.magicMark.destroy()
    }
    while (this.mates.length < want) this.addMate()
    this.damageStats.mates = this.mates.length
    // 자동 전투에서는 출전한 고양이가 모두 제 스킬을 쓴다 (501번).
    const own = this.loadout.mateMagic
    const awake = own ? this.mates.length : awakenedMateCount(this.loadout)
    this.casters.length = Math.min(this.casters.length, 1 + awake)
    while (this.casters.length < 1 + awake) {
      const index = this.casters.length - 1
      const mate = this.mates[index]
      const clock = new MagicClock()
      for (const magic of MAGICS) clock.ready(magic, this.elapsed + (index + 1) * CAST_STAGGER)
      this.casters.push({ mate: index, at: () => ({ x: mate.body.x, y: mate.body.y - 24 }), clock })
      if (own) continue
      this.ring(mate.body.x, mate.body.y, 0xc7a4ff, 64, 500)
      this.glow(mate.body.x, mate.body.y - 24, 0xc7a4ff, 80, 500, 0.8)
      this.pop(
        mate.body.x,
        mate.body.y - 60,
        `${MATE_LOOKS[this.mateLook(index)].name} 마법 각성!`,
        '#e3caff',
        20,
      )
    }
    this.mates.forEach((mate, index) => {
      mate.magicMark.setVisible(index < awake)
    })
    this.damageStats.awakenedMates = awake
  }

  /** 고양이 한 마리가 제자리 위에서 떨어져 내려와 합류한다: 쿵, 고리, 이름. */
  private addMate() {
    const i = this.mates.length
    const y = this.mode === 'defense' ? this.playerY() : this.player.y
    const body = this.add
      .image(this.player.x, y, mateKey(this.mateLook(i)))
      .setDisplaySize(HERO_SIZE.w, HERO_SIZE.h)
      .setDepth(5)
    const mate: Mate = {
      magicMark: this.add
        .text(body.x, body.y - 58, '✦', {
          fontSize: '24px',
          color: '#e3caff',
          stroke: '#533b89',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(7)
        .setVisible(false),
      body,
      aim: this.aim,
      // 사장냥과 번갈아 쏘게 연사 간격 안에서 조금씩 어긋나게 시작한다.
      lastFire: this.lastFire + (this.attackInterval * (i + 1)) / (MATE_LOOKS.length + 1),
      shots: 0,
      drop: this.reducedMotion ? 0 : -150,
      kick: 0,
    }
    this.mates.push(mate)
    // 늘어선 자리가 바뀌었다: 새 고양이는 제자리에서 내려오고 나머지는 옆으로 비켜선다(update가 미끄러지게 옮긴다).
    body.setPosition(this.standX(i + 1), y + mate.drop)
    const land = () => {
      const fx = body.x
      const fy = body.y + 30
      this.ring(fx, fy, 0xffffff, 56, 320)
      this.glow(fx, fy - 20, 0xffe7a8, 60, 360, 0.7)
      this.hitSpark.explode(this.fx(14), fx, fy)
      this.pop(fx, body.y - 56, `${MATE_LOOKS[this.mateLook(i)].name} 합류!`, '#ffe08a', 22)
      sfx.mateJoin()
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
    e.baseK = ENEMY_K * BOSS.scale
    this.bossEnemy = e
    this.lastSummon = this.elapsed
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

  // ── 공격 판: 매도벽을 부수고 올라간다 (413번, #573)

  /** 이어지는 배경과 호가 줄·가격 눈금·속도선을 만든다. 고양이는 제자리에 고정한다. */
  private createAssault(w: number, h: number) {
    this.bg2 = this.add.image(0, -h, 'art-street').setOrigin(0).setDisplaySize(w, h)
    // 장난감 보드의 크림색을 유지하면서 전장에 아주 옅은 따뜻한 톤만 더한다.
    this.add.rectangle(0, 0, 4000, 4000, 0xe8b877, 0.04).setOrigin(0).setDepth(0.5)
    this.book = this.add.graphics().setDepth(1)
    this.bossBar = this.add.graphics().setDepth(8.6)
    this.ladder = this.add.graphics().setDepth(8)
    if (!this.reducedMotion) {
      for (let i = 0; i < 9; i++) {
        this.speedLines.push(
          this.add
            .image(Phaser.Math.Between(20, w - 20), Phaser.Math.Between(-90, h), 'speedline')
            .setDisplaySize(3, Phaser.Math.Between(60, 120))
            .setAlpha(0)
            .setDepth(1.5),
        )
      }
    }
  }

  /** 체결 숫자(물량이 깎이다 "체결!")와 벽 파편. */
  private createAssaultPools() {
    for (let i = 0; i < 14; i++) {
      this.fills.push(
        this.add
          .text(0, 0, '', {
            fontFamily: '"Jua", "Gowun Dodum", sans-serif',
            fontSize: '17px',
            color: '#dff0ff',
            stroke: '#0d2466',
            strokeThickness: 4,
            resolution: DPR,
          })
          .setOrigin(0.5)
          .setDepth(8.5)
          .setVisible(false),
      )
    }
    this.chips = this.add
      .particles(0, 0, 'chip', {
        speed: { min: 60, max: 220 },
        angle: { min: 200, max: 340 },
        lifespan: { min: 380, max: 700 },
        gravityY: 520,
        rotate: { min: 0, max: 360 },
        scale: { start: 1.4 * TEX, end: 0.6 * TEX },
        alpha: { start: 1, end: 0.2 },
        emitting: false,
        maxAliveParticles: 220,
      })
      .setDepth(7)
  }

  /** 벽이 멈춰 서는 줄(맨 아랫줄의 아래 끝): 화면 높이의 34%, 190~320px. 사장냥과 사이에 물량이 내려올 거리를 남긴다. */
  private stopY() {
    if (this.opts.idle) return idleWallLayout(this.lane().width, this.view().h).bottom
    // 벽은 사장냥에게서 멀찍이(위로) 선다: 벽에서 나온 물량이 내려올 거리가 넉넉하다.
    return Phaser.Math.Clamp(this.view().h * 0.24, 150, 240)
  }

  /** 잡몹 구간 동안 다음 벽의 아래 끝. 뒤판의 여백까지 화면 밖에 숨긴다. */
  private holdY() {
    return -16
  }

  private lane() {
    const { w } = this.view()
    return { left: LANE_LEFT, right: w - LANE_RIGHT, width: w - LANE_LEFT - LANE_RIGHT }
  }

  /** 화면 크기가 바뀌어도 고양이는 아래 중앙에 고정한다. 공격 판은 함께 싸우는 고양이까지 한 줄로 가운데에 선다. */
  private moveHero() {
    this.player.setPosition(this.assault ? this.standX(0) : this.view().w / 2, this.playerY())
  }

  /** 벽 하나를 세운다: 줄마다 칸을 꺼내 체력(약한 칸 하나)·물량 글자를 붙인다. 아직 화면 위에 있어도 된다. */
  private addWall(index: number, y: number) {
    const spec = this.assault
    if (!spec || index >= spec.walls.length) return
    const ws = spec.walls[index]
    const cols = wallCols(this.view().w)
    const band = this.add.image(0, 0, 'wall-band').setOrigin(0, 1).setDepth(2.4)
    const price = this.add
      .text(0, 0, '', {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#1d4aa8',
        padding: { x: 3, y: 2 },
        resolution: DPR,
      })
      .setOrigin(1, 0.5)
      .setDepth(8.2)
    const target = assaultPrice(spec, index + 1)
    price.setText(`${target.toLocaleString()}`)
    const wall: WallState = {
      spec: ws,
      index,
      y,
      cols: 1,
      cells: [],
      left: 0,
      band,
      price,
      arrived: false,
      broken: false,
      base: 0,
    }
    // 매도벽은 칸으로 나누지 않은 덩어리다 (416번). 줄이 여럿이면 길게 늘이지 않고 같은 크기의 벽을 한 층씩 위로 쌓는다. 층마다 그 줄의 체력을 갖고,
    // 맨 아래 층부터 맞아 부서져도 위층은 제자리에 남는다.
    for (let row = 0; row < Math.max(1, ws.rows); row++) {
      const hp = rowHps(ws.cellHp * (1 + row * 0.15), cols).reduce((a, b) => a + b, 0)
      // 칸이 여럿이던 때는 퍼지는 마법·불길이 칸 여러 개를 한꺼번에 맞혔다. 덩어리라 그만큼 덜 단단하게 둔다.
      const e = this.spawnCell(wall, row, 0, hp * CHUNK_HP, false)
      if (e) {
        wall.cells.push(e)
        wall.left++
      }
    }
    this.layoutWall(wall)
    this.placeWall(wall)
    this.walls.push(wall)
  }

  private spawnCell(wall: WallState, row: number, col: number, hp: number, weak: boolean) {
    const e = this.enemies.get(0, 0, cellKey(0)) as Enemy | null
    if (!e) return null
    e.setTexture(cellKey(0))
      .enableBody(true, 0, 0, true, true)
      .setAlpha(1)
      .setAngle(0)
      .setDepth(2.5)
    e.kind = 'cell'
    e.blocker = false
    e.boss = false
    e.dying = false
    e.wallPushUntil = 0
    e.slowUntil = 0
    e.slowFactor = 1
    e.stunUntil = 0
    e.chilled = false
    e.tintKind = 0
    e.kbx = 0
    e.kby = 0
    e.look = 0
    e.walkOffset = 0
    e.born = this.elapsed
    e.hp = hp
    e.maxHp = hp
    ;(e.body as Phaser.Physics.Arcade.Body).setImmovable(true)
    const label = this.add
      .text(0, 0, '', { ...WALL_LABEL_STYLE })
      .setOrigin(0.5)
      .setDepth(2.6)
    const shares = cellShares(hp, hp)
    label.setText(this.cellLabel(shares))
    e.cell = { wall, row, col, label, shares, crack: 0, weak }
    this.paint(e)
    return e
  }

  /** 매도벽 한 층의 높이: 정사각형 블록 한 줄. 층이 여럿이어도 늘이지 않고 이 높이로 쌓는다. */
  private layerHeight() {
    if (this.opts.idle) return idleWallLayout(this.lane().width, this.view().h).height
    return (this.lane().width - CELL_GAP) / 6 + CELL_GAP
  }

  /** 남은 층(아래부터). */
  private wallLayers(wall: WallState) {
    return wall.cells
      .filter((e) => e.active && !e.dying && e.cell)
      .sort((a, b) => (a.cell?.row ?? 0) - (b.cell?.row ?? 0))
  }

  /** 층이 서는 자리(아래부터 0): 아래층이 부서져도 바뀌지 않는다. */
  private layerSlot(wall: WallState, e: Enemy) {
    return Math.max(0, (e.cell?.row ?? wall.base) - wall.base)
  }

  /** 지금 벽 전체 높이: wall.y에서 남은 맨 위층의 위 끝까지. */
  private wallHeight(wall: WallState) {
    const top = this.wallLayers(wall).reduce((m, e) => Math.max(m, this.layerSlot(wall, e)), 0)
    return (top + 1) * this.layerHeight()
  }

  /** 지금 맞는 층(남은 맨 아래 층)의 아래 끝 y. 물량은 여기서 나온다. */
  private frontY(wall: WallState) {
    const front = this.frontLayer(wall)
    return front ? wall.y - this.layerSlot(wall, front) * this.layerHeight() : wall.y
  }

  /** 칸 크기를 화면 폭에 맞춘다(만들 때와 화면 크기가 바뀔 때, 층이 부서졌을 때). */
  private layoutWall(wall: WallState) {
    const lane = this.lane()
    const cellW = lane.width / wall.cols
    for (const e of this.wallLayers(wall)) {
      e.setDisplaySize(cellW - CELL_GAP, this.layerHeight() - CELL_GAP)
      ;(e.body as Phaser.Physics.Arcade.Body).setSize(e.width, e.height, true)
    }
    wall.band.setDisplaySize(lane.width + 8, this.wallHeight(wall) + 8)
  }

  /** 벽과 층·글자를 지금 y에 놓는다(오를 때 매 프레임). 층마다 제자리(layerSlot)에 선다: 아래층이 부서진 자리는 비워 둔다. */
  private placeWall(wall: WallState) {
    const lane = this.lane()
    const cellW = lane.width / wall.cols
    const layer = this.layerHeight()
    for (const e of this.wallLayers(wall)) {
      const c = e.cell
      if (!c) continue
      const x = lane.left + (c.col + 0.5) * cellW
      const y = wall.y - (this.layerSlot(wall, e) + 0.5) * layer
      e.setPosition(x, y)
      c.label.setPosition(x, y + 1)
    }
    wall.band.setPosition(lane.left - 4, wall.y + 4)
    // 벽 옆의 가격 표는 뺐다(416번): 가격은 위 HUD에만 보인다.
    wall.price.setVisible(false)
    if (this.opts.idle && !wall.broken) {
      this.idleQueue?.draw(
        this.idleWall,
        wall.y,
        lane.left,
        lane.width,
        layer,
        this.opts.idle?.().upcoming,
      )
    }
  }

  /** 벽 칸에 적는 물량. 자동 전투는 "매도" 없이 몇 주인지만 적는다 (507번). */
  private cellLabel(shares: number) {
    const text = `${shares.toLocaleString()}주`
    return this.opts.idle ? text : `매도 ${text}`
  }

  /** 서킷브레이커 (#593): 벽의 남은 체력은 그대로 두고 rows층으로 다시 쌓는다(층마다 같은 몫). */
  private restackWall(wall: WallState, rows: number) {
    const layers = this.wallLayers(wall)
    const total = layers.reduce((sum, e) => sum + e.hp, 0)
    // 층 순서(row)가 겹치지 않게 남은 층의 맨 위 다음 번호부터 쌓는다: 같은 번호면 둘 다 맨 아래 층으로 보여 범위 공격을 함께 맞는다.
    let row = layers.reduce((top, e) => Math.max(top, e.cell?.row ?? 0), -1) + 1
    // 다시 쌓은 벽은 남은 맨 아래 층부터 wall.y에 붙여 세운다.
    wall.base = layers.length > 0 ? Math.min(...layers.map((e) => e.cell?.row ?? 0)) : row
    for (let n = layers.length; n < rows; n++) {
      const e = this.spawnCell(wall, row++, 0, 1, false)
      if (e) wall.cells.push(e)
    }
    wall.left = wall.cells.length
    const all = this.wallLayers(wall)
    for (const e of all) {
      e.hp = total / all.length
      e.maxHp = e.hp
      if (e.cell) {
        e.cell.crack = 0
        e.cell.shares = cellShares(e.hp, e.hp)
        e.cell.label.setText(this.cellLabel(e.cell.shares))
      }
      e.setTexture(cellKey(0))
    }
  }

  /** 칸이 맞았다: 금이 가고(4단계 그림) 조각이 튀고, 남은 물량이 깎여 보인다. */
  private crackCell(e: Enemy) {
    const c = e.cell
    if (!c) return
    const crack = Math.min(CELL_CRACKS - 1, Math.floor((1 - e.hp / e.maxHp) * CELL_CRACKS))
    if (crack > c.crack) {
      c.crack = crack
      e.setTexture(cellKey(crack))
      this.chips?.explode(this.fx(4 + crack * 2), e.x, e.y + 6)
      this.playSound('thud')
    } else if (Math.random() < 0.35) {
      this.chips?.explode(1, e.x, e.y + 8)
    }
    const shares = cellShares(e.maxHp, e.hp)
    if (shares !== c.shares && e.hp > 0) {
      c.shares = shares
      c.label.setText(this.cellLabel(shares))
    }
  }

  /** 칸 하나가 부서졌다: 처음 물량이 깎이며 "체결!", 조각이 쏟아진다. 벽의 마지막 칸이면 벽이 무너진다. */
  private cellBroken(e: Enemy) {
    const c = e.cell
    if (!c) return
    e.cell = null
    c.label.destroy()
    this.chips?.explode(this.fx(14), e.x, e.y)
    this.fill(e.x, e.y, cellShares(e.maxHp, e.maxHp), '#bfe0ff')
    // 적 풀은 돌려 쓰니 부서진 칸은 벽에서 바로 뺀다(같은 객체가 물량으로 다시 나올 수 있다).
    c.wall.cells = c.wall.cells.filter((o) => o !== e)
    c.wall.left = c.wall.cells.length
    // 위층은 내려앉지 않고 제자리에 남는다. 뒤 판 높이만 남은 맨 위층에 맞춘다.
    if (c.wall.left > 0) {
      this.layoutWall(c.wall)
      this.placeWall(c.wall)
    }
    this.playSound('thud')
    if (c.wall.left <= 0 && !c.wall.broken) this.wallCollapse(c.wall)
  }

  /** 벽이 무너진다: 판이 내려앉으며 파편과 먼지, 가격이 한 칸 뛰고, 사장냥이 쭉 치고 오른다. 다음 벽이 위에서 내려온다. */
  private wallCollapse(wall: WallState) {
    const spec = this.assault
    if (!spec) return
    wall.broken = true
    this.wallsBroken++
    // 벽 하나를 통째로 무너뜨리면 경험치를 한 번에 더 준다 (#700).
    const breakXp = wallBreakXp(xpToNext(this.level))
    this.pop(this.view().w / 2, wall.y - 40, `EXP +${breakXp}`, '#7be0c3', 22)
    this.gainXp(breakXp)
    this.sinceBreak = 0
    this.stuck = 0
    // 치고 오르는 동안 화면이 쭉 내려가 남아 있던 물량이 사장냥에게 쏟아져 맞았다: 남은 물량은 벽과 함께 체결되고, 치고 오르는 동안은 맞지 않는다.
    this.sweepFlows(wall.y)
    this.invulnUntil = Math.max(
      this.invulnUntil,
      this.elapsed + ASSAULT_MOTION.breakSeconds + ASSAULT_MOTION.dashSeconds + 0.5,
    )
    const lane = this.lane()
    for (let i = 0; i < 7; i++) {
      const x = lane.left + ((i + 0.5) * lane.width) / 7
      this.chips?.explode(this.fx(8), x, wall.y - 8)
      this.boom.cell.explode(this.fx(4), x, wall.y - 10)
    }
    this.glow(this.view().w / 2, wall.y - 20, 0xbfe0ff, lane.width * 0.45, 380, 0.5)
    this.tweens.add({
      targets: wall.band,
      alpha: 0,
      scaleY: wall.band.scaleY * 0.3,
      duration: 360,
      ease: 'Quad.easeIn',
      onComplete: () => wall.band.destroy(),
    })
    wall.price.setBackgroundColor('#e8434f').setText(`▲ ${wall.price.text}`)
    sfx.crumble()
    sfx.crash()
    haptic.medium()
    if (this.opts.idle) {
      this.idleTransition = true
      this.time.delayedCall(this.reducedMotion ? 450 : 160, () => {
        for (const old of this.walls) {
          old.price.destroy()
          if (old.band.active) old.band.destroy()
        }
        this.walls = []
        this.wallsBroken = 0
        const snapshot = this.opts.idle?.()
        this.idleWall = snapshot?.wall ?? this.idleWall
        // 벽이 깊어질수록 미션처럼 물량이 잦고 무거워진다 (493번).
        Object.assign(spec, idleAssaultSpec(this.idleWall, snapshot?.maxHp))
        this.countScale = spec.enemyCount
        this.speedScale = spec.enemySpeed
        this.dmgScale = spec.enemyDmg
        if (spec.enemyHp !== this.hpScale) {
          // 열 벽마다 물량의 수량이 는다 (498번): 주문서에 적힌 주식 수도 새로 칠한다.
          this.hpScale = spec.enemyHp
          bakeOrders(this, this.hpScale, true)
          this.buyWall?.resize(this.buyWallMental())
        }
        // The next wall takes the exact position of the first queued wall.
        const spacing = idleWallLayout(this.lane().width, this.view().h).spacing
        this.addWall(0, Math.min(wall.y, this.stopY()) - spacing)
        this.idleTransition = false
        this.runRush = 0.95
      })
      return
    }
    const total = spec.walls.length
    this.pushHud(true)
    this.opts.onWallGain?.(spec.tick, spec.startPrice)
    if (this.wallsBroken >= total) {
      if (this.bossEnemy?.active && !this.bossEnemy.dying) {
        this.opts.onBanner(`대량 매도벽 돌파! ${ASSAULT_BOSS.name}을 잡아라`, '#ff4f6d')
      }
      this.assaultCheckClear()
    } else {
      // 주가 상승 연출(onWallGain)만 표시해 같은 돌파 알림이 전장을 겹쳐 가리지 않게 한다.
      this.nextWallIn = ASSAULT_MOTION.breakSeconds
    }
    this.pushHud(true)
  }

  /** 보스 벽이 화면에 들어오면 큰손도 등장한다. 이동 중 벽을 깨도 보스를 건너뛸 수 없다. */
  private startWhale(wall: WallState) {
    const spec = this.assault
    if (!spec || (this.bossEnemy?.active && !this.bossEnemy.dying)) return
    const mid = Boolean(wall.spec.mid)
    const e = this.spawn('whale', [this.view().w / 2, wall.y - 40], true)
    if (!e) return
    wall.bossStarted = true
    this.tweens.killTweensOf(e)
    e.boss = true
    this.bossMid = mid
    this.bossMax = mid ? spec.midBossHp : spec.bossHp
    e.hp = this.bossMax
    e.maxHp = this.bossMax
    e.setScale(unitK('whale') * (mid ? 0.8 : 1))
    e.baseK = e.scaleX
    e.setDepth(3.5)
    this.bossEnemy = e
    this.lastSummon = this.elapsed
    sfx.levelUp()
    this.opts.onBanner(
      mid ? `${MID_BOSS_NAME} 등장! 중간 매도벽` : `${ASSAULT_BOSS.name} 등장!! 대량 매도벽`,
      '#ff4f6d',
    )
    this.pushHud(true)
  }

  /**
   * 큰손이 시장가 매도를 쏟아 낸다: 양옆으로 퍼지지 않고 큰손 바로 앞(발밑)에서 한 줄로 이어 나와 곧게 내려온다. 화가 나면(체력 반 아래) 대량 매도도 하나.
   */
  private whaleSummon(boss: Enemy) {
    const { w } = this.view()
    const count = Math.round(ASSAULT_BOSS.summonCount * this.countScale)
    const x = Phaser.Math.Clamp(boss.x, LANE_LEFT + 10, w - LANE_RIGHT - 10)
    for (let i = 0; i < count; i++) {
      // 같은 자리에 겹치지 않게 앞뒤로 줄지어 세우고, 좌우로는 아주 조금만 어긋나게 한다.
      this.spawn('market', [x + (i % 2 ? 6 : -6), boss.y + 34 + i * 24])
    }
    if (boss.hp <= this.bossMax / 2) this.spawn('bulk', [boss.x, boss.y + 40])
    this.pop(boss.x, boss.y + 62, '전량 매도!!', '#ffffff', 22)
  }

  /** 큰손을 잡았다: 남은 대량 매도벽 칸이 한꺼번에 금이 간다("큰손이 손을 뗐다"). 벽까지 다 부수면 깬다. */
  private whaleDown() {
    haptic.heavy()
    this.hitstop(140)
    const mid = this.bossMid
    this.bossMid = false
    // 방치형의 큰손은 별도 적이다. 처치 보너스를 벽 명중으로 보고하면
    // 벽에 닿은 공격 없이도 서버가 벽을 돌파시킨다.
    if (this.opts.idle) {
      this.opts.onBanner('큰손 격파!', '#ffd84d')
      return
    }
    const last = this.walls.find((wl) => (mid ? wl.spec.mid : wl.spec.boss) && !wl.broken)
    if (last) {
      this.opts.onBanner(
        mid ? '중간 큰손 격파! 매도벽이 흔들린다' : '큰손 격파!! 대량 매도벽이 흔들린다',
        '#ffd84d',
      )
      // 벽은 한 묶음이라 남은 층 체력의 합에 비례한 한 방을 맨 아래 층에 넣고, 넘친 몫은 위층으로 이어진다.
      const front = this.frontLayer(last)
      const total = last.cells.reduce(
        (sum, e) => (e.active && !e.dying && e.cell ? sum + e.maxHp : sum),
        0,
      )
      if (front) this.hit(front, total * ASSAULT_BOSS.wallBreak, -Math.PI / 2, 'lightning')
    }
    // 중간 큰손을 잡아도 판은 계속된다. 다음 벽은 붕괴 즉시 이미 등장했다.
    if (mid) return
    this.assaultCheckClear()
  }

  /** 짧은 붕괴 연출 뒤 다음 벽을 보이게 세우고, 돌파 속도로 전장을 올린다. */
  private startRush() {
    if (!this.assault || this.over) return
    this.rushLeft = 0
    this.sinceBreak = 0
    this.lastFlow = this.elapsed
    // 첫 프레임부터 벽 아래쪽이 보인다. 도착 위치와 거리를 둬 배경·호가 줄도 함께 흐른다.
    this.addWall(this.wallsBroken, Math.max(32, this.stopY() - 160))
    this.opts.onBanner('매도벽을 부수고 다음 벽으로!', '#3a7bea')
  }

  /** 잡몹 구간(#593) 동안 화면 밖에서 대기하는 다음 벽: 아직 깨지지 않는다. */
  private held(e: Enemy) {
    return Boolean(e.cell && this.rushLeft > 0 && !e.cell.wall.arrived)
  }

  /**
   * 매도벽 너머 (457번): 공격 판에서 화면에 들어온 가장 아래의 성한 매도벽보다 위(벽 너머)에 있는 적은 총알·마법이 닿지 않는다. 벽이 막는다. 벽 칸과
   * 큰손(벽과 함께 싸운다)은 빼고, 자동 조준도 이런 적은 노리지 않는다.
   */
  private beyondWall(e: Enemy) {
    if (!this.assault || e.boss) return false
    // 매도벽은 한 묶음이다: 맨 아래 층만 맞고, 그 뒤(위)의 층은 범위 공격에도 맞지 않는다. 넘친 피해는 hit()이 다음 층으로 넘긴다.
    if (e.cell) return this.behindLayer(e)
    let top = Number.NEGATIVE_INFINITY
    for (const wall of this.walls) {
      if (wall.broken || wall.y <= 0 || this.wallLayers(wall).length === 0) continue
      top = Math.max(top, wall.y - this.wallHeight(wall))
    }
    return e.y < top
  }

  /** 매도벽의 맨 아래(맞는) 층이 아닌 층인가. 맨 아래 층 = 남은 층 가운데 row가 가장 작은 것. */
  private behindLayer(e: Enemy) {
    const c = e.cell
    if (!c) return false
    for (const o of c.wall.cells) {
      if (o !== e && o.active && !o.dying && o.cell && o.cell.row < c.row) return true
    }
    return false
  }

  /** 매도벽의 지금 맞는 층(맨 아래 층). */
  private frontLayer(wall: WallState): Enemy | null {
    let front: Enemy | null = null
    for (const o of wall.cells) {
      if (!o.active || o.dying || !o.cell) continue
      if (!front || o.cell.row < (front.cell?.row ?? 0)) front = o
    }
    return front
  }

  /** Reconcile the existing renderer with saved progress, without client rewards or stage resets. */
  private syncIdleWall() {
    if (!this.opts.idle || this.idleTransition) return
    const snapshot = this.opts.idle()
    if (!this.idleWall) this.idleWall = snapshot.wall
    const wall = this.walls.find((w) => !w.broken)
    if (!wall) return
    if (snapshot.wall !== this.idleWall) {
      this.idleHits = []
      if (this.circuit) this.endCircuit()
      if (this.bossEnemy?.active) this.kill(this.bossEnemy, false)
      for (const cell of [...wall.cells]) if (cell.active && !cell.dying) this.kill(cell, false)
      return
    }
    // 서버는 1초마다 답한다: 그사이 맞힌 피해를 먼저 빼서 맞는 즉시 줄어 보이게 한다. 뺀 것은 그 명중을 실은 접속 신호를 서버가 처리했을 때
    // (snapshot.sequence) 잊는다: 시간으로 잊으면 서버 값에 이미 든 피해를 또 빼거나 아직 안 든 피해를 돌려놓아 체력이 오르내렸다 (496번).
    // 벽이 깨지는 판정은 서버 것이라 여기서는 0까지 내리지 않는다.
    const since = performance.now() - IDLE_HIT_MS
    const handled = snapshot.sequence ?? -1
    this.idleHits = this.idleHits.filter(
      (hit) => hit.at >= since && (hit.sequence === undefined || hit.sequence > handled),
    )
    const pending = this.idleHits.reduce((sum, hit) => sum + hit.amount, 0)
    const cells = this.wallLayers(wall)
    for (const cell of cells) {
      cell.maxHp = snapshot.maxHp / Math.max(1, cells.length)
      const hp = Math.max(0.01, (snapshot.hp - pending) / Math.max(1, cells.length))
      if (cell.hp !== hp) {
        cell.hp = hp
        this.crackCell(cell)
      }
    }
  }

  /** 개발 화면 검사: 보이는 매도벽이 공격 불가 상태인지 확인한다. */
  inspectWalls() {
    return this.walls
      .filter((wall) => !wall.broken)
      .map((wall) => ({
        index: wall.index,
        upcoming: this.idleQueue?.inspect() ?? [],
        bottom: wall.y + 4,
        arrived: wall.arrived,
        held: wall.cells.some((e) => this.held(e)),
        hp: wall.cells.reduce((sum, e) => sum + e.hp, 0),
        /** 남은 층(아래부터)의 체력과 최대 체력: 한 묶음이라 맨 아래 층만 깎여야 한다. */
        layers: this.wallLayers(wall).map((e) => ({ hp: e.hp, maxHp: e.maxHp })),
      }))
  }

  /** 화면에 남은 매도 물량(벽 칸·큰손 빼고)이 위(fromY)에서부터 차례로 체결된다. */
  private sweepFlows(fromY: number) {
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (!e.active || e.dying || e.cell || e.boss) continue
      // 자동 전투 (504번): 벽이 부서질 때 체결되는 것은 매도 물량뿐이다. 습격으로 온 몬스터는 남아 계속 내려온다.
      if (this.opts.idle && !isOrder(e.kind)) continue
      const delay = this.reducedMotion ? 0 : Math.min(420, Math.max(0, e.y - fromY) * 0.6)
      e.dying = true
      if (e.body) e.body.enable = false
      this.time.delayedCall(delay, () => {
        if (!e.active) return
        e.dying = false
        this.kill(e, true)
      })
    }
  }

  /** 마지막 벽까지 다 부수고 큰손도 없으면 깼다: 클리어 연출을 보이고 결과로 넘어간다. */
  private assaultCheckClear() {
    if (this.opts.idle) return
    const spec = this.assault
    if (!spec || this.over) return
    const bossAlive = Boolean(this.bossEnemy?.active && !this.bossEnemy.dying)
    if (this.wallsBroken >= spec.walls.length && !bossAlive) {
      this.opts.onBanner('모든 매도벽 돌파!', '#ffd84d')
      haptic.success()
      this.clearShow()
      this.finish(true, 'clear', this.reducedMotion ? 900 : CLEAR_SHOW_MS)
    }
  }

  /**
   * 공격 판 클리어 연출: 화면이 금빛으로 번쩍이고, 남은 물량이 모두 체결되며, "매도벽 돌파!"와 오른 비율이 크게 찍힌다. 위에서 색종이가 쏟아지고
   * 하늘 곳곳에서 불꽃이 터지며 사장냥이 펄쩍 뛴다.
   */
  private clearShow() {
    const spec = this.assault
    if (!spec) return
    const { w, h } = this.view()
    this.sweepFlows(0)
    sfx.fanfare()
    this.time.delayedCall(350, () => sfx.celebrate())
    const flash = this.add
      .rectangle(w / 2, h / 2, w, h, 0xfff2b0)
      .setDepth(20)
      .setAlpha(0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    })
    const style = {
      fontFamily: '"Jua", "Gowun Dodum", sans-serif',
      color: '#ffe066',
      stroke: '#7a2e00',
      strokeThickness: 8,
      align: 'center',
      resolution: DPR,
    }
    const title = this.add
      .text(w / 2, h * 0.36, '매도벽 돌파!', { ...style, fontSize: '46px' })
      .setOrigin(0.5)
      .setDepth(22)
      .setScale(0)
    const pct = ((this.assaultNow() - spec.startPrice) / spec.startPrice) * 100
    const sub = this.add
      .text(w / 2, h * 0.36 + 52, '', {
        ...style,
        fontSize: '30px',
        color: '#ff6b7a',
        stroke: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(22)
      .setAlpha(0)
    const count = { n: 0 }
    this.tweens.add({
      targets: title,
      scale: 1,
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () =>
        this.tweens.add({ targets: title, scale: 1.08, duration: 380, yoyo: true, repeat: -1 }),
    })
    this.tweens.add({
      targets: count,
      n: pct,
      delay: 300,
      duration: 900,
      ease: 'Cubic.easeOut',
      onStart: () => sub.setAlpha(1),
      onUpdate: () => sub.setText(`▲ +${count.n.toFixed(1)}%`),
    })
    // 색종이 비.
    const confetti = this.add
      .particles(0, -10, 'confetti', {
        x: { min: 0, max: w },
        speedY: { min: 160, max: 320 },
        speedX: { min: -60, max: 60 },
        rotate: { start: 0, end: 540 },
        scale: { min: 0.7 * TEX, max: 1.2 * TEX },
        lifespan: h / 0.16,
        quantity: this.reducedMotion ? 1 : 3,
        frequency: 40,
        tint: [0xffd84d, 0xff6b7a, 0x6cc8ff, 0x8be38f, 0xc49bff, 0xffffff],
      })
      .setDepth(21)
    this.time.delayedCall(1400, () => confetti.stop())
    // 불꽃놀이: 하늘 곳곳에서 차례로.
    const colors = [0xffd84d, 0xff6b7a, 0x6cc8ff, 0x8be38f, 0xffa64d]
    const bursts = this.reducedMotion ? 3 : 8
    for (let i = 0; i < bursts; i++) {
      this.time.delayedCall(120 + i * 190, () => {
        const x = w * (0.15 + Math.random() * 0.7)
        const y = h * (0.1 + Math.random() * 0.35)
        const c = colors[i % colors.length]
        const r = 70 + Math.random() * 40
        this.ring(x, y, c, r, 520)
        this.time.delayedCall(90, () => this.ring(x, y, 0xffffff, r * 0.6, 420))
        this.glow(x, y, c, 90, 480, 1)
        this.boltFx.explode(this.fx(24), x, y)
        this.fireFx.explode(this.fx(14), x, y)
        this.playSound('boom')
      })
    }
  }

  /** 체결 숫자: 물량이 0까지 깎인 뒤 "체결!"이 떠오르며 사라진다. */
  private fill(x: number, y: number, shares: number, color = '#dff0ff') {
    if (this.fills.length === 0) return
    const t = this.fills[this.fillIndex++ % this.fills.length]
    this.tweens.killTweensOf(t)
    const { w } = this.view()
    const px = Phaser.Math.Clamp(x, 30, w - 30)
    t.setText(`${shares.toLocaleString()}주`)
      .setColor(color)
      .setPosition(px, y - 6)
      .setAlpha(1)
      .setScale(0.9)
      .setVisible(true)
    const counter = { n: shares }
    this.tweens.add({
      targets: counter,
      n: 0,
      duration: this.reducedMotion ? 1 : 240,
      ease: 'Quad.easeOut',
      onUpdate: () => t.setText(`${(Math.round(counter.n / 10) * 10).toLocaleString()}주`),
      onComplete: () => {
        t.setText('체결!').setScale(1.25)
        this.tweens.add({
          targets: t,
          y: y - 40,
          scale: 1,
          alpha: 0,
          duration: 420,
          ease: 'Cubic.easeOut',
          onComplete: () => t.setVisible(false),
        })
      },
    })
    this.playSound('coin')
  }

  /** 매도 물량은 벽에서 나온다: 벽 아래 끝에서 튀어나오며 벽 면에 먼지와 파편이 인다. 벽 앞에 오래 막힐수록 잦다. */
  private spawnFlow(wall: WallState) {
    const y = this.frontY(wall)
    const out = this.spawnFlowAt(wall.spec.mix, y + 6)
    for (const e of out) {
      this.chips?.explode(this.fx(2), e.x, y - 4)
      this.boom.cell.explode(this.fx(2), e.x, y - 2)
    }
  }

  /** 매도 물량 한 번: 길 아무 데서나 y에서 나온다. 시장가는 떼로. 나온 물량을 돌려준다. */
  private spawnFlowAt(mix: AssaultWall['mix'], y: number): Enemy[] {
    const out: Enemy[] = []
    const spec = this.assault
    if (!spec) return out
    const lane = this.lane()
    const kind = pickFlow(mix, Math.random())
    // 벽 틈(부서진 칸) 자리에서 나오면 좋고, 아니면 길 아무 데나. 벽 바로 앞에서 나온다.
    // 벽이 한 덩어리라(416번) 벽 앞 아무 데서나 나온다.
    const x = lane.left + 16 + Math.random() * (lane.width - 32)
    if (kind === 'market' || kind === 'panic') {
      const n =
        kind === 'panic'
          ? Math.min(4, swarmSize(spec, Math.random()))
          : swarmSize(spec, Math.random())
      for (let i = 0; i < n; i++) {
        const e = this.spawn(kind, [
          Phaser.Math.Clamp(x + (i - (n - 1) / 2) * 22, lane.left + 8, lane.right - 8),
          y + (i % 2) * 18,
        ])
        if (e) out.push(e)
      }
    } else {
      const e = this.spawn(kind, [x, y])
      if (e) out.push(e)
    }
    return out
  }

  /**
   * 공격 판의 한 프레임: 지금 벽이 멈춤 줄에 닿기 전이면 오르고(벽을 막 뚫었으면 쭉 치고 오르다 천천히), 닿으면 멈춰 쏜다. 오르는 만큼 배경·호가 줄·
   * 가격 눈금·벽·물량이 함께 내려간다. 벽 앞(또는 다가오는 벽)에서 물량이 나온다.
   */
  private assaultStep(dt: number) {
    const spec = this.assault
    if (!spec) return
    const { h } = this.view()
    if (this.nextWallIn > 0) {
      this.nextWallIn = Math.max(0, this.nextWallIn - dt)
      if (this.nextWallIn === 0) this.startRush()
    }
    this.sinceBreak += dt
    const wall = this.walls.find((wl) => !wl.broken)
    let move = 0
    const rushing = this.rushLeft > 0
    if (wall && !wall.arrived) {
      move = this.opts.idle
        ? (idleWallLayout(this.lane().width, this.view().h).spacing * dt) / 0.45
        : climbSpeed(this.sinceBreak, this.reducedMotion) * dt
      const stop = rushing ? this.holdY() : this.stopY()
      if (rushing) this.rushLeft = Math.max(0, this.rushLeft - dt)
      if (wall.y + move >= stop) {
        move = Math.max(0, stop - wall.y)
      }
      if (!rushing && wall.y + move >= stop) {
        wall.arrived = true
        this.stuck = 0
        if (wall.index === 0) {
          this.opts.onBanner('매도벽을 부수고 다음 벽으로!', '#3a7bea')
        }
        this.pushHud(true)
      }
    } else if (wall?.arrived) {
      // 벽 앞에 오래 막힐수록 물량이 잦아진다(spawnSeconds). 자동 전투는 끝이 없어 그대로 두면 막힌 벽에서 영영 못 벗어나므로 두 배까지만 잦아진다 (494번).
      this.stuck = this.opts.idle ? Math.min(IDLE_STUCK_MAX, this.stuck + dt) : this.stuck + dt
    }
    const support = this.buyWall?.step(dt)
    if ((this.buyWall && !this.buyWall.active) || support?.retreat) {
      move = -(support?.retreat ?? 0)
      if (wall) wall.arrived = false
    }
    if (support?.rebuilt) {
      // 새 매수벽이 서도 몬스터는 밀지 않는다 (458번). 무너질 때 미는 것(0.35초)은 그대로다.
      this.opts.onBanner('새 매수벽 등장!', '#7be0c3')
    }
    if (support) this.launchBuyOrders(support.fireCount)
    if (this.barrageLeft > 0) {
      // 매수세례 (503번): 매수벽이 짧은 동안 굵은 매수 주문을 쏟아 낸다.
      const every = ACTIVES.barrage.seconds / ACTIVES.barrage.shots
      const lane = this.lane()
      this.barrageClock += dt
      while (this.barrageLeft > 0 && this.barrageClock >= every) {
        this.barrageClock -= every
        this.barrageLeft--
        this.buyWallFx?.launch(
          buyOrderX(lane.left, lane.width),
          this.buyWallY(),
          this.buyOrderDamage() * ACTIVES.barrage.power,
          true,
        )
      }
    }
    this.buyWallFx?.step(dt, (x, fromY, toY, damage, barrage) => {
      // 매수 주문이 벽에 닿으면 서버에 제 종류로 알린다: 탄의 횟수 예산을 쓰지 않는다 (매수세례 503번, 보통 매수 주문 514번).
      this.reportAs = barrage ? 'barrage' : 'buy'
      const targets = this.magicTargets().filter(
        (e) =>
          Math.abs(e.x - x) <= Math.max(16, e.displayWidth * 0.45) &&
          e.y <= fromY + 12 &&
          e.y >= toY - 12,
      )
      const hit = targets.sort((a, b) => b.y - a.y)[0]
      if (!hit) return damage
      this.glow(x, hit.y, 0xffbb79, 28, 180)
      // 매수 주문과 매도 물량은 서로 수량만큼 상쇄한다: 남은 매수는 계속 날아간다. 허매도는 수량 없이 사라지고, 몬스터·벽은 매수를 다 받는다.
      if (hit.kind === 'fake') {
        this.hit(hit, hit.hp, -Math.PI / 2, 'bullet')
        return damage
      }
      if (quantityOrder(hit.kind) && !hit.boss && !hit.cell) {
        const { used, left } = crossOrders(damage, hit.hp)
        this.hit(hit, used, -Math.PI / 2, 'bullet')
        return left
      }
      this.hit(hit, damage, -Math.PI / 2, 'bullet')
      return 0
    })
    this.reportAs = null
    this.drawBuyWall()
    // 벽 앞에서는 멈춰 서서 쏘고, 벽을 부수면 다음 벽까지 걸어간다 (493번): 배경도 그때만 흐른다.
    const scroll =
      this.idleAdvancing && !this.reducedMotion
        ? Math.max(move, dt * (this.runRush > 0 ? 620 : 95))
        : move
    this.climbV = dt > 0 ? scroll / dt : 0
    this.climbed += scroll
    if (scroll !== 0) {
      for (const bg of [this.bg, this.bg2]) {
        if (!bg) continue
        bg.y += scroll * 0.5
        if (bg.y >= h) bg.y -= 2 * h
        if (bg.y < -h) bg.y += 2 * h
      }
    }
    for (const wl of this.walls) {
      wl.y += move
      if (!wl.broken) {
        this.placeWall(wl)
        // 잡몹 구간의 다음 벽은 화면 밖에서 기다린다.
        const a = rushing && !wl.arrived ? 0 : 1
        for (const c of wl.cells) if (c.active && !c.dying) c.setAlpha(a)
      } else wl.price.y += move
    }
    if (wall && !rushing && wall.y > 0 && !wall.bossStarted && (wall.spec.boss || wall.spec.mid)) {
      this.startWhale(wall)
    }
    // 무너진 벽의 이름표가 화면 아래로 빠지면 치운다.
    this.walls = this.walls.filter((wl) => {
      if (wl.broken && wl.price.y > h + 30) {
        wl.price.destroy()
        return false
      }
      return true
    })
    if (wall && wall.y > -20 && !this.over) {
      // 잡몹 구간 (#593)에는 화면 맨 위에 멈춘 다음 벽이 더 잦게 물량을 쏟아 낸다.
      const every = rushing
        ? rushSpawnSeconds(wall.spec, spec)
        : spawnSeconds(wall.spec, spec, this.stuck, wall.arrived)
      if (this.elapsed - this.lastFlow > every) {
        this.lastFlow = this.elapsed
        this.spawnFlow(wall)
      }
    }
    const boss = this.bossEnemy
    if (
      boss?.active &&
      !boss.dying &&
      this.elapsed - this.lastSummon > whaleSummonSeconds(boss.hp, this.bossMax)
    ) {
      this.lastSummon = this.elapsed
      this.whaleSummon(boss)
    }
    this.drawClimb(dt)
    this.climbV = dt > 0 ? move / dt : 0
  }

  /**
   * 매수 주문 한 장의 피해. 자동 전투는 무기와 따로 센다 (514번): 그 벽의 물량 배율과 매수벽 공격 강화만 따른다. 스테이지는 전처럼 공격력의
   * 0.75배다.
   */
  private buyOrderDamage() {
    return this.opts.idle
      ? idleBuyOrderDamage(this.hpScale, this.loadout.buyBonus)
      : this.loadout.damage * BUY_WALL.orderDamage * (1 + this.loadout.buyBonus)
  }

  private launchBuyOrders(count: number) {
    const lane = this.lane()
    for (let i = 0; i < count; i++) {
      this.buyWallFx?.launch(
        buyOrderX(lane.left, lane.width),
        this.buyWallY(),
        this.buyOrderDamage(),
      )
    }
  }

  private circuitBarrier() {
    const lane = this.lane()
    return { left: lane.left, width: lane.width, y: (this.stopY() + this.buyWallY()) / 2 }
  }

  /** 거래 정지 동안 전투 시계·탄·적은 멈추고 주문 대기와 멘탈 회복만 진행한다. */
  private circuitStep(dt: number) {
    const c = this.circuit
    if (!c) return
    const remaining = this.opts.idle?.().circuitSeconds ?? 0
    const target = this.opts.idle
      ? remaining > 0
        ? Math.min(
            CIRCUIT_BREAKER.seconds - 0.001,
            Math.max(c.elapsed + dt, CIRCUIT_BREAKER.seconds - remaining),
          )
        : CIRCUIT_BREAKER.seconds
      : c.elapsed + dt
    const recovered = c.step(Math.max(0, target - c.elapsed))
    this.mental = Math.min(this.loadout.maxMental, this.mental + recovered)
    this.marketStats.recovered += recovered
    const { w, h } = this.view()
    const wall = this.circuitWall
    const barrier = this.circuitBarrier()
    // 거래 정지 동안 매도·매수 주문이 대기 줄에 잔뜩 쌓인다. 매도가 훨씬 많다(CIRCUIT_BREAKER.sellEvery·buyEvery).
    const open = c.elapsed < CIRCUIT_BREAKER.seconds - CIRCUIT_BREAKER.stopBefore
    this.circuitSellClock += dt
    while (open && wall && this.circuitSellClock >= CIRCUIT_BREAKER.sellEvery) {
      this.circuitSellClock -= CIRCUIT_BREAKER.sellEvery
      const r = Math.random()
      this.spawn(r < 0.6 ? 'order' : r < 0.9 ? 'market' : 'bulk', [
        barrier.left + barrier.width * (0.08 + Math.random() * 0.84),
        wall.y + 20 + Math.random() * 30,
      ])
    }
    this.circuitBuyClock += dt
    while (open && this.buyWall?.active && this.circuitBuyClock >= CIRCUIT_BREAKER.buyEvery) {
      this.circuitBuyClock -= CIRCUIT_BREAKER.buyEvery
      this.buyWallFx?.launch(
        barrier.left + barrier.width * (0.08 + Math.random() * 0.84),
        this.buyWallY(),
        this.buyOrderDamage(),
      )
    }
    this.launchBuyOrders(this.buyWall?.stepOrders(dt * 0.2) ?? 0)
    const sells = (this.enemies.getChildren() as Enemy[])
      .filter((e) => e.active && !e.dying && isOrder(e.kind) && !e.cell && !e.boss)
      .sort((a, b) => b.y - a.y)
    for (const e of sells) {
      this.circuitSellQueue.move(e, dt, barrier, 'sell')
      ;(e.body as Phaser.Physics.Arcade.Body).updateFromGameObject()
    }
    this.buyWallFx?.holdOrders(dt, barrier)
    if (wall) {
      wall.band.setAlpha(1)
      for (const e of wall.cells) {
        e.setAlpha(1)
        e.cell?.label.setAlpha(1)
      }
    }
    this.circuitFx?.draw(c, w, h, this.player.x, this.player.y, this.reducedMotion, {
      ...barrier,
      buys: this.buyWallFx?.queuedOrders ?? 0,
      sells: this.circuitSellQueue.size,
    })
    this.player.setTexture('hero-idle')
    for (const [i, mate] of this.mates.entries()) mate.body.setTexture(mateKey(this.mateLook(i)))
    this.pushHud(true)
    if (!c.done) return
    this.endCircuit()
  }

  private endCircuit() {
    const c = this.circuit
    if (!c) return
    const wall = this.circuitWall
    this.circuitFx?.destroy()
    this.circuitFx = null
    this.circuit = null
    if (wall) {
      wall.arrived = true
      wall.band.setAlpha(1)
      for (const e of wall.cells) {
        e.setAlpha(1)
        e.cell?.label.setAlpha(1)
      }
      this.rushLeft = 0
      this.stuck = 0
      this.marketStats.formedWalls++
      this.marketStats.formedPieces += c.assembled
      this.marketStats.wallHpAfter = wall.cells.reduce((sum, e) => sum + e.hp, 0)
    }
    this.circuitWall = null
    this.circuitSellQueue.clear()
    this.buyWallFx?.endCircuit()
    this.invulnUntil = Math.max(this.invulnUntil, this.elapsed + 1.2)
    this.lastFlow = this.elapsed
    this.opts.onBanner('거래 재개! 대기 주문이 출발합니다!', '#ffce7a')
    if (!this.paused && !this.choosing && !this.stopped && !this.over) this.physics.resume()
  }

  /** 개발 서버의 회귀 검사에서 실제 생성·회복·정지 상태를 읽는다. */
  inspectMarket() {
    return {
      ...this.marketStats,
      boss: this.bossEnemy?.active ? { hp: this.bossEnemy.hp, maxHp: this.bossEnemy.maxHp } : null,
      simSpeed: this.simSpeed,
      climbed: this.climbed,
      nextWallIn: this.nextWallIn,
      pushedEnemies: (this.enemies.getChildren() as Enemy[])
        .filter((e) => e.active && !e.dying && e.wallPushUntil > this.elapsed)
        .map((e) => ({ y: e.y, velocityY: e.body?.velocity.y })),
      buyWall: this.buyWall
        ? {
            hp: this.buyWall.hp,
            maxHp: this.buyWall.maxHp,
            breaks: this.buyWall.breaks,
            shots: this.buyWall.shots,
            sells: this.buyWall.sells,
            rebuildLeft: this.buyWall.rebuildLeft,
            retreatLeft: this.buyWall.retreatLeft,
            playerX: this.player.x,
            playerY: this.player.y,
            wallY: this.buyWallY(),
            feedback: this.buyWallFx?.inspect(),
          }
        : null,
      circuit: this.circuit
        ? {
            elapsed: this.circuit.elapsed,
            assembled: this.circuit.assembled,
            barrier: this.circuitBarrier(),
            queuedBuy: this.buyWallFx?.queuedOrders ?? 0,
            queuedSell: this.circuitSellQueue.size,
          }
        : null,
      sellOrders: (this.enemies.getChildren() as Enemy[]).flatMap((e, id) =>
        e.active && !e.dying && isOrder(e.kind) && !e.cell && !e.boss
          ? [{ id, x: e.x, y: e.y, hp: e.hp }]
          : [],
      ),
      projectiles: (this.bullets.getChildren() as Bullet[]).flatMap((b, id) =>
        b.active
          ? [{ id, x: b.x, y: b.y, expiresAt: b.life, remainingMs: b.life - this.elapsed * 1000 }]
          : [],
      ),
      battleSeconds: this.elapsed,
      running: Boolean(this.opts.idle && !this.circuit && !this.paused),
      runRush: this.runRush,
      catTextures: [this.player.texture.key, ...this.mates.map((mate) => mate.body.texture.key)],
      mental: this.mental,
      maxMental: this.loadout.maxMental,
      physicsPaused: this.physics.world.isPaused,
    }
  }

  /** 지나가는 호가 줄(길 위의 옅은 가로줄)과 오르는 동안의 속도선. */
  private drawClimb(dt: number) {
    const spec = this.assault
    const book = this.book
    const ladder = this.ladder
    if (!spec || !book || !ladder) return
    const { h } = this.view()
    const lane = this.lane()
    const step = 46
    const off = this.climbed % step
    book.clear()
    for (let y = off - step; y < h; y += step) {
      book.fillStyle(0xffffff, 0.07)
      book.fillRect(lane.left, y, lane.width, step / 2)
      book.fillStyle(0x8fb8ff, 0.35)
      book.fillRect(lane.left - 6, y, 4, step / 2)
      book.fillRect(lane.right + 2, y, 4, step / 2)
    }
    // 오른쪽 가격 눈금은 뺐다 (416번).
    ladder.clear()
    // 속도선: 오를 때만, 빠를수록 짙게.
    const speed = this.climbV
    const k = Phaser.Math.Clamp(
      (speed - ASSAULT_MOTION.drift * 0.5) / (ASSAULT_MOTION.dash - ASSAULT_MOTION.drift),
      0,
      1,
    )
    for (const line of this.speedLines) {
      line.y += speed * 1.8 * dt
      if (line.y > h + 70) {
        line.y = -Phaser.Math.Between(60, 200)
        line.x = Phaser.Math.Between(lane.left, lane.right)
      }
      line.setAlpha(speed > 0 ? 0.12 + k * 0.6 : Math.max(0, line.alpha - dt * 3))
    }
  }

  // ── 생성

  private spawnPoint(): [number, number] {
    const w = this.view().w
    return [Phaser.Math.Between(Math.round(w * 0.16), Math.round(w * 0.84)), -40]
  }

  /** 적 하나를 꺼낸다. 길막 적(force)은 화면에 적이 많아도 꺼낸다: 못 꺼내면 구간이 안 끝난다. */
  private spawn(kind: UnitKind, at?: [number, number], force = false): Enemy | null {
    // 공격 판은 벽 칸(최대 30)이 함께 살아 있어 물량 상한을 그만큼 넉넉히 둔다.
    const cap = BattleScene.MAX_ALIVE + (this.assault ? 40 : 0)
    if (!force && this.enemies.countActive() >= cap) {
      return null
    }
    const [x, y] = at ?? this.spawnPoint()
    const e = this.enemies.get(x, y, kind) as Enemy | null
    if (!e) {
      return null
    }
    e.cell = null
    e.blocker = false
    e.boss = false
    e.wallPushUntil = 0
    e.slowUntil = 0
    e.slowFactor = 1
    e.stunUntil = 0
    e.chilled = false
    e.tintKind = 0
    const v = UNITS[kind]
    const k = unitK(kind)
    e.baseK = k
    e.setTexture(enemyKey(kind, 0))
      .enableBody(true, x, y, true, true)
      .setScale(k)
      .setAngle(0)
      .clearTint()
      .setAlpha(1)
      .setDepth(3)
    enemyBody(e, v.r)
    e.look = 0
    e.walkOffset = Phaser.Math.Between(0, WALK_FRAMES - 1)
    e.dying = false
    e.kind = kind
    if (kind !== 'spec') {
      e.setScale(0.3 * k)
      this.tweens.add({ targets: e, scale: k, duration: 220, ease: 'Back.easeOut' })
    }
    // 디펜스 번호 스테이지는 뒤로 갈수록 적이 단단하다 (509번). 공격 판은 판의 물량 체력 배율(413번).
    // 공격 판의 매도 물량은 화면의 수량이 곧 체력이다: 100주면 100주만큼 맞아야 체결된다.
    e.hp =
      this.mode === 'defense'
        ? v.hp * this.staged(this.hpScale)
        : this.assault
          ? quantityOrder(kind) && isOrder(kind)
            ? orderHp(kind, this.hpScale)
            : v.hp * this.hpScale
          : v.hp
    e.maxHp = e.hp
    e.kbx = 0
    e.kby = 0
    e.born = this.elapsed
    if (this.buyWall && kind !== 'cell' && kind !== 'whale') this.buyWall.sells++
    if (this.assault && (kind === 'panic' || kind === 'dump')) {
      if (this.marketStats[kind] === 0 && !this.opts.idle)
        this.opts.onBanner(
          kind === 'panic' ? '패닉셀 무리 출현!' : '투매 몬스터가 밀려온다!',
          kind === 'panic' ? '#82bbff' : '#c5a1ff',
        )
      this.marketStats[kind]++
    }
    if (this.assault && (kind === 'stop' || kind === 'spec' || kind === 'short')) {
      if (!this.assaultSeen.has(kind)) {
        this.assaultSeen.add(kind)
        const [text, color] = ASSAULT_MOB_BANNERS[kind]
        this.opts.onBanner(text, color)
      }
    }
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
        if (bg.y < -h) bg.y += 2 * h
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
    if (this.mode === 'defense' && this.opts.stage) {
      return numberedStageScale(scale, this.elapsed)
    }
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
    const { w } = this.view()
    const grow = 1 + Math.min(1.5, this.curve() / 120)
    // 세 줄로 쏟아진다: 처음 15, 뒤로 갈수록 36까지. 전에는 6~15로 '쏟아진다'는 말이 무색했다.
    const n = Math.min(
      60,
      Math.round(15 * grow * this.staged(this.countScale) * (this.assault ? 0.6 : 1)),
    )
    const cols = Math.ceil(n / 3)
    for (let i = 0; i < n; i++) {
      this.spawn('dump', [
        w * 0.16 + (Math.floor(i / 3) + 0.5) * ((w * 0.68) / cols),
        -30 - (i % 3) * 44,
      ])
    }
  }

  private waveShort() {
    const { w } = this.view()
    const count = Math.min(
      24,
      Math.round((6 + Math.min(6, this.elapsed / 30)) * this.staged(this.countScale)),
    )
    const cols = Math.ceil(count / 2)
    for (let i = 0; i < count; i++) {
      this.spawn('short', [
        w * 0.16 + (((i % cols) + 0.5) * w * 0.68) / cols,
        -40 - Math.floor(i / cols) * 64,
      ])
    }
    this.opts.onBanner('공매도 웨이브! 방패 대열이 밀려온다!', '#9eb7ff')
  }

  /**
   * 자동 전투의 몬스터 습격 (500번): 몬스터는 평소에 나오지 않고, 이따금 알림과 함께 한 떼가 몰려온다. 종류는 패닉셀 → 투매 → 공매도 → 투기 순으로
   * 돈다. 거래 정지와 벽이 바뀌는 사이에는 미룬다.
   */
  private idleRaidStep(dt: number) {
    if (this.elapsed >= this.nextIdleRaid && !this.circuit && !this.idleTransition) {
      // 테스트판이 고른 습격(callIdleRaid)이 있으면 그것을, 아니면 차례대로.
      const kind = this.calledRaid ?? idleRaidKind(this.idleRaids++)
      this.calledRaid = null
      this.nextIdleRaid = this.elapsed + idleRaidGap(Math.random())
      const [text, color] = IDLE_RAID_BANNERS[kind]
      this.opts.onIdleRaid?.(text, color)
      if (kind === 'panic') this.startPanicRush()
      else if (kind === 'dump') this.waveDump()
      else if (kind === 'short') this.waveShort()
      else this.raidSpec()
      if (kind !== 'panic') sfx.rumble()
    }
    this.pourPanicRush(dt)
  }

  /** 테스트판 (499번): 기다리지 않고 그 종류의 습격을 바로 부른다. 거래 정지나 벽이 바뀌는 중이면 끝나는 대로 온다. */
  callIdleRaid(kind: IdleRaidKind) {
    if (!this.opts.idle) return
    this.calledRaid = kind
    this.nextIdleRaid = this.elapsed
  }

  /** 투기 세력: 크고 느린 투기 몬스터 몇과 그 앞의 손절매 한 줄. */
  private raidSpec() {
    const { w } = this.view()
    const specs = Math.min(8, Math.round(3 * this.staged(this.countScale)))
    for (let i = 0; i < specs; i++) {
      this.spawn('spec', [w * 0.16 + ((i + 0.5) * w * 0.68) / specs, -70])
    }
    const stops = Math.min(12, Math.round(5 * this.staged(this.countScale)))
    for (let i = 0; i < stops; i++) {
      this.spawn('stop', [w * 0.16 + ((i + 0.5) * w * 0.68) / stops, -24])
    }
  }

  /** 패닉셀 러시: 판 중간중간 갑자기 "패닉셀이 몰려온다!!" 하고 몇 초 동안 위에서 패닉셀이 쏟아진다. */
  private panicRushStep(dt: number) {
    if (this.panicRushLeft === 0 && this.elapsed >= this.nextPanicRush) {
      // 정해진 파도와 겹치면 조금 미룬다.
      if (Math.abs(this.nextWave - this.elapsed) < PANIC_RUSH.waveGuard) {
        this.nextPanicRush = this.nextWave + PANIC_RUSH.waveGuard
        return
      }
      this.nextPanicRush = this.elapsed + PANIC_RUSH.seconds + panicRushGap(Math.random())
      this.opts.onBanner('패닉셀이 몰려온다!!', '#e8434f')
      this.startPanicRush()
    }
    this.pourPanicRush(dt)
  }

  private startPanicRush() {
    this.panicRushLeft = Math.max(
      8,
      Math.round(PANIC_RUSH.count * this.staged(this.countScale) * (this.assault ? 0.6 : 1)),
    )
    this.panicRushEvery = PANIC_RUSH.seconds / this.panicRushLeft
    this.panicRushClock = 0
    if (!this.reducedMotion) this.cameras.main.shake(320, 0.006)
    sfx.rumble()
    haptic.medium()
  }

  private pourPanicRush(dt: number) {
    if (this.panicRushLeft === 0) return
    this.panicRushClock += dt
    const { w } = this.view()
    while (this.panicRushLeft > 0 && this.panicRushClock >= this.panicRushEvery) {
      this.panicRushClock -= this.panicRushEvery
      this.panicRushLeft--
      // 길 폭 안에서 두세 마리씩 겹쳐 쏟아지듯 위에서 내려온다.
      this.spawn('panic', [w * (0.14 + Math.random() * 0.72), -30 - Math.random() * 60])
    }
  }

  private wavePanic() {
    const { w, h } = this.view()
    // 두 겹의 반원 떼: 처음 24, 뒤로 갈수록 44까지. 전에는 10~20이라 떼 같지 않았다.
    const n = Math.min(
      80,
      Math.round(
        (24 + Math.min(20, this.curve() / 8)) *
          this.staged(this.countScale) *
          (this.assault ? 0.6 : 1),
      ),
    )
    const half = Math.ceil(n / 2)
    for (let i = 0; i < n; i++) {
      const ring = i < half ? 0 : 1
      const j = ring ? i - half : i
      const m = ring ? n - half : half
      const a = Math.PI + ((j + 0.5) / m) * Math.PI
      const rw = w * (0.28 + ring * 0.05)
      const rh = h * (0.5 + ring * 0.14)
      this.spawn('panic', [w / 2 + Math.cos(a) * rw, -35 + Math.sin(a) * rh])
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
    const label = damageLabel(kind, slot.total, Boolean(this.assault))
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
    const r = UNITS[e.kind].r * DPR * Math.abs(e.scaleY)
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

  private hit(e: Enemy, dmg: number, angle: number, kind: DamageKind = 'bullet', area = false) {
    if (e.dying || !e.active) return
    if (this.beyondWall(e) && !(area && e.cell)) return
    if (e.kind === 'fake') {
      // 허매도 (413번): 맞히면 그냥 사라진다. 체결이 아니라 처치·경험치가 없다.
      this.damageNumber(e, dmg, kind)
      this.pop(e.x, e.y - 24, '허매도!', '#c8d4e8', 18)
      this.kill(e, false)
      return
    }
    if (this.held(e)) {
      // 잡몹 구간의 다음 벽은 아직 멀어 깨지지 않는다: 튕겨 나가는 불꽃만.
      this.hitSpark.explode(2, e.x - Math.cos(angle) * 10, e.y + 10)
      return
    }
    if (this.opts.idle && e.cell) {
      if (!this.idleTransition) {
        this.reportIdleHit(this.idleWall, kind, dmg)
        this.idleHits.push({ at: performance.now(), amount: dmg })
      }
    } else e.hp -= dmg
    // 매도벽은 연사 중에도 장갑과 균열이 보여야 한다. 밝기만 올리고 명중 불꽃을 얹는다.
    if (e.cell) e.clearTint()
    else e.setTintFill(0xffffff)
    this.time.delayedCall(55, () => e.active && this.paint(e))
    // 맞는 자리에 불꽃이 튀고 살짝 들썩인다.
    this.hitSpark.explode(3, e.x - Math.cos(angle) * 10, e.y - Math.sin(angle) * 10)
    sfx.hit()
    if (this.assault && (e.cell || e.boss)) {
      // 공격 판의 벽 칸·큰손은 1초에 여러 번 맞아 들썩임 트윈이 겹치면 크기가 조금씩 불었다: 번쩍임과 금·파편만.
      if (e.cell) this.crackCell(e)
    } else {
      // 들썩임은 늘 제 크기(baseK)에서 시작해 제 크기로 끝난다. 지금 크기에서 곱하면 연달아 맞을 때(대량 매도처럼 단단한 적) 가로세로가 따로
      // 불어 찌그러졌다.
      this.tweens.killTweensOf(e)
      const k = e.baseK || e.scaleX
      e.setScale(k)
      this.tweens.add({
        targets: e,
        scaleX: k * 1.18,
        scaleY: k * 0.84,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          if (e.active && !e.dying) e.setScale(k)
        },
      })
    }
    // 탄에 맞아도 밀려나지 않는다: 밀리면 내려오던 줄이 흐트러져 조준이 어긋났다. 밀림은 사장냥에 부딪혔을 때(hurt)만.
    // 데미지 숫자는 모든 적, 죽이는 마지막 한 방까지 (391번, 334번의 "한 방에 안 죽는 적에만"을 뒤집음). 리볼버 치명타(376번)는 크고 노랗다.
    this.damageNumber(e, dmg, kind)
    if (e.hp <= 0) {
      const wall = e.cell?.wall
      const over = -e.hp
      this.kill(e, true)
      // 매도벽은 한 묶음의 체력이다: 맨 아래 층을 부수고 남은 피해는 다음 층이 받는다.
      const next = wall && over > 0 && !wall.broken ? this.frontLayer(wall) : null
      if (next) this.hit(next, over, angle, kind)
    }
  }

  private kill(e: Enemy, byPlayer: boolean) {
    const v = UNITS[e.kind]
    if (e.boss && this.assault) {
      e.boss = false
      this.bossEnemy = null
      this.boom[e.kind].explode(40, e.x, e.y)
      this.fill(e.x, e.y, UNITS.whale.shares ?? 0, '#ffd84d')
      this.whaleDown()
    } else if (e.boss) {
      e.boss = false
      this.bossEnemy = null
      this.hitstop(140)
      this.boom[e.kind].explode(40, e.x, e.y)
      this.opts.onBanner(
        this.mode === 'advance' ? '돌파!! 멘탈 전진 성공' : '보스 격파!! 멘탈 지켜냈다',
        '#ffd84d',
      )
      this.finish(true, 'clear')
    }
    if (e.cell) {
      // 매도벽 칸 (413번): 물량이 체결되며 부서져 떨어진다. 처치 수에는 넣지 않고 경험치를 준다(#700에서 늘림).
      this.cellBroken(e)
      this.score += v.reward
      this.gainXp(v.reward)
      e.dying = true
      if (e.body) e.body.enable = false
      this.tweens.killTweensOf(e)
      this.tweens.add({
        targets: e,
        y: e.y + 26,
        angle: Phaser.Math.Between(-25, 25),
        alpha: 0,
        duration: this.reducedMotion ? 120 : 300,
        ease: 'Quad.easeIn',
        onComplete: () => e.disableBody(true, true),
      })
      return
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
      if (isOrder(e.kind)) {
        // 매도 물량을 잡았다: 물량이 0까지 깎이며 "체결!" (413번). 물량이 줄면 가격이 조금 오른다 (#593).
        if (e.kind !== 'whale') this.fill(e.x, e.y, orderShares(e.kind, this.hpScale))
      } else {
        sfx.squish()
      }
      if (e.kind === 'spec') {
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
    if (this.opts.idle) return
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
      if (!this.over && !this.paused && !this.choosing && !this.circuit) {
        this.physics.resume()
      }
      this.stopped = false
    })
  }

  private hurt(dmg: number, e?: Enemy, contactX?: number, force = false) {
    if (this.opts.idle) return
    if ((!force && this.elapsed < this.invulnUntil) || this.over) {
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
    this.opts.onHurt()
    sfx.ouch()
    if (e) this.hurtUntil = this.elapsed * 1000 + HURT_MS
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

  private buyWallY() {
    // 위에서 내려오는 물량을 플레이어보다 먼저 막는다. 돌진·후퇴에도 함께 움직인다.
    return this.player.y - 80
  }

  private drawBuyWall() {
    if (!this.buyWall || !this.buyWallFx) return
    const lane = this.lane()
    this.buyWallFx.draw(this.buyWall, lane.left, lane.width, this.buyWallY(), this.reducedMotion)
  }

  /**
   * 매도 주문들을 seconds초 동안 위로(뒤로) 밀어낸다. 매수벽이 무너질 때만 쓰고, 화면 중간선을 넘어온 적만 민다(#699). 새 매수벽이 설 때는
   * 밀지 않는다(458번).
   */
  private pushEnemiesBack(seconds: number) {
    const height = this.view().h
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy
      if (!enemy.active || enemy.dying || enemy.cell) continue
      if (!pushedByCollapse(enemy.y, height)) continue
      enemy.wallPushUntil = Math.max(enemy.wallPushUntil, this.elapsed + seconds)
      enemy.kbx = 0
      enemy.kby = 0
      enemy.setVelocity(0, -600)
    }
  }

  /**
   * 매도 물량이 매수벽에 닿을 때 깎는 양 (전투 단위): 매도 주문·시장가·대량 매도는 남은 수량 그대로다(수량이 곧 공격). 몬스터와 허매도는 바탕 피해 ×
   * 진행 배율이다.
   */
  private sellAttack(e: Enemy): number {
    if (quantityOrder(e.kind) && !e.boss) return Math.max(0, e.hp)
    return Math.round(UNITS[e.kind].dmg * this.staged(this.dmgScale))
  }

  hitBuyWall(damage: number, x: number) {
    if (!this.buyWall?.active || this.over) return
    const before = this.buyWall.hp
    const broken = this.buyWall.hit(damage)
    if (!broken && this.buyWall.hp === before) return
    this.buyWallFx?.impact(x, broken)
    const lost = broken ? before : before - this.buyWall.hp
    this.pop(x, this.buyWallY() - 55, `매수 -${shareLabel(lost)}`, '#ffb278', 20)
    if (broken && this.opts.idle) {
      this.pop(this.view().w / 2, this.buyWallY() - 84, '매수벽 붕괴! 공격 중단', '#ff8a5c', 22)
    }
    if (broken) {
      const loss = Math.max(1, Math.round(this.loadout.maxMental * BUY_WALL.mentalLossRatio))
      this.opts.onBanner(`매수벽 붕괴! 멘탈 -${loss} · 1.5초 후 재건`, '#ffb278')
      // 일반 피격 무적 시간과 무관하게 붕괴 한 번당 정확히 한 번 깎는다.
      this.hurt(loss, undefined, undefined, true)
      this.pushEnemiesBack(0.35)
      // 자동 전투는 무너진 동안 공격이 멈춘다(492번): 쌓인 물량이 새 벽을 곧바로 다시 무너뜨리지 않게, 무너지며 화면의 물량을 모두 받아 낸다 (494번).
      if (this.opts.idle) {
        this.sweepFlows(0)
        this.stuck = 0
      }
      sfx.crumble()
      haptic.medium()
    } else {
      this.playSound('thud')
      haptic.light()
    }
    this.drawBuyWall()
    this.pushHud(true)
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

  /**
   * 이번에 쏠 곳(0번 사장냥, 1번부터 고양이): 디펜스에서 누르고 있으면 모두 누른 자리, 전진 모드는 자동 조준의 과녁, 디펜스에서 안 누르면 사장냥 총에서
   * 520px 안의 가까운 적을 고양이마다 나눠 맡는다(409번, mates.ts spreadTargets. 393번에서는 모두 한 적을 쏴 몰렸다).
   */
  private shotTargets(): ({ x: number; y: number } | null)[] {
    const ptr = this.input.activePointer
    const count = 1 + this.mates.length
    // 디펜스에서 누르고 있으면 모두 누른 자리를 쏜다.
    if (ptr.isDown && this.mode === 'defense') {
      const at = { x: ptr.worldX, y: ptr.worldY }
      return Array.from({ length: count }, () => at)
    }
    // 전진 모드는 제자리에서 자동 조준한다.
    if (this.mode === 'advance') {
      const t = this.autoTarget()
      return Array.from({ length: count }, () => t)
    }
    const shooters = [
      catMuzzle('hero', this.player.x, this.player.y),
      ...this.mates.map((m, i) => catMuzzle(mateModel(this.mateLook(i)), m.body.x, m.body.y)),
    ]
    // 공격 판 (#593, 413번의 "위로 곧게"를 뒤집음): 자동 조준. 매도 물량(허매도 빼고)을 고양이마다 나눠 맡고, 없으면 큰손, 그것도 없으면 제 머리 위로
    // 곧게(바로 위의 매도벽).
    if (this.assault) {
      const orders: Enemy[] = []
      for (const child of this.enemies.getChildren()) {
        const e = child as Enemy
        if (
          e.active &&
          !e.dying &&
          !e.cell &&
          !e.boss &&
          e.kind !== 'fake' &&
          e.y > -10 &&
          !this.beyondWall(e)
        ) {
          orders.push(e)
        }
      }
      const boss = this.bossEnemy?.active && !this.bossEnemy.dying ? this.bossEnemy : null
      const wallOf = (i: number) =>
        boss ??
        nearestTo(
          this.magicTargets().filter((e) => Boolean(e.cell)),
          shooters[i],
        )
      const targets = spreadTargets(shooters, orders, 900).map((t, i) => t ?? wallOf(i))
      // 자동 전투 (504번): 물량이 끊이지 않아도 매도벽은 맞아야 한다. 고양이가 있으면 사장냥은 벽만 쏘고 고양이들이 물량을 맡는다. 혼자면 세 발에
      // 한 발을 벽에 쏜다(물량을 막는 손이 사장냥뿐이라 더 자주 쏘면 매수벽이 못 버틴다). 전에는 물량이 있는 동안 아무도 벽을 쏘지 않아, 깊은 벽에서 벽이 한참 깎이지 않았다.
      if (this.opts.idle && (this.mates.length > 0 || this.heroAims % 3 === 2)) {
        const wall = wallOf(0)
        if (wall && !('cell' in wall && this.held(wall as Enemy))) targets[0] = wall
      }
      return targets
    }
    // 안 누르면 고양이마다 다른 적을 노린다 (409번): 사장냥 총에서 520px 안의 가까운 적을 나눠 맡는다.
    const live: Enemy[] = []
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (e.active && !e.dying) live.push(e)
    }
    return spreadTargets(shooters, live, 520)
  }

  /** 초당 발사 수를 기존의 80%로 낮춘다. */
  private get attackInterval() {
    return (this.loadout.fireMs * 1.25 * SHOT_WEIGHT) / this.rallyFire
  }

  /** 불장 (503번): 타는 동안 모든 총이 두 배 빨리 나간다. */
  private get rallyFire() {
    return this.elapsed < this.rallyUntil ? ACTIVES.rally.fire : 1
  }

  /** 액티브 스킬을 쓴다 (503번): 서버가 받아 준 뒤에 부른다. */
  castActive(code: ActiveCode) {
    if (!this.opts.idle || this.over) return
    if (code === 'barrage') {
      this.barrageLeft = ACTIVES.barrage.shots
      this.barrageClock = 0
    } else if (code === 'rally') {
      this.rallyUntil = this.elapsed + ACTIVES.rally.seconds
    } else {
      this.buyWall?.fortify(ACTIVES.fortify.seconds)
      this.drawBuyWall()
    }
    const [text, color] = ACTIVE_BANNERS[code]
    this.opts.onIdleRaid?.(text, color)
    sfx.levelUp()
    haptic.medium()
  }

  /** index번째 고양이가 따로 든 총 (488번). 없으면 사장냥과 같은 총을 쏜다(393번). */
  private mateGun(index: number): MateGun | undefined {
    return this.loadout.mateGuns[index]
  }

  private mateInterval(index: number) {
    return (
      ((this.mateGun(index)?.fireMs ?? this.loadout.fireMs) * 1.25 * SHOT_WEIGHT) / this.rallyFire
    )
  }

  /**
   * 고양이 그림을 든 무기대로 굽는다 (511번). 자동 전투는 고양이마다 제 무기의 등급, 스테이지의 카드 고양이는 사장냥과 같은 무기다.
   * 장비가 바뀌어 등급이 달라졌을 때만 다시 굽는다. 같은 그림을 쓰는 고양이의 빛깔도 여기서 몸에 입힌다(492·493번).
   */
  private bakeMateGuns() {
    // 그림을 불러오기 전에 수치가 먼저 들어올 수 있다(applyLoadout): 그때는 create가 굽는다.
    if (!this.textures?.exists('art-weapons')) return
    const hero = this.opts.hero.weapon.grade
    const grades = MATE_LOOKS.map(() => (this.opts.idle ? DEFAULT_WEAPON.grade : hero))
    for (const gun of this.loadout.mateGuns)
      if (gun.look !== undefined) grades[gun.look] = gun.grade
    const key = grades.join()
    if (key === this.mateGunsBaked) return
    this.mateGunsBaked = key
    bakeMates(this, grades)
    if (this.opts.idle) bakeCatRuns(this, hero, grades)
  }
  private mateGunsBaked = ''
  /** 사장냥의 반동 (513번, Mate.kick과 같다). */
  private heroKick = 0

  /** index번째 고양이의 그림 차례 (mates.ts MATE_LOOKS): 자동 전투는 고양이마다 제 그림, 스테이지는 들어온 차례다. */
  private mateLook(index: number) {
    return this.mateGun(index)?.look ?? index
  }

  /** 자동 전투에서 다음 벽으로 가는 중인가 (493번): 벽을 부순 직후의 질주, 벽 전환, 아직 벽에 닿지 않은 동안. 벽 앞에서는 멈춰 선다. */
  private get idleAdvancing() {
    if (!this.opts.idle) return false
    return this.runRush > 0 || this.idleTransition || !this.walls.find((w) => !w.broken)?.arrived
  }

  /** 자동 전투에서 매수벽이 무너져 다시 설 때까지는 공격이 멈춘다 (492번): 매수벽 강화가 화력을 지킨다. */
  private get disarmed() {
    return Boolean(this.opts.idle && this.buyWall && !this.buyWall.active)
  }

  /** 한 발 쏜다. mate가 없으면 사장냥, 있으면 그 고양이가 같은 수치(무기·피해·연사·강화)로 쏜다(393번). */
  private fire(now: number, target: { x: number; y: number }, mate?: Mate) {
    const p = mate ? mate.body : this.player
    if (!mate) this.heroAims++
    const model = mate ? mateModel(this.mateLook(this.mates.indexOf(mate))) : 'hero'
    // 표적이 좌우로 바뀌어도 발사 순간에는 실제 총구에서 정확히 겨눈다.
    const aim = catAim(model, p.x, p.y, target)
    const gun = mate ? this.mateGun(this.mates.indexOf(mate)) : undefined
    const kind = gun?.kind ?? this.opts.hero.weapon.kind
    const grade = gun?.grade ?? this.opts.hero.weapon.grade
    const style = GRADE_FIRE[grade]
    // 무기마다 쏘는 방식 (#563): 총은 겨눈 쪽(aim)을 보고, 탄만 흩어진다(기관단총).
    const base = aimWithJitter(kind, aim, Math.random())
    // 재장전 (#587): 탄창을 다 쓰면 재장전 시간만큼 다음 한 발이 늦어진다(lastFire를 미래로 민다).
    const traits = WEAPON_TRAITS[kind]
    const reload = (shots: number) =>
      traits.magazine && shots % traits.magazine === 0 ? traits.reloadMs : 0
    // 사격 모션 (513번): 쏠 때마다 몸이 뒤로 밀렸다 돌아온다. 총구 화염이 큰 무기일수록 세다.
    const kick = this.reducedMotion ? 0 : Math.min(1.5, style.flash)
    if (mate) {
      mate.kick = kick
      mate.shots++
      mate.lastFire = now + reload(mate.shots)
      mate.aim = aim
      this.damageStats.mateShots++
    } else {
      this.heroKick = kick
      this.heroShots++
      const wait = reload(this.heroShots)
      this.lastFire = now + wait
      if (wait > 0) this.pop(p.x, p.y - 70, '장전!', '#ffd84d', 16)
      // 총소리는 사장냥 것만: 넷이 다 내면 뭉개지고 오디오 노드가 쌓인다.
      sfx.shot(kind)
      this.aim = aim
    }
    // 총 손맛: 총구 화염. 크기·시간이 무기마다 다르다.
    const m = catMuzzle(model, p.x, p.y)
    const flash = this.flashes[this.flashIndex++ % this.flashes.length]
    flash
      .setPosition(m.x, m.y)
      .setRotation(aim)
      .setTint(gradeTint(grade))
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
    const sparkCount = Math.min(3, style.sparks)
    this.trail.setParticleTint(gradeTint(grade))
    for (let i = 0; i < sparkCount && !this.reducedMotion; i++) {
      const a = aim + (sparkCount > 1 ? ((i / (sparkCount - 1)) * 2 - 1) * 0.45 : 0)
      this.trail.emitParticleAt(m.x + Math.cos(a) * 18, m.y + Math.sin(a) * 18)
    }
    const stats = bulletStats(gun ?? this.loadout)
    const b = this.bullets.get(m.x, m.y, `bullet-${grade}-0`) as Bullet | null
    if (!b) return
    b.setTexture(`bullet-${grade}-0`).enableBody(true, m.x, m.y, true, true).setDepth(6.5)
    b.kind = kind
    b.grade = grade
    b.critical = gun?.critical ?? 1
    b.look = 0
    b.trailMs = Math.max(90, style.trailMs)
    b.damage = stats.damage * SHOT_WEIGHT
    b.power = stats.power
    b.splashRadius = stats.splashRadius
    b.splashDamage = stats.splashDamage * SHOT_WEIGHT
    b.pierce = pierceOf(kind)
    b.hitList = []
    // 자동 전투에서 사장냥이 매도벽(또는 큰손)을 겨눈 탄은 길 위의 물량을 뚫고 벽까지 간다 (504·516번).
    const aimed = target as Partial<Enemy>
    b.wallShot = Boolean(this.opts.idle) && !mate && Boolean(aimed.cell || aimed.boss)
    b.fromX = m.x
    b.fromY = m.y
    b.range = traits.range == null ? Number.POSITIVE_INFINITY : this.view().h * traits.range
    b.setDisplaySize(
      BULLET_W * stats.scale * style.length * 0.7 * BULLET_VISUAL_SCALE,
      BULLET_ART.h * stats.scale * style.width * 0.7 * BULLET_VISUAL_SCALE,
    ).setRotation(base)
    b.clearTint()
    const hb = bulletHitbox(b.width, b.height, style.length * 0.7 * BULLET_VISUAL_SCALE)
    b.body?.setCircle(hb.radius, hb.ox, hb.oy)
    const speed = gun?.bulletSpeed ?? this.loadout.bulletSpeed
    b.setVelocity(Math.cos(base) * speed, Math.sin(base) * speed)
    b.life = now + BULLET_LIFE
  }

  /** 적의 빛: 기절이면 주황, 느리면 파랑, 아니면 원래대로. */
  private paint(e: Enemy) {
    if (e.tintKind === 2) e.setTint(0xffb38a)
    else if (e.tintKind === 1) e.setTint(0x9fd4ff)
    // 매도벽 칸: 보통 칸은 조금 짙게, 약한 칸은 밝게(좌우로 움직여 노릴 곳).
    else if (e.cell && !e.cell.weak) e.setTint(0xb4c4e4)
    else e.clearTint()
  }

  /** 느리게 한다: 더 느린 쪽, 더 오래 가는 쪽을 남긴다. */
  private slow(e: Enemy, factor: number, seconds: number) {
    const active = e.slowUntil > this.elapsed
    e.slowFactor = active ? Math.min(e.slowFactor, factor) : factor
    e.slowUntil = Math.max(e.slowUntil, this.elapsed + seconds)
  }

  // ── 마법 (392번): 총알과 따로, 제 주기에 스스로 나간다. 레벨이 오를수록 연출이 세 단계로 화려해진다.

  /** 마법의 풀과 파티클을 만든다. 탄·운석·줄기·빛은 미리 만들어 돌려 쓰고, 파티클은 한꺼번에 살아 있는 수를 묶어 폰에서 끊기지 않게 한다. */
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
    for (let i = 0; i < 24; i++) {
      this.meteors.push({
        img: hidden('magic-rock', 6),
        warning: hidden('magic-ring', 3),
        crater: hidden('magic-scorch', 2.5).setTint(0x705d72),
        active: false,
        level: 1,
        tx: 0,
        ty: 0,
        t: 0,
        delay: 0,
      })
    }
    for (let i = 0; i < 12; i++) this.bolts.push(this.add.graphics().setDepth(8).setVisible(false))
    for (let i = 0; i < 20; i++) {
      this.rings.push(hidden('magic-ring', 6))
      this.glows.push(hidden('magic-glow', 5))
    }
    // 땅 (433번): 충차 풀(고양이 넷이 같이 써도 넉넉히), 돌기둥, 흙먼지·돌 조각 파티클.
    this.dustFx = soft({
      speed: { min: 20, max: 120 },
      lifespan: { min: 380, max: 760 },
      scale: { start: 1.6 * TEX, end: 2.6 * TEX },
      alpha: { start: 0.7, end: 0 },
      gravityY: -20,
      tint: [0xd8c09a, 0xb8946a, 0x8a6a48],
    }).setDepth(4.5)
    this.rockFx = this.add
      .particles(0, 0, 'magic-rock', {
        emitting: false,
        maxAliveParticles: 80,
        speed: { min: 90, max: 300 },
        lifespan: { min: 360, max: 680 },
        scale: { start: 1.1 * TEX, end: 0.5 * TEX },
        rotate: { min: 0, max: 360 },
        gravityY: 620,
        alpha: { start: 1, end: 0.2 },
      })
      .setDepth(6)
    for (let i = 0; i < 12; i++) {
      this.rams.push({
        img: hidden('magic-ram', 4.6),
        active: false,
        level: 1,
        x: 0,
        y: 0,
        dx: 0,
        dy: -1,
        half: 0,
        depth: 0,
        t: 0,
        travelled: 0,
        nextSpike: 0,
        hitList: [],
      })
    }
    for (let i = 0; i < 16; i++) this.spikes.push(hidden('magic-spike', 3).setOrigin(0.5, 1))
  }

  /** 마법 소리: 같은 소리는 SOUND_GAP_MS 안에 한 번만 (393번, 고양이 넷이 함께 쓸 때). */
  private playSound(key: SoundKey) {
    const now = performance.now()
    if (now - (this.lastSound[key] ?? Number.NEGATIVE_INFINITY) < SOUND_GAP_MS) return
    this.lastSound[key] = now
    sfx[key]()
  }

  /** 마법의 외곽과 적이 잘 보이도록 파티클을 줄인다. */
  private fx(n: number) {
    return Math.ceil(n * (this.reducedMotion ? 0.2 : 0.45))
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
    this.flare(
      this.glows[this.glowIndex++ % this.glows.length],
      x,
      y,
      tint,
      0.3,
      r / 32,
      Math.min(ms, 240),
      alpha * 0.45,
    )
  }

  /** 마법이 노릴 수 있는 적: 살아 있고 화면 안에 들어온 적. 같은 배열을 다시 채운다. */
  private magicTargets(area = false): Enemy[] {
    const buf = this.targetBuf
    buf.length = 0
    const { w, h } = this.view()
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (
        e.active &&
        !e.dying &&
        (e.cell ? e.cell.wall.y > 0 : e.y > 12) &&
        e.y < h &&
        e.x > 0 &&
        e.x < w &&
        !this.held(e) &&
        (!this.beyondWall(e) || (area && Boolean(e.cell)))
      )
        buf.push(e)
    }
    return buf
  }

  /** 시전자마다 주기가 된 마법을 쏜다. 노릴 적이 없거나 풀이 다 날고 있으면 잠시 뒤 다시 본다. */
  private castMagic() {
    // 자동 전투 (501번): 고양이는 제 고유 스킬만 쓰고 사장냥은 쓰지 않는다.
    const own = this.loadout.mateMagic
    for (const caster of this.casters) {
      if (caster.mate !== undefined && this.mates[caster.mate].drop !== 0) continue
      if (own && caster.mate === undefined) continue
      for (const m of MAGICS) {
        if (own && caster.mate !== undefined && own[caster.mate] !== m) continue
        // 자동 전투의 스킬 레벨은 고양이마다 다르다 (515번): 같은 스킬의 두 마리도 저마다 제 레벨로 쓴다.
        const level =
          (own && caster.mate !== undefined ? this.loadout.mateMagicLevels?.[caster.mate] : null) ??
          this.loadout[m]
        if (!caster.clock.due(m, level, this.elapsed)) continue
        const from = caster.at()
        const cast =
          m === 'water'
            ? this.castWater(from, level)
            : m === 'meteor'
              ? this.castMeteor(from, level)
              : m === 'earth'
                ? this.castEarth(from, level)
                : this.castLightning(from, level)
        if (cast) {
          caster.clock.cast(m, level, this.elapsed)
          this.damageStats.casts[m]++
          if (caster.mate !== undefined) this.damageStats.mateCasts[caster.mate]++
        } else {
          caster.clock.retry(m, this.elapsed)
        }
      }
    }
  }

  private updateMagic(dt: number) {
    for (const s of this.waters) if (s.active) this.moveWater(s, dt)
    for (const s of this.meteors) if (s.active) this.moveMeteor(s, dt)
    for (const r of this.rams) if (r.active) this.moveRam(r, dt)
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
    this.playSound('splash')
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
      if (s.hitList.includes(e) || !sweepHits(s, e, UNITS[e.kind].r)) continue
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
    this.idleAreaHit(x, y, st.splash, 'water', st.damage * this.loadout.damage)
    const angle = Math.atan2(s.dy, s.dx)
    for (const e of this.magicTargets(true)) {
      if (this.areaDistance(e, x, y) <= st.splash) this.waterHit(e, st, angle, true)
    }
  }

  private waterHit(e: Enemy, st: WaterStats, angle: number, area = false) {
    this.slow(e, st.slowFactor, st.slowSeconds)
    this.hit(e, st.damage * this.loadout.damage, angle, 'water', area)
  }

  private endWater(s: WaterShot) {
    s.active = false
    s.img.setVisible(false)
  }

  // 메테오: 밀집된 적을 예측 조준하고 경고 원 뒤 운석을 수직 낙하시킨다. 화상·지형 피해는 없다.

  private castMeteor(from: { x: number; y: number }, level: number): boolean {
    const st = meteorStats(level)
    // 시전자별로 같은 밀집도의 적은 가까운 쪽부터 고른다.
    const candidates = [...this.magicTargets()].sort(
      (a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
    )
    const target = densest(candidates, st.radius)
    const free = this.meteors.filter((s) => !s.active)
    if (!target || free.length < st.count) return false
    const v = target.body?.velocity
    for (let i = 0; i < st.count; i++) {
      const s = free[i]
      s.active = true
      s.level = level
      s.delay = i * 0.16
      s.t = -s.delay
      s.tx = Phaser.Math.Clamp(
        target.x +
          (v?.x ?? 0) * (st.warning + s.delay) +
          (i ? (i % 2 ? -1 : 1) * st.radius * 0.25 : 0),
        12,
        this.view().w - 12,
      )
      s.ty = Phaser.Math.Clamp(
        target.y + (v?.y ?? 0) * (st.warning + s.delay),
        12,
        this.view().h - 50,
      )
      s.img.setVisible(false).setTint(0xc98b72).setAlpha(1)
      s.warning
        .setPosition(s.tx, s.ty)
        .setTint(0xff8d76)
        .setDisplaySize(st.radius * 2, st.radius)
        .setAlpha(0.6)
        .setVisible(false)
    }
    this.playSound('whoosh')
    return true
  }

  private moveMeteor(s: MeteorShot, dt: number) {
    s.t += dt
    if (s.t < 0) return
    const st = meteorStats(s.level)
    const progress = Math.min(1, s.t / st.warning)
    s.warning.setVisible(true).setAlpha(0.3 + progress * 0.45)
    const drop = Math.max(0, (progress - 0.45) / 0.55)
    const size = (s.level === 1 ? 26 : 40) * this.grow(s.level)
    s.img
      .setVisible(drop > 0)
      .setDisplaySize(size, size)
      .setPosition(s.tx, s.ty - 280 * (1 - drop * drop))
      .setRotation(drop * 1.5)
    if (drop > 0 && !this.reducedMotion) this.fireFx.emitParticleAt(s.img.x, s.img.y - size / 2, 1)
    if (progress < 1) return
    s.active = false
    s.img.setVisible(false)
    s.warning.setVisible(false)
    this.meteorImpact(s)
  }

  private meteorImpact(s: MeteorShot) {
    const { tx: x, ty: y, level } = s
    const st = meteorStats(level)
    this.ring(x, y, 0xff9a78, st.radius, 380)
    if (!this.reducedMotion) this.glow(x, y, 0xffc49a, st.radius, 240, 0.7)
    this.rockFx.explode(this.fx(10 + level * 3), x, y)
    this.dustFx.explode(this.fx(8 + level * 2), x, y)
    this.tweens.killTweensOf(s.crater)
    s.crater
      .setPosition(x, y)
      .setDisplaySize(st.radius * 1.5, st.radius * 0.65)
      .setAlpha(0.5)
      .setVisible(true)
    this.tweens.add({
      targets: s.crater,
      alpha: 0,
      duration: 900,
      onComplete: () => s.crater.setVisible(false),
    })
    this.playSound('boom')
    this.idleAreaHit(x, y, st.radius, 'meteor', st.damage * this.loadout.damage)
    // 범위 안의 뒤쪽 매도벽도 맞는다. 묶인 벽은 운석당 한 번만 맞는다.
    for (const e of [...this.magicTargets(true)]) {
      const distance = this.areaDistance(e, x, y)
      const factor = meteorFalloff(distance, st.radius)
      if (!factor) continue
      e.stunUntil = Math.max(e.stunUntil, this.elapsed + st.stunSeconds)
      this.hit(
        e,
        st.damage * this.loadout.damage * factor,
        Math.atan2(e.y - y, e.x - x),
        'meteor',
        true,
      )
    }
  }

  // 충차는 매도벽만 겨냥한다. 이동 중 일반 적과 보스는 통과한다.
  private isSiege = (e: Enemy) => Boolean(e.cell)

  private castEarth(from: { x: number; y: number }, level: number): boolean {
    const st = earthStats(level)
    const target = siegeTarget(this.magicTargets(), from, this.isSiege)
    const s = this.rams.find((r) => !r.active)
    if (!target || !s) return false
    const tier = magicTier(level)
    // 충차는 시전자 바로 위의 매도벽을 향해 곧게 달린다. 출발점은 벽 끝을 넘지 않게 한다.
    let sx = target.x
    if (target.cell) {
      const half = Math.max(0, target.displayWidth / 2 - 14)
      sx = Phaser.Math.Clamp(from.x, target.x - half, target.x + half)
    }
    // 크게 (사용자): 길이 약 130px(돌 충차) → 160 → 200px(대지 충차), 4·5레벨은 더. 화면 아래 끝에서 밀고 올라온다.
    const k = [1.5, 1.85, 2.25][tier - 1] * this.grow(level)
    const { w, h } = this.view()
    const side = 24 * k
    sx = Phaser.Math.Clamp(sx, side, w - side)
    const sy = Math.max(h + 10 * k, target.y + 60)
    const a = -Math.PI / 2
    this.tweens.killTweensOf(s.img)
    s.active = true
    s.level = level
    s.x = sx
    s.y = sy
    s.dx = 0
    s.dy = -1
    // 맞는 폭과 길이는 보이는 크기를 따른다(통나무 앞끝이 닿으면 들이받는다).
    s.half = Math.max(st.half, 20 * k)
    s.depth = 42 * k
    s.t = 0
    s.travelled = 0
    s.nextSpike = SPIKE_GAP
    s.hitList.length = 0
    s.img
      .setPosition(s.x, s.y)
      .setRotation(a)
      .setScale((TEX * k) / RAM_ART)
      .setAlpha(1)
      .setVisible(true)
    this.dustFx.explode(this.fx(6 + tier * 4), sx, Math.min(sy, h - 10))
    this.rockFx.explode(this.fx(2 + tier * 2), sx, Math.min(sy, h - 10))
    this.playSound('rumble')
    return true
  }

  private moveRam(s: RamShot, dt: number) {
    const st = earthStats(s.level)
    const tier = magicTier(s.level)
    s.t += dt
    if (s.t < RAM_WINDUP) {
      // 뒤로 당겼다가(힘 모으기) 박차고 나간다. 당기는 동안은 아무것도 맞히지 않는다.
      const back = Math.sin((s.t / RAM_WINDUP) * Math.PI * 0.5) * 18
      s.img.setPosition(s.x - s.dx * back, s.y - s.dy * back)
      if (dt > 0 && Math.random() < 0.5) this.dustFx.emitParticleAt(s.x, s.y + 20)
      return
    }
    const step = ramSpeed(st.speed, s.t - RAM_WINDUP) * dt
    s.x += s.dx * step
    s.y += s.dy * step
    s.travelled += step
    const { w, h } = this.view()
    const left = RAM_RANGE - s.travelled
    if (left <= 0 || s.y < -80 || s.y > h + 80 || s.x < -80 || s.x > w + 80) {
      s.active = false
      s.img.setVisible(false)
      return
    }
    // 달리며 살짝 덜컹거린다.
    const bob = Math.sin(s.t * 40) * 1.5
    s.img.setPosition(s.x - s.dy * bob, s.y + s.dx * bob).setAlpha(Math.min(1, left / 120))
    if (dt > 0) {
      // 꼬리 흙먼지: 단계가 높을수록 짙고, 대지 충차는 지나간 길에 돌기둥이 솟는다.
      const bx = s.x - s.dx * s.depth
      const by = s.y - s.dy * s.depth
      if (tier === 1) {
        if (Math.random() < 0.5) this.dustFx.emitParticleAt(bx, by)
      } else {
        this.dustFx.emitParticleAt(bx, by, tier)
        if (Math.random() < 0.25 * tier) this.rockFx.emitParticleAt(bx, by)
      }
      if (tier === 3) {
        while (s.travelled >= s.nextSpike) {
          const back = s.travelled - s.nextSpike + s.depth
          this.spike(s.x - s.dx * back, s.y - s.dy * back + 14, 0.75 * this.grow(s.level))
          s.nextSpike += SPIKE_GAP
        }
      }
    }
    for (const e of this.magicTargets()) {
      if (!this.isSiege(e)) continue
      // 벽 덩어리는 가로로 길어 원이 아니라 네모로 본다.
      if (
        Math.abs(e.x - s.x) > e.displayWidth / 2 + 6 ||
        Math.abs(e.y - s.y) > e.displayHeight / 2 + s.depth
      )
        continue
      this.ramImpact(s, st, e)
      return
    }
  }

  /** 들이받는다: 매도벽에 피해 × siege, 충차가 튕겨 났다 사라지고 돌 조각과 먼지가 쏟아진다. 대지 충차는 둘레에 충격파와 돌기둥. */
  private ramImpact(s: RamShot, st: EarthStats, e: Enemy) {
    const tier = magicTier(s.level)
    const grow = this.grow(s.level)
    s.active = false
    // 부딪힌 자리: 매도벽의 앞(아래) 끝.
    const x = s.x
    const y = e.cell ? e.y + e.displayHeight / 2 : s.y
    const img = s.img
    this.tweens.killTweensOf(img)
    // 쐐기 끝이 벽에 박힌 자리에 두고, 튕겨 물러나며 사라진다.
    img.setPosition(x - s.dx * (s.depth - 6), y - s.dy * (s.depth - 6))
    this.tweens.add({
      targets: img,
      x: x - s.dx * (s.depth + 30),
      y: y - s.dy * (s.depth + 30),
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => img.setVisible(false),
    })
    this.glow(x, y, 0xffd9a0, [70, 90, 120][tier - 1] * grow, 260, 0.95)
    this.ring(x, y, 0xd8a868, [60, 80, 110][tier - 1] * grow, 340)
    this.rockFx.explode(this.fx([10, 16, 24][tier - 1]), x, y)
    this.dustFx.explode(this.fx([8, 12, 18][tier - 1]), x, y)
    this.chips?.explode(this.fx(4 + tier * 3), x, y - 4)
    this.thump(x, y + 34, [48, 58, 70][tier - 1] * grow)
    this.hitstop(tier === 3 ? 70 : 45)
    this.playSound('ram')
    haptic.medium()
    this.damageStats.rams++
    const angle = Math.atan2(s.dy, s.dx)
    const dmg = st.damage * this.loadout.damage
    this.hit(e, dmg * st.siege, angle, 'siege')
    if (st.quake > 0) {
      // 충격파와 돌기둥은 시각 효과만 낸다. 주변 적에게 피해나 밀림을 주지 않는다.
      this.time.delayedCall(70, () => this.ring(x, y, 0xb88a52, st.quake * 1.15, 360))
      for (let i = 0; i < 3; i++) {
        const a = angle + Math.PI + (i - 1) * 0.9
        this.spike(x + Math.cos(a) * st.quake * 0.5, y + 16 + Math.sin(a) * 10, grow)
      }
    }
  }

  /** 들이받은 자리에 큰 "쿵!": 확 커졌다 줄며 잠깐 머문 뒤 떠오르며 사라진다. */
  private thump(x: number, y: number, size: number) {
    let t = this.thumps[this.thumpIndex++ % 4]
    if (!t) {
      t = this.add
        .text(0, 0, '쿵!', {
          fontFamily: '"Jua", "Gowun Dodum", sans-serif',
          fontSize: '52px',
          color: '#ffd27a',
          stroke: '#5a2a00',
          strokeThickness: 8,
          resolution: DPR,
        })
        .setOrigin(0.5)
        .setDepth(9)
      this.thumps.push(t)
    }
    const k = size / 52
    this.tweens.killTweensOf(t)
    t.setPosition(x, y)
      .setAngle(Phaser.Math.Between(-8, 8))
      .setScale(k * 0.3)
      .setAlpha(1)
      .setVisible(true)
    this.tweens.add({
      targets: t,
      scale: k * 1.25,
      duration: 90,
      ease: 'Quad.easeOut',
      onComplete: () =>
        this.tweens.add({
          targets: t,
          scale: k,
          duration: 110,
          ease: 'Back.easeOut',
          onComplete: () =>
            this.tweens.add({
              targets: t,
              y: y - 30,
              alpha: 0,
              delay: 260,
              duration: 300,
              onComplete: () => t.setVisible(false),
            }),
        }),
    })
  }

  /** 땅에서 돌기둥 하나가 솟았다 가라앉는다. */
  private spike(x: number, y: number, k: number) {
    const img = this.spikes[this.spikeIndex++ % this.spikes.length]
    this.tweens.killTweensOf(img)
    img
      .setPosition(x, y)
      .setScale(TEX * k, 0)
      .setAlpha(1)
      .setVisible(true)
    this.tweens.add({
      targets: img,
      scaleY: TEX * k,
      duration: 110,
      ease: 'Back.easeOut',
      onComplete: () =>
        this.tweens.add({
          targets: img,
          scaleY: 0,
          alpha: 0,
          delay: 260,
          duration: 300,
          onComplete: () => img.setVisible(false),
        }),
    })
  }

  // 번개: 몬스터마다 같은 크기로 표시한다. 몬스터가 없으면 매도벽을 노린다.

  private castLightning(from: { x: number; y: number }, level: number): boolean {
    const st = lightningStats(level)
    const plans = lightningPlan(this.magicTargets(), from, st, (e) => Boolean(e.cell))
    if (plans.length === 0) return false
    for (const { target, chain } of plans) this.strike(target, chain, st, from)
    this.playSound('zap')
    return true
  }

  private strike(
    target: Enemy,
    chain: Enemy[],
    st: LightningStats,
    from: { x: number; y: number },
  ) {
    const width = 4
    const g = this.bolts[this.boltIndex++ % this.bolts.length]
    this.tweens.killTweensOf(g)
    g.clear().setAlpha(1).setVisible(true)
    // 시전한 고양이에서 첫 대상까지 가는 가는 줄기: 본 낙뢰보다 훨씬 가늘게, 곁가지 없이. 어디서 쏜 번개인지 보이게만 한다.
    this.drawBolt(g, from.x, from.y, target.x, target.y - 28, 1.8, 0)
    this.drawBolt(g, target.x, target.y - 28, target.x, target.y, width, 0)
    let prev = target
    for (const o of chain) {
      this.drawBolt(g, o.x, o.y - 28, o.x, o.y, width, 0)
      this.drawLightningImpact(g, o.x, o.y, 11)
      prev = o
    }
    this.drawLightningImpact(g, target.x, target.y, 19)
    this.glow(target.x, target.y, 0xfff27a, 42, 360)
    this.ring(target.x, target.y, 0xffe94d, 34, 360)
    this.boltFx.explode(this.fx(10), target.x, target.y)
    // 경로를 잠시 선명하게 유지한 뒤 한 번만 사라진다. 빠른 점멸 없이 타격과 연쇄를 읽을 수 있다.
    this.tweens.add({
      targets: g,
      alpha: 0,
      delay: 150,
      duration: this.reducedMotion ? 180 : 260,
      ease: 'Quad.easeIn',
      onComplete: () => g.setVisible(false),
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

  /** 밝은 바닥에서도 맞은 자리를 알아볼 수 있는 보라색 테두리와 노란 방전 고리. */
  private drawLightningImpact(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
  ) {
    g.lineStyle(6, 0x493078, 0.85)
    g.strokeCircle(x, y, radius)
    g.lineStyle(3, 0xffed82, 1)
    g.strokeCircle(x, y, radius)
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)
      g.lineBetween(
        x + dx * (radius + 4),
        y + dy * (radius + 4),
        x + dx * (radius + 12),
        y + dy * (radius + 12),
      )
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
    const jag = Math.min(22, len * 0.12)
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
    stroke(width * 4, 0x7760e0, 0.2)
    stroke(width * 2, 0x493078, 0.85)
    stroke(width * 1.25, 0xffd23f, 1)
    stroke(Math.max(2, width * 0.5), 0xffffff, 1)
    // 짧은 방전 가지: 본줄기보다 가늘게, 흰 심을 가리지 않게 밖으로 뻗는다.
    g.lineStyle(Math.max(0.7, width * 0.2), 0xd9cfff, 0.8)
    for (let i = 2; i < n; i += 3) {
      const side = i % 2 ? 1 : -1
      const reach = Math.min(18, len * 0.1)
      g.beginPath()
      g.moveTo(xs[i], ys[i])
      g.lineTo(xs[i] + nx * reach * side, ys[i] + ny * reach * side)
      g.lineTo(
        xs[i] + nx * reach * side * 1.5 + (x2 - x1) * 0.025,
        ys[i] + ny * reach * side * 1.5 + (y2 - y1) * 0.025,
      )
      g.strokePath()
    }
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
  private reportIdleHit(wall: number, kind: DamageKind, damage: number) {
    if (!Number.isFinite(damage) || damage <= 0) return
    const code: IdleAttackKind =
      this.reportAs ??
      (kind === 'water' || kind === 'meteor'
        ? kind
        : kind === 'lightning' || kind === 'chain'
          ? 'bolt'
          : kind === 'earth' || kind === 'siege'
            ? 'ram'
            : 'bullet')
    this.opts.onIdleHit?.(wall, code, damage)
  }

  private idleAreaHit(x: number, y: number, radius: number, kind: DamageKind, damage: number) {
    if (!this.opts.idle || this.idleTransition || this.circuit) return
    for (const { wall, distance } of this.idleQueue?.hitWalls(x, y, radius) ?? []) {
      const factor = kind === 'meteor' ? meteorFalloff(distance, radius) : 1
      this.reportIdleHit(wall, kind, damage * factor)
    }
  }

  private areaDistance(e: Enemy, x: number, y: number) {
    if (e.cell) {
      return Math.hypot(
        Math.max(0, Math.abs(e.x - x) - e.displayWidth / 2),
        Math.max(0, Math.abs(e.y - y) - e.displayHeight / 2),
      )
    }
    return Math.max(0, Math.hypot(e.x - x, e.y - y) - UNITS[e.kind].r)
  }

  private splash(x: number, y: number, radius: number, dmg: number, except: Enemy) {
    this.idleAreaHit(x, y, radius, 'bullet', dmg)
    for (const child of this.enemies.getChildren()) {
      const e = child as Enemy
      if (e === except || !e.active || e.dying) {
        continue
      }
      if (this.areaDistance(e, x, y) <= radius) {
        this.hit(e, dmg, Math.atan2(e.y - y, e.x - x), 'bullet', true)
      }
    }
  }

  /** 명중 폭발: 재사용 풀로 섬광과 충격파를 함께 펼친다. */
  private impact(x: number, y: number, power: number, grade: Weapon['grade']) {
    const effect = this.impacts[this.impactIndex++ % this.impacts.length]
    this.tweens.killTweensOf(effect)
    // 명중 모양도 그 탄의 등급 것이다 (512번).
    effect.setTexture(`impact-${grade}`)
    const size = TEX * (0.45 + Math.min(power, 5) * 0.1)
    effect
      .setPosition(x, y)
      .setScale(size * 0.3)
      .setAlpha(1)
      .setRotation(Math.random() * Math.PI)
      .setVisible(true)
    this.hitSpark.explode(this.fx(3 + Math.min(power, 5)), x, y)
    this.tweens.add({
      targets: effect,
      scale: size,
      alpha: 0,
      duration: 160,
      ease: 'Cubic.easeOut',
      onComplete: () => effect.setVisible(false),
    })
  }

  private finish(win: boolean, reason: Outcome['reason'], delayMs?: number) {
    if (this.opts.idle) return
    if (this.over) {
      return
    }
    this.over = true
    this.physics.pause()
    if (!win) {
    }
    this.pushHud(true)
    const wallsTotal = this.assault?.walls.length ?? 0
    this.time.delayedCall(delayMs ?? (win ? 300 : 700), () =>
      this.opts.onDone({
        kills: this.kills,
        mentalLeft: Math.ceil(this.mental),
        maxMental: this.loadout.maxMental,
        win,
        reason,
        segments: this.mode === 'advance' ? this.segment : this.assault ? this.wallsBroken : 0,
        seconds: Math.round(Math.min(this.limitSeconds(), this.elapsed) * 10) / 10,
        wallsBroken: this.assault ? this.wallsBroken : 0,
        wallsTotal,
        priceStart: this.assault?.startPrice ?? 0,
        priceEnd: this.assault ? (win ? this.assaultNow() : this.assault.startPrice) : 0,
        stars:
          this.mode === 'assault'
            ? assaultStars(win, this.wallsBroken)
            : this.mode === 'advance'
              ? stars(
                  {
                    win,
                    seconds: this.elapsed,
                    mentalLeft: this.mental,
                    maxMental: this.loadout.maxMental,
                  },
                  this.limitSeconds(),
                )
              : this.opts.stage
                ? defenseStars(win, this.mental, this.loadout.maxMental)
                : 0,
      }),
    )
  }

  /** 이 판의 제한 시간(초): 공격 판은 3분(#593), 나머지는 BATTLE_SECONDS. */
  private limitSeconds() {
    return this.assault ? ASSAULT_SECONDS : BATTLE_SECONDS
  }

  /** 전투 추가 수익 눈금은 부순 매도벽에만 비례한다. */
  private assaultNow() {
    return this.assault ? assaultPrice(this.assault, this.wallsBroken) : 0
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
      secondsLeft: Math.max(0, Math.ceil(this.limitSeconds() - this.elapsed)),
      kills: this.kills,
      score: this.score,
      level: this.level,
      xp: Math.min(1, this.xp / xpToNext(this.level)),
      segment:
        this.mode === 'advance'
          ? { at: Math.min(this.spec.segments, this.segment + 1), total: this.spec.segments }
          : this.assault
            ? {
                at: Math.min(this.assault.walls.length, this.wallsBroken + 1),
                total: this.assault.walls.length,
              }
            : null,
      boss: this.bossEnemy
        ? {
            name: this.assault ? (this.bossMid ? MID_BOSS_NAME : ASSAULT_BOSS.name) : BOSS.name,
            hp: Math.max(0, this.bossEnemy.hp) / this.bossMax,
          }
        : null,
      assault: this.assault
        ? {
            name: this.assault.name,
            price: this.assaultNow(),
            start: this.assault.startPrice,
            target: assaultTarget(this.assault),
            wallsBroken: this.wallsBroken,
            wallsTotal: this.assault.walls.length,
            stuck: Boolean(this.walls.find((wl) => !wl.broken)?.arrived),
          }
        : null,
    })
  }

  /** 큰손 체력 막대를 보스 발밑에 그린다 (457번). 보스가 없거나 공격 판이 아니면 지운다. */
  private drawBossBar() {
    const g = this.bossBar
    if (!g) return
    g.clear()
    const boss = this.bossEnemy
    if (!this.assault || !boss?.active || boss.dying) return
    const w = Phaser.Math.Clamp(boss.displayWidth * 0.9, 70, 150)
    const h = 8
    const x = boss.x - w / 2
    const y = boss.y + boss.displayHeight / 2 + 4
    const ratio = Phaser.Math.Clamp(boss.hp / this.bossMax, 0, 1)
    g.fillStyle(0x2b2340, 0.85).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 5)
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(x, y, w, h, 4)
    if (ratio > 0) g.fillStyle(0xff4f6d, 1).fillRoundedRect(x, y, Math.max(h, w * ratio), h, 4)
  }

  /** 함께 싸우는 고양이: 제자리로 미끄러지고, 숨 쉬고, 맡은 적을 겨눠 연사 간격마다 쏜다 (393·409번). */
  private updateMates(time: number, dt: number, targets: ({ x: number; y: number } | null)[]) {
    const y = this.mode === 'defense' ? this.playerY() : this.player.y - this.heroKick * RECOIL.back
    const k = Math.min(1, dt * 8)
    const turn = Math.min(1, dt * 10)
    for (const [i, m] of this.mates.entries()) {
      const b = m.body
      const target = targets[i + 1] ?? null
      if (this.opts.idle)
        b.setTexture(
          this.reducedMotion || !this.idleAdvancing
            ? mateKey(this.mateLook(i))
            : catRunKey(
                mateKey(this.mateLook(i)),
                catRunFrame(time / 1000, i + 1, this.runRush > 0),
              ),
        )
      m.kick = recoilDecay(m.kick, dt)
      b.setPosition(b.x + (this.standX(i + 1) - b.x) * k, y + m.drop + m.kick * RECOIL.back)
      b.setRotation(-m.kick * RECOIL.lean)
      m.magicMark.setPosition(b.x, b.y - 58)
      if (!this.tweens.isTweening(b)) {
        b.setDisplaySize(
          HERO_SIZE.w * (1 + m.kick * RECOIL.wide),
          HERO_SIZE.h * (1 + Math.sin(time / 260 + i * 1.7) * 0.025) * (1 - m.kick * RECOIL.squash),
        )
      }
      if (target) {
        // 공격 판도 맡은 과녁을 겨눈다 (#593). 과녁이 없으면 제 머리 위(벽).
        const want = catAim(mateModel(this.mateLook(i)), b.x, b.y, target)
        m.aim += Phaser.Math.Angle.Wrap(want - m.aim) * turn
        if (m.drop === 0 && !this.disarmed && time - m.lastFire > this.mateInterval(i)) {
          const ms = this.mateInterval(i)
          for (let n = 0; time - m.lastFire > ms && n < 3; n++) {
            this.fire(Math.max(m.lastFire + ms, time - ms), target, m)
          }
        }
      }
    }
  }

  /**
   * 확인 스크립트용 빠르기(개발 서버에서만, 413번 공격 판 강화 단계별 시간 재기): k배로 돌린다. 물리는 같은 고정 걸음을 k번 더 밟고(탄이 칸을 뚫고
   * 지나가지 않게), 트윈·지연 호출·전투 시계도 k배다. 1이면 아무것도 바꾸지 않는다.
   */
  setSimSpeed(k: number) {
    this.devSpeed = Math.max(1, k)
    this.applySpeed()
  }

  /** 플레이어 배속(gameSpeed.ts). 확인 스크립트가 빠르기를 덮어쓴 동안에는 그쪽을 따른다. */
  setGameSpeed(speed: GameSpeed) {
    this.playerScale = simScale(speed)
    this.applySpeed()
  }

  /**
   * 빠르기 k를 전투 시계·트윈·지연 호출·물리에 넣는다. 1보다 빠르면 물리 고정 걸음을 더 자주 밟고(탄이 칸을 뚫지 않게), 느리면 걸음 수는 그대로 두고
   * 한 걸음의 길이를 줄여 30Hz처럼 끊기지 않게 움직인다.
   */
  private applySpeed() {
    const k = this.devSpeed ?? this.playerScale
    this.simSpeed = k
    if (!this.physics?.world) return
    const world = this.physics.world as Phaser.Physics.Arcade.World & { _frameTime: number }
    world.timeScale = 1 / Math.max(k, 1)
    world._frameTime = Math.min(k, 1) / world.fps
    this.tweens.timeScale = k
    this.time.timeScale = k
  }

  update(_realTime: number, realDtMs: number) {
    if (this.over && !this.player) return
    const dtMs = realDtMs * this.simSpeed
    this.pushHud()
    if (this.over || this.stopped || this.choosing || this.paused) {
      return
    }
    this.syncIdleWall()
    const dt = dtMs / 1000
    this.runRush = Math.max(0, this.runRush - dt)
    const circuitDue = this.opts.idle
      ? (this.opts.idle().circuitSeconds ?? 0) > 0 && !this.idleTransition
      : !this.bossEnemy &&
        this.wallsBroken >= (CIRCUIT_BREAKER.afterWalls[this.circuitIndex] ?? Infinity)
    if (
      this.assault &&
      circuitDue &&
      !this.circuit &&
      this.walls.some((wall) => !wall.broken && (this.opts.idle || wall.arrived))
    ) {
      this.circuitIndex++
      this.circuit = new CircuitBreaker(this.mental, this.loadout.maxMental)
      this.circuitWall = this.walls.find((wall) => !wall.broken) ?? null
      if (this.circuitWall) {
        // 다음 벽의 기존 체력은 유지하고, 쌓이는 조각이 보이도록 세 층으로 다시 쌓는다.
        const wall = this.circuitWall
        if (!this.opts.idle) this.restackWall(wall, Math.max(3, wall.spec.rows))
        wall.y = this.stopY()
        this.layoutWall(wall)
        this.placeWall(wall)
        this.marketStats.wallHpBefore = wall.cells.reduce((sum, e) => sum + e.hp, 0)
        wall.band.setAlpha(1)
        for (const e of wall.cells) {
          e.setAlpha(1)
          e.cell?.label.setAlpha(1)
        }
      }
      this.circuitSellQueue.clear()
      this.circuitSellClock = 0
      this.circuitBuyClock = 0
      this.buyWallFx?.beginCircuit()
      this.circuitFx = new CircuitBreakerFx(this)
      if (!this.reducedMotion) this.cameras.main.shake(180, 0.003)
      this.marketStats.circuits++
      this.runRush = 0
      this.physics.pause()
      this.opts.onBanner('서킷브레이커! 거래 정지 · 멘탈 회복', '#8ef3c6')
      sfx.levelUp()
    }
    if (this.circuit) {
      this.circuitStep(this.opts.idle ? (realDtMs / 1000) * 2 : dt)
      return
    }
    this.elapsed += dt
    // 물리가 멈추는 카드 선택·일시정지·서킷브레이커는 탄 수명/연사/재장전에도 포함하지 않는다.
    const time = this.elapsed * 1000
    if (!this.opts.idle && this.elapsed >= this.limitSeconds()) {
      // 디펜스는 버티면 이기고, 전진 모드와 디펜스 보스 스테이지는 시간 안에 못 넘으면(보스를 못 잡으면) 진다 (364·509번).
      if (this.mode === 'advance' || this.mode === 'assault' || this.defenseBoss) {
        if (this.assault) this.opts.onBanner('시간 초과… 매도벽에 막혔다', '#6b7a99')
        this.finish(false, 'time')
      } else {
        this.finish(true, 'clear')
      }
      return
    }

    // 붙박이 (332번): 자리는 고정, 누르고 있는 쪽을 쏜다. 그림(341번)은 맞았으면 울상(총을 놓친다), 누르고 있으면 눈썹 꾹, 아니면 가만히.
    // 승인한 상향 포즈를 유지한다. 탄환은 기존 수동·자동 조준 방향을 따른다.
    const p = this.player
    const ptr = this.input.activePointer
    const { w, h } = this.view()
    p.setVelocity(0, 0)
    this.heroKick = recoilDecay(this.heroKick, dt)
    p.setPosition(this.standX(0), this.playerY() + this.heroKick * RECOIL.back)
    const hurting = time < this.hurtUntil
    p.setTexture(
      hurting
        ? 'hero-hurt'
        : this.idleAdvancing && !this.reducedMotion
          ? catRunKey('hero', catRunFrame(this.elapsed, 0, this.runRush > 0))
          : ptr.isDown || this.assault
            ? 'hero-fire'
            : 'hero-idle',
    )
    p.setDisplaySize(
      HERO_SIZE.w * (1 + this.heroKick * RECOIL.wide),
      HERO_SIZE.h * (1 - this.heroKick * RECOIL.squash),
    ).setRotation(-this.heroKick * RECOIL.lean)
    if (this.wall && this.wallZone) {
      this.wall.setPosition(0, this.wallY() - WALL_H).setDisplaySize(w, WALL_H * 3)
      this.wall.setTexture(this.mental <= this.loadout.maxMental / 2 ? 'wall-cracked' : 'wall')
      this.wall.setAlpha(0.55 + (0.45 * this.mental) / this.loadout.maxMental)
      this.wallZone.setPosition(w / 2, this.wallY()).setSize(w, WALL_H * 2)
      ;(this.wallZone.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject()
    }

    // 사장냥과 함께 싸우는 고양이가 저마다 맡은 적을 제 총으로 쏜다 (393·409번). 과녁 찾기는 적 풀 전체를 도니 누가 쏠 때거나 80ms마다만 새로 찾는다.
    const fireMs = this.attackInterval
    const due =
      time - this.lastFire > fireMs ||
      this.mates.some((m, i) => time - m.lastFire > this.mateInterval(i))
    if (due || time - this.targetAt > 80) {
      this.targets = this.shotTargets()
      this.targetAt = time
    }
    const target = this.targets[0] ?? null
    if (target) {
      const want = catAim('hero', p.x, p.y, target)
      this.aim += Phaser.Math.Angle.Wrap(want - this.aim) * Math.min(1, dt * 14)
    }
    // 프레임이 연사 간격보다 길면(느린 휴대폰) 밀린 만큼 한 프레임에 몇 발 더 쏜다(최대 3, #587): 아니면 연사가 빠른 무기(기관단총)일수록
    // 프레임 수에 묶여 제 연사를 못 냈다.
    for (let n = 0; target && !this.disarmed && time - this.lastFire > fireMs && n < 3; n++) {
      this.fire(Math.max(this.lastFire + fireMs, time - fireMs), target)
    }
    this.updateMates(time, dt, this.targets)
    this.drawBossBar()
    // 마법은 총알과 따로 제 주기에 스스로 나간다 (392번).
    this.castMagic()
    this.updateMagic(dt)

    if (this.assault) {
      this.assaultStep(dt)
    } else if (this.mode === 'advance') {
      this.advanceStep(dt, h)
    } else if (this.defenseBoss) {
      this.defenseBossStep()
    }

    // 생성: 한 판(2분)에 걸쳐 갈수록 빨라진다. 파도는 15초마다 패닉셀 → 투매 → 공매도 순으로 돌고 뒤로 갈수록 커진다 (340·363번).
    const every = Math.max(200, 700 - this.curve() * 2.6) / this.staged(this.countScale)
    if (this.mode === 'defense' && time - this.lastSpawn > every) {
      this.lastSpawn = time
      const r = Math.random()
      this.spawn(r < 0.6 ? 'panic' : r < 0.82 ? 'dump' : r < 0.95 ? 'stop' : 'spec')
    }
    if (this.opts.idle) this.idleRaidStep(dt)
    else if ((this.mode === 'defense' || this.assault) && this.elapsed >= this.nextWave) {
      const kind = waveKind(Math.round(this.nextWave / WAVE_SECONDS) - 1)
      if (kind === 'panic') {
        this.wavePanic()
        this.opts.onBanner('패닉셀 웨이브! 떼가 몰려온다!', '#82bbff')
      } else if (kind === 'dump') {
        this.waveDump()
        this.opts.onBanner('투매 웨이브! 물량이 쏟아진다!', '#c5a1ff')
      } else this.waveShort()
      this.nextWave += WAVE_SECONDS
    }
    if (!this.opts.idle && (this.mode === 'defense' || this.assault)) this.panicRushStep(dt)

    // 적 움직임: 매 프레임 새 객체를 만들지 않는다.
    const list = this.enemies.getChildren()
    for (let i = 0; i < list.length; i++) {
      const e = list[i] as Enemy
      if (!e.active || e.dying) {
        continue
      }
      const v = UNITS[e.kind]
      // 일자로 내려온다 (333번): 옆으로 흔들리거나 돌지 않는다. 목표는 멘탈벽 또는 플레이어의 높이.
      const targetY = this.wallZone ? this.wallY() : p.y
      const d = Math.abs(targetY - e.y) || 1
      // 원거리 공격은 없다 (340번): 손절매도 다른 적처럼 곧장 내려와 부딪힌다.
      // 기관단총·물 마법에 맞으면 잠깐 느리고 파르스름하다 (376·392번). 메테오에 맞으면 잠깐 기절한다.
      const slowed = e.slowUntil > this.elapsed
      const stunned = e.stunUntil > this.elapsed
      e.chilled = slowed
      const tintKind = stunned ? 2 : slowed ? 1 : 0
      if (tintKind !== e.tintKind) {
        e.tintKind = tintKind
        this.paint(e)
      }
      // 매도벽 칸은 움직이지 않는다: 벽과 함께 assaultStep이 옮긴다.
      if (e.cell) continue
      const speed = v.speed * this.staged(this.speedScale)
      const sy = stunned ? 0 : slowed ? speed * e.slowFactor : speed
      if (e.wallPushUntil > this.elapsed) {
        e.setVelocity(0, -600)
        continue
      }
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
          this.kill(e, false)
          continue
        }
      }
      if (e.boss && this.assault) {
        // 큰손 (413번): 대량 매도벽 바로 앞에서 좌우로 천천히 오간다. 벽을 가리고 서서, 비키는 틈에 벽을 쏜다.
        const wall = this.walls.find((wl) => (this.bossMid ? wl.spec.mid : wl.spec.boss))
        const lane = this.lane()
        const tx = lane.left + lane.width / 2 + Math.sin(this.elapsed * 0.55) * lane.width * 0.36
        const ty = (wall?.y ?? this.stopY()) + 58
        e.kbx = 0
        e.kby = 0
        e.setVelocity((tx - e.x) * 2, (ty - e.y) * 3)
      } else if (e.boss) {
        // 보스: 화면 위쪽(높이의 18%)까지 내려와 좌우로 오간다. 밀리지 않고 벽까지 내려오지 않는다.
        const tx = w / 2 + Math.sin(this.elapsed * 0.8) * w * 0.28
        e.kbx = 0
        e.kby = 0
        e.setVelocity((tx - e.x) * 2, (h * 0.18 - e.y) * 2)
      } else if (this.assault) {
        if (this.buyWall?.active && e.y >= this.buyWallY() - 15) {
          this.hitBuyWall(this.sellAttack(e), e.x)
          if (e.wallPushUntil <= this.elapsed) this.kill(e, false)
          continue
        }
        // 매도 물량 (413번): 벽 앞에서 일직선으로 곧게 내려온다. 사장냥 쪽으로 꺾이거나 흔들리지 않는다. 오르는 만큼 함께 내려간다.
        if (e.y > h + 40) {
          e.disableBody(true, true)
          continue
        }
        e.setVelocity(e.kbx, sy + e.kby + this.climbV)
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
      // 매도 물량은 걷지 않고 종이가 들썩인다(art.ts bakeOrders): 고르게 돈다.
      const frame = isOrder(e.kind)
        ? this.reducedMotion
          ? 0
          : Math.floor((this.elapsed - e.born) * 9 + e.walkOffset) % WALK_FRAMES
        : walkFrame(e.kind, this.elapsed - e.born, e.walkOffset, this.reducedMotion)
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
      // 사거리 (#587): 기관단총·산탄총은 정해진 거리만큼 날아가면 사라진다.
      if (time > b.life || (b.x - b.fromX) ** 2 + (b.y - b.fromY) ** 2 > b.range * b.range) {
        b.disableBody(true, true)
        continue
      }
      const look = (Math.floor(time / 70) % 2) as 0 | 1
      if (look !== b.look) {
        b.look = look
        b.setTexture(`bullet-${b.grade}-${look}`)
      }
      if (!this.reducedMotion && time - (b.trailAt ?? 0) >= b.trailMs) {
        b.trailAt = time
        // 꼬리는 그 탄의 등급 빛깔이다 (512번): 고양이마다 든 무기가 달라 사장냥 빛깔 하나로 칠하지 않는다.
        const tint = gradeTint(b.grade)
        this.trail.setParticleTint(tint)
        this.trail.emitParticleAt(b.x, b.y)
        if (sparkles(b.grade)) {
          this.twinkle.setParticleTint(Math.random() < 0.5 ? 0xffffff : tint)
          this.twinkle.emitParticleAt(b.x, b.y)
        }
      }
    }
  }
}

/** 한 판을 parent 안에 띄운다. 손잡이로 카드를 쌓고(레벨 업) 끝낸다(창이 닫힐 때). */
export function startBattle(parent: HTMLElement, opts: BattleOptions): BattleHandle {
  const scene = new BattleScene(opts)
  scene.setGameSpeed(opts.speed ?? 1)
  // 선명하게(344번): RESIZE 모드는 zoom을 무시해 폰에서 캔버스가 CSS px 크기로 흐렸다. 캔버스를 배율만큼 크게 잡고 zoom으로 CSS 크기에 맞춘다.
  // 부모 크기가 바뀌면 직접 다시 잡는다.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#ffe3a4',
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
      __mentalAutopilot?: (on: boolean) => void
      __mentalSpeed?: (k: number) => void
      __mentalWalls?: () => ReturnType<BattleScene['inspectWalls']>
      __mentalBuyWallHit?: (damage: number) => void
      __mentalMarket?: () => ReturnType<BattleScene['inspectMarket']>
    }
    dev.__mentalDamage = scene.damageStats
    // 공격 판(413번)을 자동으로 돌려 강화 단계별로 걸린 시간을 재는 데 쓴다.
    dev.__mentalAutopilot = (on) => {
      scene.autopilot = on
    }
    dev.__mentalSpeed = (k) => scene.setSimSpeed(k)
    dev.__mentalWalls = () => scene.inspectWalls()
    dev.__mentalMarket = () => scene.inspectMarket()
    dev.__mentalBuyWallHit = (damage) => scene.hitBuyWall(damage, parent.clientWidth / 2)
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
    setSpeed: (speed) => scene.setGameSpeed(speed),
    idleHitsSent: (sequence) => scene.idleHitsSent(sequence),
    clearIdleHits: () => scene.clearIdleHits(),
    callIdleRaid: (kind) => scene.callIdleRaid(kind),
    castActive: (code) => scene.castActive(code),
    stop: () => {
      ro.disconnect()
      game.destroy(true)
    },
  }
}
