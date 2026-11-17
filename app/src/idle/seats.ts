/**
 * 출전 칸 (decisions.md 599번): 고양이는 놓은 칸에 그대로 서고, 전투에서도 칸 번호순으로 줄을 선다. 서버가 칸 번호(slot)를 준다. 칸 번호가
 * 없는 고양이(옛 응답)는 빈 칸 가운데 가장 앞에 세운다(서버 IdleEngine.seat과 같다).
 */
export function fieldSeats<T extends { fielded: boolean; slot?: number | null }>(
  cats: readonly T[],
  slots: number,
): (T | null)[] {
  const seats: (T | null)[] = Array.from({ length: Math.max(0, slots) }, () => null)
  const loose: T[] = []
  for (const cat of cats) {
    if (!cat.fielded) continue
    const at = cat.slot
    if (at != null && at >= 0 && at < seats.length && !seats[at]) seats[at] = cat
    else loose.push(cat)
  }
  for (const cat of loose) {
    const free = seats.indexOf(null)
    if (free < 0) break
    seats[free] = cat
  }
  return seats
}

/** 출전한 고양이를 칸 번호순으로: 전투에서 사장냥 옆에 이 차례로 선다. */
export function fieldedInOrder<T extends { fielded: boolean; slot?: number | null }>(
  cats: readonly T[],
): T[] {
  const fielded = cats.filter((cat) => cat.fielded)
  return fieldSeats(
    fielded,
    fielded.length + Math.max(0, ...fielded.map((c) => (c.slot ?? 0) + 1)),
  ).filter((cat): cat is T => cat !== null)
}
