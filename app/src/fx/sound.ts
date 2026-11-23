import bigKillUrl from './sounds/big_kill.ogg'
import coinUrl from './sounds/coin.ogg'
import confirmUrl from './sounds/confirm.ogg'
import dashUrl from './sounds/dash.ogg'
import gemUrl from './sounds/gem.ogg'
import hitUrl from './sounds/hit.ogg'
import hurtUrl from './sounds/hurt.ogg'
import impactUrl from './sounds/impact.ogg'
import killUrl from './sounds/kill.ogg'
import landUrl from './sounds/land.ogg'
import levelUpUrl from './sounds/level_up.ogg'
import reviveUrl from './sounds/revive.ogg'
import shootUrl from './sounds/shoot.ogg'
import uiUrl from './sounds/ui.ogg'

/**
 * 효과음 (decisions.md 310번). 자주 나는 소리는 녹음된 효과음 파일을 쓴다 (605번): CC0라 저작권이 없다(sounds/NOTICE.md). 파일이 아직 안 왔거나
 * 브라우저가 풀지 못하면 전처럼 Web Audio로 만든 소리가 난다. 파일이 없는 소리(카드·마법 몇 가지)도 Web Audio로 만든다: 톡(버튼), 코인(뽑기·이득), 금고(결산 이득), 쿵(손실·폭락), 팡파르(이사·업적), 휙(장면).
 * 건물 확장(399번): 힘 모으기, 쾅(부딪힘), 와르르(밀려나는 건물), 축하. 멘탈 카드 펼치기(393번): 깔기·뜸·등급마다 펼침·고르기, 고양이 합류.
 * 처음 손이 닿을 때 오디오를 켠다(브라우저 정책). 끄기는 브라우저에 남는다.
 */
const KEY = 'investor-app.sound'

let context: AudioContext | null = null
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
})()

/** 절전 모드 (607번)에서 잠깐 쉰다: 설정의 소리 값은 그대로다. */
let hushed = false
export function setHushed(on: boolean) {
  hushed = on
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(off: boolean) {
  muted = off
  try {
    localStorage.setItem(KEY, off ? 'off' : 'on')
  } catch {
    // 저장이 안 되면 이번 화면에서만
  }
}

function ctx(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) {
    return null
  }
  if (!context) {
    context = new AudioContext()
  }
  if (context.state === 'suspended') {
    void context.resume()
  }
  return context
}

const SAMPLES = {
  bigKill: bigKillUrl,
  coin: coinUrl,
  confirm: confirmUrl,
  dash: dashUrl,
  gem: gemUrl,
  hit: hitUrl,
  hurt: hurtUrl,
  impact: impactUrl,
  kill: killUrl,
  land: landUrl,
  levelUp: levelUpUrl,
  revive: reviveUrl,
  shoot: shootUrl,
  ui: uiUrl,
} as const
type SampleName = keyof typeof SAMPLES

const buffers = new Map<SampleName, AudioBuffer>()
let loading = false
/** 같은 소리가 한 프레임에 겹쳐 터지지 않게, 소리마다 마지막으로 낸 때를 적는다. */
const lastPlayed = new Map<SampleName, number>()

/** 효과음 파일을 받아 풀어 둔다. 실패한 파일은 Web Audio로 만든 소리가 대신한다. */
function loadSamples(c: AudioContext) {
  if (loading || typeof fetch === 'undefined') return
  loading = true
  for (const [name, url] of Object.entries(SAMPLES) as [SampleName, string][]) {
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => c.decodeAudioData(data))
      .then((buffer) => buffers.set(name, buffer))
      .catch(() => {
        // Ogg를 풀지 못하는 브라우저: 만든 소리를 쓴다.
      })
  }
}

/**
 * 효과음 파일을 낸다. 냈으면(또는 방금 낸 같은 소리라 건너뛰었으면) true, 파일이 없으면 false라 부른 쪽이 만든 소리를 낸다.
 * rate는 빠르기이자 높이, every는 같은 소리 사이의 가장 짧은 간격(ms)이다.
 */
function sample(
  name: SampleName,
  {
    gain = 0.5,
    rate = 1,
    at = 0,
    every = 0,
  }: { gain?: number; rate?: number; at?: number; every?: number } = {},
): boolean {
  const c = ctx()
  if (!c || muted || hushed) return true
  const buffer = buffers.get(name)
  if (!buffer) return false
  const now = c.currentTime
  if (every > 0 && now - (lastPlayed.get(name) ?? -1) < every / 1000) return true
  lastPlayed.set(name, now)
  const src = c.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  const g = c.createGain()
  g.gain.value = gain
  src.connect(g).connect(c.destination)
  src.start(now + at)
  return true
}

/** 풀어 둔 효과음 파일의 수와 전체 수: 확인 스크립트가 본다. */
export function soundStatus() {
  return { loaded: buffers.size, total: Object.keys(SAMPLES).length }
}

/** 첫 터치에서 오디오를 깨우고 효과음 파일을 받는다. */
export function armAudio() {
  const wake = () => {
    const c = ctx()
    if (c) loadSamples(c)
    window.removeEventListener('pointerdown', wake)
  }
  window.addEventListener('pointerdown', wake, { once: true })
}

type Wave = OscillatorType

function tone(
  freq: number,
  ms: number,
  {
    wave = 'sine',
    gain = 0.12,
    at = 0,
    slide,
  }: { wave?: Wave; gain?: number; at?: number; slide?: number } = {},
) {
  const c = ctx()
  if (!c || muted || hushed) {
    return
  }
  const o = c.createOscillator()
  const g = c.createGain()
  const t = c.currentTime + at
  o.type = wave
  o.frequency.setValueAtTime(freq, t)
  if (slide) {
    o.frequency.exponentialRampToValueAtTime(slide, t + ms / 1000)
  }
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + ms / 1000 + 0.02)
}

function noise(ms: number, gain = 0.08, at = 0) {
  const c = ctx()
  if (!c || muted || hushed) {
    return
  }
  const frames = Math.floor((c.sampleRate * ms) / 1000)
  const buffer = c.createBuffer(1, frames, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const g = c.createGain()
  const t = c.currentTime + at
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  src.connect(filter).connect(g).connect(c.destination)
  src.start(t)
}

export const sfx = {
  /** 무기 공개: 등급이 높을수록 화음을 쌓는다. 기존 카드·성장 음색을 따른다. */
  weaponReveal: (grade: string) => {
    const top = ['S', 'SS', 'SSS', 'SR', 'UR', 'LR'].includes(grade)
    const high = top || ['B', 'A'].includes(grade)
    const notes = top ? [392, 494, 587, 784, 988] : high ? [440, 554, 659] : [520, 660]
    notes.forEach((hz, i) => {
      tone(hz, top ? 500 : 220, {
        wave: 'triangle',
        gain: high ? 0.07 : 0.04,
        at: i * 0.065,
      })
    })
  },
  /** 버튼 톡 */
  tap: () =>
    sample('ui', { gain: 0.45, every: 30 }) || tone(880, 50, { wave: 'triangle', gain: 0.06 }),
  /** 장면 넘김 휙 */
  whoosh: () =>
    sample('dash', { gain: 0.3 }) || tone(300, 140, { wave: 'sine', gain: 0.05, slide: 900 }),
  /** 코인: 뽑기·작은 이득 */
  coin: () => {
    if (sample('coin', { gain: 0.5, every: 60 })) return
    tone(1318, 90, { wave: 'square', gain: 0.05 })
    tone(1760, 160, { wave: 'square', gain: 0.05, at: 0.08 })
  },
  /** 금고: 결산 이득 */
  cash: () => {
    if (sample('coin', { gain: 0.55 })) {
      sample('confirm', { gain: 0.3, at: 0.12 })
      return
    }
    tone(523, 80, { wave: 'triangle', gain: 0.08 })
    tone(659, 80, { wave: 'triangle', gain: 0.08, at: 0.09 })
    tone(784, 80, { wave: 'triangle', gain: 0.08, at: 0.18 })
    tone(1046, 220, { wave: 'triangle', gain: 0.1, at: 0.27 })
  },
  /** 쿵: 손실·폭락 */
  thud: () => {
    if (sample('land', { gain: 0.7 })) return
    tone(120, 260, { wave: 'sawtooth', gain: 0.14, slide: 40 })
    noise(220, 0.1)
  },
  /** 도장 쾅 */
  stamp: () => {
    if (sample('impact', { gain: 0.5 })) return
    tone(200, 90, { wave: 'square', gain: 0.1, slide: 80 })
    noise(90, 0.12)
  },
  /** 강화 한 단계 (394번): 짧은 톡. 꾹 눌러 빨라질수록(combo) 음이 높아진다. */
  upgrade: (combo = 0) =>
    sample('confirm', { gain: 0.35, rate: 2 ** (Math.min(combo, 18) / 12), every: 30 }) ||
    tone(660 * 2 ** (Math.min(combo, 18) / 12), 45, { wave: 'triangle', gain: 0.05 }),
  /** 오름: 부드러운 두 음 */
  levelUp: () => {
    if (sample('levelUp', { gain: 0.5, every: 80 })) return
    tone(784, 160, { wave: 'sine', gain: 0.06 })
    tone(1175, 320, { wave: 'sine', gain: 0.06, at: 0.11 })
  },
  /** 멘탈 전투 (decisions.md 328번): 쏘기. 무기마다 다른 총소리 (#563). */
  shot: (kind: 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle' = 'pistol') => {
    // 같은 총소리 파일을 무기마다 다른 높이로 낸다: 리볼버·샷건은 낮고 묵직하게, 기관단총은 높고 짧게. 고양이 여럿이 함께 쏴도 겹쳐 터지지 않는다.
    const rate = { pistol: 1, revolver: 0.78, smg: 1.35, shotgun: 0.62, rifle: 0.9 }[kind]
    const gain = { pistol: 0.22, revolver: 0.3, smg: 0.16, shotgun: 0.34, rifle: 0.26 }[kind]
    if (sample('shoot', { gain, rate: rate * (0.97 + Math.random() * 0.06), every: 45 })) return
    if (kind === 'revolver') {
      tone(420, 120, { wave: 'sawtooth', gain: 0.07, slide: 90 })
      noise(110, 0.09)
    } else if (kind === 'smg') {
      tone(1300, 30, { wave: 'square', gain: 0.035, slide: 600 })
      noise(25, 0.03)
    } else if (kind === 'shotgun') {
      tone(160, 160, { wave: 'sawtooth', gain: 0.08, slide: 50 })
      noise(170, 0.12)
      // 펌프질: 철컥
      tone(1800, 25, { wave: 'square', gain: 0.03, at: 0.2 })
      tone(1200, 30, { wave: 'square', gain: 0.03, at: 0.27 })
    } else if (kind === 'rifle') {
      tone(2200, 70, { wave: 'sawtooth', gain: 0.05, slide: 300 })
      noise(60, 0.06)
    } else {
      tone(900, 60, { wave: 'square', gain: 0.05, slide: 260 })
      noise(40, 0.04)
    }
  },
  /** 멘탈 전투: 탄이 맞았다 */
  hit: () =>
    sample('hit', { gain: 0.16, rate: 0.92 + Math.random() * 0.16, every: 50 }) ||
    tone(2400, 25, { wave: 'square', gain: 0.02, slide: 1600 }),
  /** 멘탈 전투 마법 (392번): 물을 쏜다 */
  splash: () => {
    tone(620, 120, { wave: 'sine', gain: 0.05, slide: 260 })
    noise(80, 0.03)
  },
  /** 멘탈 전투 마법: 불덩이가 터진다 */
  boom: () => {
    if (sample('impact', { gain: 0.45, rate: 0.8, every: 60 })) return
    tone(160, 180, { wave: 'sawtooth', gain: 0.06, slide: 55 })
    noise(160, 0.07)
  },
  /** 멘탈 전투 마법: 번개가 내리꽂힌다 */
  zap: () => {
    tone(1700, 110, { wave: 'sawtooth', gain: 0.04, slide: 140 })
    noise(90, 0.06)
  },
  /** 멘탈 전투 마법 (433번): 바위 충차가 땅을 박차고 돌진한다. 낮게 구르는 소리. */
  rumble: () => {
    tone(70, 260, { wave: 'triangle', gain: 0.08, slide: 110 })
    noise(220, 0.04)
  },
  /** 멘탈 전투 마법: 충차가 매도벽을 들이받는다. 쿵 + 나무 부딪히는 소리. */
  ram: () => {
    if (sample('land', { gain: 0.75, rate: 0.85 })) {
      sample('impact', { gain: 0.4, rate: 0.9 })
      return
    }
    tone(80, 300, { wave: 'sine', gain: 0.2, slide: 34 })
    tone(240, 90, { wave: 'square', gain: 0.06, slide: 120 })
    noise(200, 0.12)
  },
  /** 멘탈 전투 (393번): 함께 싸우는 고양이가 내려앉아 합류한다. 쿵 + 반가운 두 음. */
  mateJoin: () => {
    if (sample('land', { gain: 0.5 })) {
      sample('gem', { gain: 0.45, at: 0.1 })
      return
    }
    tone(150, 140, { wave: 'triangle', gain: 0.1, slide: 70 })
    noise(90, 0.06)
    tone(988, 90, { wave: 'triangle', gain: 0.06, at: 0.1 })
    tone(1319, 160, { wave: 'triangle', gain: 0.06, at: 0.18 })
  },
  /** 멘탈 카드 펼치기 (393번): 뒷면 석 장이 쿵 깔린다. */
  cardDeal: () => {
    for (let i = 0; i < 3; i++) {
      tone(170 - i * 12, 120, { wave: 'triangle', gain: 0.09, at: i * 0.07, slide: 70 })
      noise(70, 0.07, i * 0.07)
    }
  },
  /** 카드 펼치기: 뒤집기 직전 빛이 새어 나온다. 등급이 높을수록 길고 높이 끌어올린다(전설은 한참). */
  cardTease: (ms = 200) =>
    tone(420, ms, { wave: 'sine', gain: 0.04, slide: ms > 600 ? 1500 : 900 }),
  /** 카드 펼치기: 일반은 가볍게 탁. */
  cardFlip: () => {
    tone(1250, 40, { wave: 'triangle', gain: 0.07, slide: 700 })
    noise(35, 0.06)
  },
  /** 카드 펼치기: 희귀는 파란 반짝임. */
  cardRare: () => {
    tone(1250, 40, { wave: 'triangle', gain: 0.06, slide: 700 })
    tone(1568, 120, { wave: 'sine', gain: 0.06, at: 0.03 })
    tone(2093, 180, { wave: 'sine', gain: 0.05, at: 0.1 })
    tone(2637, 220, { wave: 'sine', gain: 0.03, at: 0.18 })
  },
  /** 카드 펼치기: 영웅은 보라 빛기둥이 솟는 화음. */
  cardEpic: () => {
    tone(220, 380, { wave: 'sawtooth', gain: 0.05, slide: 660 })
    noise(160, 0.06)
    for (const n of [659, 831, 988]) tone(n, 420, { wave: 'triangle', gain: 0.05, at: 0.12 })
    tone(1976, 260, { wave: 'sine', gain: 0.04, at: 0.3 })
  },
  /** 카드 펼치기: 전설은 큰 폭발과 금빛 팡파르. */
  cardLegend: () => {
    tone(80, 700, { wave: 'sine', gain: 0.26, slide: 30 })
    tone(160, 220, { wave: 'square', gain: 0.08, slide: 60 })
    noise(520, 0.2)
    const notes = [523, 659, 784, 1046]
    for (const [i, n] of notes.entries()) {
      tone(n, 140, { wave: 'triangle', gain: 0.09, at: 0.12 + i * 0.07 })
    }
    for (const n of [1046, 1318, 1568, 2093]) {
      tone(n, 900, { wave: 'triangle', gain: 0.06, at: 0.42 })
    }
    tone(3136, 140, { wave: 'sine', gain: 0.04, at: 0.6 })
    tone(2637, 200, { wave: 'sine', gain: 0.04, at: 0.75 })
  },
  /** 카드를 골랐다: 도장 쾅에 금고 소리를 붙여 세게. */
  cardPick: () => {
    tone(180, 120, { wave: 'square', gain: 0.1, slide: 70 })
    noise(110, 0.12)
    tone(784, 80, { wave: 'triangle', gain: 0.08, at: 0.06 })
    tone(1046, 80, { wave: 'triangle', gain: 0.08, at: 0.13 })
    tone(1568, 260, { wave: 'triangle', gain: 0.09, at: 0.2 })
  },
  /** 멘탈 전투: 적이 터진다 */
  squish: () => {
    if (sample('kill', { gain: 0.3, rate: 0.95 + Math.random() * 0.2, every: 50 })) return
    tone(420, 70, { wave: 'triangle', gain: 0.06, slide: 140 })
    noise(60, 0.05)
  },
  /** 멘탈 전투: 내가 맞았다 */
  ouch: () => {
    if (sample('hurt', { gain: 0.45, every: 120 })) return
    tone(260, 160, { wave: 'sawtooth', gain: 0.1, slide: 90 })
    noise(120, 0.08)
  },
  auroraRelease: () => {
    tone(147, 260, { wave: 'sine', gain: 0.12, slide: 65 })
    for (const [i, note] of [587, 880, 1175].entries()) {
      tone(note, 330, { wave: 'sine', gain: 0.035, at: i * 0.045 })
    }
  },
  /** 건물 확장 (399번): 힘 모으기. 낮은 음이 끌어올려진다. */
  charge: () => tone(180, 380, { wave: 'triangle', gain: 0.06, slide: 620 }),
  /** 건물 확장: 옆 건물과 부딪히는 쾅. 낮게 울리는 북 + 짧은 금속음 + 큰 잡음. */
  crash: () => {
    if (sample('bigKill', { gain: 0.7, every: 250 })) {
      sample('impact', { gain: 0.45, rate: 0.75 })
      return
    }
    tone(95, 480, { wave: 'sine', gain: 0.25, slide: 32 })
    tone(190, 140, { wave: 'square', gain: 0.1, slide: 60 })
    tone(1400, 90, { wave: 'square', gain: 0.03, slide: 500 })
    noise(420, 0.22)
  },
  /** 건물 확장: 밀려난 건물이 무너지는 와르르. 잘게 부서지는 소리를 겹친다. */
  crumble: () => {
    if (sample('impact', { gain: 0.5, rate: 0.7, every: 80 })) {
      sample('land', { gain: 0.45, at: 0.08 })
      return
    }
    for (let i = 0; i < 7; i++) {
      noise(110, 0.09 - i * 0.008, i * 0.065)
      tone(260 - i * 22, 70, { wave: 'triangle', gain: 0.04, at: i * 0.065, slide: 90 })
    }
  },
  /** 건물 확장: 커진 건물 축하. 올라가는 아르페지오 끝에 화음과 반짝임. */
  celebrate: () => {
    if (sample('revive', { gain: 0.45 })) {
      sample('levelUp', { gain: 0.4, at: 0.3 })
      return
    }
    const notes = [523, 659, 784, 1046, 1318]
    for (const [i, n] of notes.entries()) {
      tone(n, 120, { wave: 'triangle', gain: 0.08, at: i * 0.07 })
    }
    for (const n of [1046, 1318, 1568]) {
      tone(n, 520, { wave: 'triangle', gain: 0.06, at: 0.38 })
    }
    tone(2093, 90, { wave: 'sine', gain: 0.04, at: 0.5 })
    tone(2637, 140, { wave: 'sine', gain: 0.04, at: 0.62 })
  },
  /** 팡파르: 이사·업적·엔딩 */
  fanfare: () => {
    const notes = [523, 659, 784, 1046, 784, 1046]
    for (const [i, n] of notes.entries()) {
      tone(n, i === notes.length - 1 ? 420 : 130, { wave: 'triangle', gain: 0.09, at: i * 0.12 })
    }
  },
}
