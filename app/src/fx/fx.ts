import { create } from 'zustand'

/** 터지는 것: 코인(뽑기·이득), 색종이(이사·업적), 불꽃(결정), 연기(손실). */
export type BurstKind = 'coins' | 'confetti' | 'sparks' | 'smoke'
export interface Burst {
  id: number
  x: number
  y: number
  kind: BurstKind
}
/** 떠오르는 글: 자본 변화 등. */
export interface Float {
  id: number
  x: number
  y: number
  text: string
  tone: 'up' | 'down' | 'gold' | 'plain'
}

interface FxState {
  /** 오를 때마다 화면이 한 번 흔들린다. */
  shake: number
  /** 화면을 한 번 번쩍이는 색. */
  flash: { id: number; color: string } | null
  bursts: Burst[]
  floats: Float[]
  shakeScreen: () => void
  flashScreen: (color: string) => void
  burst: (x: number, y: number, kind: BurstKind) => void
  /** 요소의 가운데에서 터진다. 요소가 없으면 화면 가운데. */
  burstAt: (el: Element | null | undefined, kind: BurstKind) => void
  float: (x: number, y: number, text: string, tone: Float['tone']) => void
  floatAt: (el: Element | null | undefined, text: string, tone: Float['tone']) => void
  consumeBursts: () => Burst[]
  dropFloat: (id: number) => void
}

let seq = 0

function center(el: Element | null | undefined): { x: number; y: number } {
  if (el) {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

/** 임팩트 효과 (decisions.md 310번): 흔들림·번쩍임·터짐·떠오르는 글. FxLayer가 그린다. */
export const useFx = create<FxState>((set, get) => ({
  shake: 0,
  flash: null,
  bursts: [],
  floats: [],
  shakeScreen: () => set((s) => ({ shake: s.shake + 1 })),
  flashScreen: (color) => set({ flash: { id: ++seq, color } }),
  burst: (x, y, kind) => set((s) => ({ bursts: [...s.bursts, { id: ++seq, x, y, kind }] })),
  burstAt: (el, kind) => {
    const { x, y } = center(el)
    get().burst(x, y, kind)
  },
  float: (x, y, text, tone) =>
    set((s) => ({ floats: [...s.floats, { id: ++seq, x, y, text, tone }] })),
  floatAt: (el, text, tone) => {
    const { x, y } = center(el)
    get().float(x, y, text, tone)
  },
  consumeBursts: () => {
    const bursts = get().bursts
    if (bursts.length > 0) {
      set({ bursts: [] })
    }
    return bursts
  },
  dropFloat: (id) => set((s) => ({ floats: s.floats.filter((f) => f.id !== id) })),
}))
