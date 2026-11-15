import { describe, expect, it } from 'vitest'
import { FrameMeter, frameLevel } from './frameMeter'

/** 간격(ms)들을 차례로 흘려 넣고 마지막 시각을 돌려준다. */
function feed(meter: FrameMeter, gaps: number[], start = 0) {
  let now = start
  meter.push(now)
  for (const gap of gaps) {
    now += gap
    meter.push(now)
  }
  return now
}

describe('프레임 측정 (543번)', () => {
  it('60fps로 2초를 그리면 60 FPS이고 끊긴 프레임이 없다', () => {
    const meter = new FrameMeter()
    const now = feed(meter, Array(120).fill(1000 / 60))
    expect(meter.read(now)).toEqual({ fps: 60, worst: 17, slow: 0 })
  })

  it('긴 프레임은 가장 긴 프레임과 끊긴 수에 잡힌다', () => {
    const meter = new FrameMeter()
    const now = feed(meter, [16, 16, 120, 16, 50, 16])
    const stats = meter.read(now)
    expect(stats.worst).toBe(120)
    expect(stats.slow).toBe(2)
    expect(stats.fps).toBe(6)
  })

  it('10초가 지난 끊김은 잊는다', () => {
    const meter = new FrameMeter()
    let now = feed(meter, [200])
    expect(meter.read(now).slow).toBe(1)
    now = feed(meter, Array(700).fill(16), now)
    expect(meter.read(now)).toMatchObject({ worst: 16, slow: 0 })
  })

  it('화면이 가려졌던 긴 간격은 프레임으로 세지 않는다', () => {
    const meter = new FrameMeter()
    const now = feed(meter, [16, 5000, 16])
    expect(meter.read(now)).toMatchObject({ worst: 16, slow: 0 })
  })

  it('색은 55fps부터 좋음, 40fps부터 보통이다', () => {
    expect(frameLevel(60)).toBe('good')
    expect(frameLevel(54)).toBe('fair')
    expect(frameLevel(39)).toBe('bad')
  })
})
