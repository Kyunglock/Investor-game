/**
 * 효과음 (decisions.md 310번). 소리 파일 없이 Web Audio로 만든다: 톡(버튼), 코인(뽑기·이득), 금고(결산 이득), 쿵(손실·폭락), 팡파르(이사·업적), 휙(장면).
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
  /** 카드를 집어 듦 (합성 끌기) */
  pick: () => tone(520, 70, { wave: 'triangle', gain: 0.05, slide: 780 }),
  /** 재료가 바탕에 겹쳐짐: 올릴수록 높아진다 */
  absorb: (n: number) => {
    const base = 660 * 2 ** (n / 6)
    tone(base, 90, { wave: 'square', gain: 0.05 })
    tone(base * 1.5, 140, { wave: 'triangle', gain: 0.06, at: 0.06 })
  },
  /** 합성 직전 기 모으기: 위로 휘감기는 소리 */
  charge: () => {
    tone(220, 700, { wave: 'sawtooth', gain: 0.05, slide: 1320 })
    tone(330, 700, { wave: 'triangle', gain: 0.05, slide: 1760 })
    noise(600, 0.03)
  },
  /** 합성 성공: 쾅 하고 위로 오르는 팡파르 */
  levelUp: () => {
    tone(160, 200, { wave: 'square', gain: 0.12, slide: 60 })
    noise(160, 0.1)
    const notes = [784, 988, 1175, 1568]
    for (const [i, n] of notes.entries()) {
      tone(n, i === notes.length - 1 ? 520 : 110, {
        wave: 'triangle',
        gain: 0.1,
        at: 0.12 + i * 0.09,
      })
    }
    tone(2093, 400, { wave: 'sine', gain: 0.04, at: 0.5 })
  },
  /** 팡파르: 이사·업적·엔딩 */
  fanfare: () => {
    const notes = [523, 659, 784, 1046, 784, 1046]
    for (const [i, n] of notes.entries()) {
      tone(n, i === notes.length - 1 ? 420 : 130, { wave: 'triangle', gain: 0.09, at: i * 0.12 })
    }
  },
}
