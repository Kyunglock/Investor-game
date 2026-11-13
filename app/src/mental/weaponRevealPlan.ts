import type { Weapon } from './hero'

/** 서버가 확정한 등급만 연출에 쓴다. 낮은 등급은 짧고 S 이상은 어둠 속 긴 뜸 뒤 금빛 공개. */
export function weaponRevealPlan(grade: Weapon['grade']) {
  const plans = {
    F: { charge: 260, power: 0, color: '#cbd5e1' },
    E: { charge: 350, power: 0, color: '#8ee1b2' },
    D: { charge: 650, power: 1, color: '#76ccff' },
    C: { charge: 800, power: 1, color: '#bb9aff' },
    B: { charge: 1100, power: 2, color: '#f596ef' },
    A: { charge: 1400, power: 2, color: '#ffb16e' },
    S: { charge: 2100, power: 3, color: '#ffdd75' },
    SS: { charge: 2200, power: 3, color: '#60a5fa' },
    SSS: { charge: 2300, power: 3, color: '#c084fc' },
    SR: { charge: 2400, power: 3, color: '#fb7185' },
    UR: { charge: 2500, power: 3, color: '#4ade80' },
    LR: { charge: 2600, power: 3, color: '#facc15' },
  }
  return plans[grade]
}
