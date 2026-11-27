import beltHandle1Url from './sounds/beltHandle1.ogg'
import bookCloseUrl from './sounds/bookClose.ogg'
import bookFlip1Url from './sounds/bookFlip1.ogg'
import bookFlip2Url from './sounds/bookFlip2.ogg'
import bookPlace1Url from './sounds/bookPlace1.ogg'
import musicUrl from './sounds/chill-jazz.mp3'
import chopUrl from './sounds/chop.ogg'
import cloth1Url from './sounds/cloth1.ogg'
import drawKnife1Url from './sounds/drawKnife1.ogg'
import dropLeatherUrl from './sounds/dropLeather.ogg'
import handleCoins2Url from './sounds/handleCoins2.ogg'
import metalClickUrl from './sounds/metalClick.ogg'
import metalLatchUrl from './sounds/metalLatch.ogg'

const KEY = 'investor-app.sound'
const samples = {
  click: metalClickUrl,
  page: bookFlip1Url,
  turn: bookFlip2Url,
  close: bookCloseUrl,
  cloth: cloth1Url,
  coins: handleCoins2Url,
  leather: dropLeatherUrl,
  strike: chopUrl,
  buckle: beltHandle1Url,
  blade: drawKnife1Url,
  latch: metalLatchUrl,
  place: bookPlace1Url,
}
type Sample = keyof typeof samples
const buffers = new Map<Sample, AudioBuffer>()
const lastPlayed = new Map<Sample, number>()
let context: AudioContext | null = null
let effects: GainNode | null = null
let music: HTMLAudioElement | null = null
let armed = false
let nativeActive = true
let hushed = false
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
})()

function audible() {
  return armed && !muted && !hushed && nativeActive && !document.hidden
}

function syncAudio() {
  const on = audible()
  if (context && effects) effects.gain.value = on ? 1 : 0
  if (!on) {
    music?.pause()
    return
  }
  if (!music) {
    music = new Audio(musicUrl)
    music.loop = true
  }
  if (music.paused) void music.play().catch(() => {})
  if (!context && typeof AudioContext !== 'undefined') {
    context = new AudioContext()
    effects = context.createGain()
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -12
    effects.connect(limiter).connect(context.destination)
    loadSamples(context)
  }
  if (context?.state === 'suspended') void context.resume().catch(() => {})
}

export function isMuted() {
  return muted
}

export function setMuted(off: boolean) {
  muted = off
  syncAudio()
  try {
    localStorage.setItem(KEY, off ? 'off' : 'on')
  } catch {
    // 저장할 수 없는 환경에서는 이번 실행에만 적용한다.
  }
}

export function setHushed(on: boolean) {
  hushed = on
  syncAudio()
}

function loadSamples(c: AudioContext) {
  for (const [key, url] of Object.entries(samples)) {
    void fetch(url)
      .then(async (response) => {
        if (response.ok)
          buffers.set(key as Sample, await c.decodeAudioData(await response.arrayBuffer()))
      })
      .catch(() => {})
  }
}

export function armAudio() {
  function wake() {
    armed = true
    if (!music || music.paused || context?.state !== 'running') syncAudio()
  }
  function activity(event: Event) {
    nativeActive = (event as CustomEvent<boolean>).detail
    syncAudio()
  }
  window.addEventListener('pointerdown', wake)
  window.addEventListener('keydown', wake)
  document.addEventListener('visibilitychange', syncAudio)
  window.addEventListener('idle-app-active', activity)
  return () => {
    window.removeEventListener('pointerdown', wake)
    window.removeEventListener('keydown', wake)
    document.removeEventListener('visibilitychange', syncAudio)
    window.removeEventListener('idle-app-active', activity)
    armed = false
    syncAudio()
  }
}

export function soundStatus() {
  return {
    loaded: buffers.size,
    total: Object.keys(samples).length,
    musicPlaying: Boolean(music && !music.paused && music.currentTime > 0),
    musicTime: music?.currentTime ?? 0,
  }
}

function play(name: Sample, gain: number, every = 100, rate = 1) {
  const buffer = buffers.get(name)
  if (!context || !effects || !buffer || !audible() || context.state !== 'running') return
  const now = context.currentTime
  if (now - (lastPlayed.get(name) ?? -1) < every / 1000) return
  lastPlayed.set(name, now)
  const source = context.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate
  const volume = context.createGain()
  volume.gain.value = gain
  source.connect(volume).connect(effects)
  source.start()
}

export const sfx = {
  tap: () => play('buckle', 0.24, 85),
  whoosh: () => play('cloth', 0.26),
  coin: () => play('coins', 0.22, 240),
  cash: () => play('coins', 0.38, 300),
  thud: () => play('leather', 0.4),
  stamp: () => play('place', 0.42),
  upgrade: (combo = 0) => play('click', 0.23, 115, 1 + Math.min(combo, 8) * 0.01),
  levelUp: () => play('latch', 0.36, 300),
  shot: (kind: 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle' = 'pistol') => {
    const rate = { pistol: 1.1, revolver: 0.85, smg: 1.22, shotgun: 0.74, rifle: 0.94 }[kind]
    play('strike', 0.16, 140, rate)
  },
  hit: () => play('place', 0.13, 180, 1.08),
  splash: () => play('cloth', 0.23, 200),
  boom: () => play('close', 0.38, 240, 0.8),
  zap: () => play('blade', 0.22, 250, 1.15),
  rumble: () => play('leather', 0.28, 280, 0.75),
  ram: () => play('close', 0.42, 250, 0.84),
  mateJoin: () => play('leather', 0.34, 160),
  cardDeal: () => play('page', 0.36),
  cardTease: (ms = 200) => play('cloth', 0.16, 160, ms > 600 ? 0.85 : 1),
  cardFlip: () => play('turn', 0.28),
  cardRare: () => play('turn', 0.34, 100, 0.94),
  cardEpic: () => {
    play('turn', 0.35)
    play('latch', 0.21)
  },
  cardLegend: () => {
    play('turn', 0.38)
    play('coins', 0.24)
  },
  cardPick: () => play('place', 0.36),
  squish: () => play('leather', 0.19, 210),
  ouch: () => play('close', 0.32, 250),
  auroraRelease: () => play('blade', 0.26, 240, 0.86),
  charge: () => play('cloth', 0.27, 220, 0.8),
  crash: () => play('close', 0.48, 260, 0.7),
  crumble: () => play('leather', 0.38, 220, 0.8),
  celebrate: () => play('coins', 0.37, 400),
  fanfare: () => {
    play('latch', 0.27)
    play('coins', 0.3)
  },
  weaponReveal: (grade: string) => {
    play('blade', 0.26)
    if (['S', 'SS', 'SSS', 'SR', 'UR', 'LR'].includes(grade)) play('coins', 0.26)
  },
}
