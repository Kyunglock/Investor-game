import atlas from './assets/growth-icons.png'

// 하단 메뉴 B안과 같은 외곽선·색감. 글자와 수치는 기존 강화 항목이 제공한다.
const FRAMES = {
  damage: '35 140 445 420',
  fire: '480 140 390 420',
  hp: '885 140 410 420',
  buy: '1310 140 400 420',
  crit: '1710 140 440 420',
}

export function GrowthIcon({ name }: { name: keyof typeof FRAMES }) {
  return (
    <svg className="idle-growth-icon" viewBox={FRAMES[name]} aria-hidden="true" overflow="hidden">
      <image href={atlas} width="2172" height="724" />
    </svg>
  )
}
