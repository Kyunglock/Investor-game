/**
 * 효과음 (decisions.md 310번). 소리 파일 없이 Web Audio로 만든다: 톡(버튼), 코인(뽑기·이득), 금고(결산 이득), 쿵(손실·폭락), 팡파르(이사·업적), 휙(장면).
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

/** 첫 터치에서 오디오를 깨운다. */
export function armAudio() {
  const wake = () => {
    ctx()
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
  if (!c || muted) {
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
  if (!c || muted) {
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
    const high = ['B', 'A', 'S'].includes(grade)
    const notes = grade === 'S' ? [392, 494, 587, 784, 988] : high ? [440, 554, 659] : [520, 660]
    notes.forEach((hz, i) => {
      tone(hz, grade === 'S' ? 500 : 220, {
        wave: 'triangle',
        gain: high ? 0.07 : 0.04,
        at: i * 0.065,
      })
    })
  },
  /** 버튼 톡 */
  tap: () => tone(880, 50, { wave: 'triangle', gain: 0.06 }),
  /** 장면 넘김 휙 */
  whoosh: () => tone(300, 140, { wave: 'sine', gain: 0.05, slide: 900 }),
  /** 코인: 뽑기·작은 이득 */
  coin: () => {
    tone(1318, 90, { wave: 'square', gain: 0.05 })
    tone(1760, 160, { wave: 'square', gain: 0.05, at: 0.08 })
  },
  /** 금고: 결산 이득 */
  cash: () => {
    tone(523, 80, { wave: 'triangle', gain: 0.08 })
    tone(659, 80, { wave: 'triangle', gain: 0.08, at: 0.09 })
    tone(784, 80, { wave: 'triangle', gain: 0.08, at: 0.18 })
    tone(1046, 220, { wave: 'triangle', gain: 0.1, at: 0.27 })
  },
  /** 쿵: 손실·폭락 */
  thud: () => {
    tone(120, 260, { wave: 'sawtooth', gain: 0.14, slide: 40 })
    noise(220, 0.1)
  },
  /** 도장 쾅 */
  stamp: () => {
    tone(200, 90, { wave: 'square', gain: 0.1, slide: 80 })
    noise(90, 0.12)
  },
  /** 강화 한 단계 (394번): 짧은 톡. 꾹 눌러 빨라질수록(combo) 음이 높아진다. */
  upgrade: (combo = 0) =>
    tone(660 * 2 ** (Math.min(combo, 18) / 12), 45, { wave: 'triangle', gain: 0.05 }),
  /** 오름: 부드러운 두 음 */
  levelUp: () => {
    tone(784, 160, { wave: 'sine', gain: 0.06 })
    tone(1175, 320, { wave: 'sine', gain: 0.06, at: 0.11 })
  },
  /** 멘탈 전투 (decisions.md 328번): 쏘기. 무기마다 다른 총소리 (#563). */
  shot: (kind: 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle' = 'pistol') => {
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
  hit: () => tone(2400, 25, { wave: 'square', gain: 0.02, slide: 1600 }),
  /** 멘탈 전투 마법 (392번): 물을 쏜다 */
  splash: () => {
    tone(620, 120, { wave: 'sine', gain: 0.05, slide: 260 })
    noise(80, 0.03)
  },
  /** 멘탈 전투 마법: 불덩이가 터진다 */
  boom: () => {
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
    tone(80, 300, { wave: 'sine', gain: 0.2, slide: 34 })
    tone(240, 90, { wave: 'square', gain: 0.06, slide: 120 })
    noise(200, 0.12)
  },
  /** 멘탈 전투 (393번): 함께 싸우는 고양이가 내려앉아 합류한다. 쿵 + 반가운 두 음. */
  mateJoin: () => {
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
    tone(420, 70, { wave: 'triangle', gain: 0.06, slide: 140 })
    noise(60, 0.05)
  },
  /** 멘탈 전투: 내가 맞았다 */
  ouch: () => {
    tone(260, 160, { wave: 'sawtooth', gain: 0.1, slide: 90 })
    noise(120, 0.08)
  },
  /** 건물 확장 (399번): 힘 모으기. 낮은 음이 끌어올려진다. */
  charge: () => tone(180, 380, { wave: 'triangle', gain: 0.06, slide: 620 }),
  /** 건물 확장: 옆 건물과 부딪히는 쾅. 낮게 울리는 북 + 짧은 금속음 + 큰 잡음. */
  crash: () => {
    tone(95, 480, { wave: 'sine', gain: 0.25, slide: 32 })
    tone(190, 140, { wave: 'square', gain: 0.1, slide: 60 })
    tone(1400, 90, { wave: 'square', gain: 0.03, slide: 500 })
    noise(420, 0.22)
  },
  /** 건물 확장: 밀려난 건물이 무너지는 와르르. 잘게 부서지는 소리를 겹친다. */
  crumble: () => {
    for (let i = 0; i < 7; i++) {
      noise(110, 0.09 - i * 0.008, i * 0.065)
      tone(260 - i * 22, 70, { wave: 'triangle', gain: 0.04, at: i * 0.065, slide: 90 })
    }
  },
  /** 건물 확장: 커진 건물 축하. 올라가는 아르페지오 끝에 화음과 반짝임. */
  celebrate: () => {
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
