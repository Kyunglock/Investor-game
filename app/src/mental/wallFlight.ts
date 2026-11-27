// 실제 시간 기준 최근 열 개의 돌파만 보관한다. 관통으로 한 프레임에 여러 벽을 넘을 수 있다.
export class WallFlight {
  private breaks: number[] = []
  private wall = 0
  private previousTime = 0
  strength = 0

  update(wall: number, now: number, enabled: boolean) {
    const elapsed = now - this.previousTime
    const delta = wall - this.wall
    if (!enabled || !this.wall || delta < 0 || elapsed > 1000) {
      this.breaks.length = 0
      this.strength = 0
    } else {
      for (let i = 0; i < Math.min(delta, 10); i++) this.breaks.push(now)
      if (this.breaks.length > 10) this.breaks.splice(0, this.breaks.length - 10)
      const flying = this.breaks.length === 10 && now - this.breaks[0] <= 1000
      const target = flying ? 1 : 0
      this.strength += (target - this.strength) * (1 - Math.exp(-elapsed / (flying ? 140 : 280)))
      if (!flying && this.strength < 0.005) this.strength = 0
    }
    this.wall = wall
    this.previousTime = now
  }
}
