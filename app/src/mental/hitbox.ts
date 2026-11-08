/**
 * 탄의 충돌 원 (decisions.md 328번). Arcade 몸은 그림과 같이 돌지 않아, 원을 그림 끝(+x)에 두면 위로 쏠 때 판정이 오른쪽으로 비켜 나 빗나간다.
 * 그래서 원은 그림 한가운데에 두고, 반지름은 적(패닉 반지름 10)과 합쳐 한 프레임 이동(12px)보다 넉넉하게 8px로 잡는다.
 * 값은 텍스처 px 단위(구운 배율만큼 큼): 그림 32×10이 k배로 구워졌으면 반지름도 k배.
 */
export const BULLET_W = 32
export const BULLET_H = 10
export const BULLET_R = 8

export function bulletHitbox(texW: number, texH: number) {
  const k = texW / BULLET_W
  const radius = BULLET_R * k
  return { radius, ox: texW / 2 - radius, oy: texH / 2 - radius }
}
