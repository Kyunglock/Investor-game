/**
 * 프레임 측정 (decisions.md 543번): 테스트판에서 화면이 끊기는지 숫자로 본다. 프레임 사이의 간격(ms)을 모아 최근 1초의 FPS와, 최근 10초의
 * 가장 긴 프레임·끊긴 프레임 수를 낸다.
 */

/** 이보다 긴 프레임은 끊긴 것으로 센다: 30fps의 한 프레임(33.3ms)을 넘겼다. */
export const SLOW_FRAME_MS = 34
/** 가장 긴 프레임과 끊긴 프레임 수를 보는 구간. */
export const METER_WINDOW_MS = 10_000
/** 이보다 긴 간격은 프레임이 아니라 화면이 가려졌던 것(다른 앱·다른 탭)이다: 세지 않는다. */
export const PAUSE_MS = 1_000

export interface FrameStats {
  /** 최근 1초에 그린 프레임 수. */
  fps: number
  /** 최근 10초의 가장 긴 프레임(ms). */
  worst: number
  /** 최근 10초의 끊긴 프레임 수. */
  slow: number
}

export class FrameMeter {
  private frames: { at: number; ms: number }[] = []
  private last: number | null = null

  /** 프레임 하나가 그려졌다. now는 requestAnimationFrame이 주는 시각(ms)이다. */
  push(now: number) {
    const last = this.last
    this.last = now
    if (last === null) return
    const ms = now - last
    if (ms <= 0 || ms > PAUSE_MS) return
    this.frames.push({ at: now, ms })
    while (this.frames.length > 0 && this.frames[0].at < now - METER_WINDOW_MS) this.frames.shift()
  }

  read(now: number): FrameStats {
    let fps = 0
    let worst = 0
    let slow = 0
    for (const frame of this.frames) {
      if (frame.at < now - METER_WINDOW_MS) continue
      if (frame.at > now - 1000) fps++
      if (frame.ms > worst) worst = frame.ms
      if (frame.ms > SLOW_FRAME_MS) slow++
    }
    return { fps, worst: Math.round(worst), slow }
  }

  reset() {
    this.frames = []
    this.last = null
  }
}

/** 표시 색: 55fps부터 좋음, 40fps부터 보통, 그 아래는 나쁨. */
export function frameLevel(fps: number): 'good' | 'fair' | 'bad' {
  return fps >= 55 ? 'good' : fps >= 40 ? 'fair' : 'bad'
}

const KEY = 'investor-game.frame-meter'

/** 프레임 표시를 켰나. 테스트판에 들어오면 처음에는 켜져 있다. */
export function readFrameMeter(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveFrameMeter(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // 저장이 막힌 브라우저에서는 이번 화면에서만 따른다.
  }
}
