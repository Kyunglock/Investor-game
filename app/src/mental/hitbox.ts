/**
 * 탄의 충돌 원 (decisions.md 328번). Arcade 몸은 그림과 같이 돌지 않아, 원을 그림 끝(+x)에 두면 위로 쏠 때 판정이 오른쪽으로 비켜 나 빗나간다.
 * 그래서 원은 그림 한가운데에 두고, 반지름은 8px에서 12px로 넓혀 가장자리를 스치는 탄도 맞도록 한다.
 * 값은 텍스처 px 단위(구운 배율만큼 큼): 그림 32×10이 k배로 구워졌으면 반지름도 k배.
 */
export const BULLET_W = 32
export const BULLET_H = 10
export const BULLET_R = 12

/** stretch: 탄 그림을 가로로 늘린 배율(무기마다 쏘는 방식, #563). Arcade 원의 반지름은 가로 배율을 따르니 나눠 두어 판정 크기는 그대로다. */
export function bulletHitbox(texW: number, texH: number, stretch = 1) {
  const k = texW / BULLET_W
  const radius = (BULLET_R * k) / stretch
  return { radius, ox: texW / 2 - radius, oy: texH / 2 - radius }
}
