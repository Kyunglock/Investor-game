import type { LogEntry } from '../../api/client'
import { signedWon, won } from './labels'

/**
 * 세상 소식: 전조·평범한 기사·헛소문(ARTICLE)·위기 회고. 화면 아래 큰 배너로 닫을 때까지(또는 다음 소식까지) 남는다 (#24). 전조와 기사는 같은 배너,
 * 같은 모양이라 배너만 보고 전조를 가려낼 수 없다 (decisions.md 38번).
 */
const WORLD_KINDS = new Set<LogEntry['kind']>(['OMEN', 'ARTICLE', 'CRISIS'])

/** 생활 알림. 상단 오른쪽 토스트로 하나씩 차례로 3초씩 지나간다. */
const TOAST_KINDS = new Set<LogEntry['kind']>(['LIFE', 'HOME_SOLD', 'TENANT'])

/** 새로 들어온 기록 줄을 토스트와 세상 소식으로 나눈다. 순서는 기록 순서(오래된 것 먼저) 그대로. */
export function splitNotices(entries: LogEntry[]): { toasts: LogEntry[]; world: LogEntry[] } {
  return {
    toasts: entries.filter((e) => TOAST_KINDS.has(e.kind)),
    world: entries.filter((e) => WORLD_KINDS.has(e.kind)),
  }
}

/** 세상 소식 한 줄. 전조는 무엇의 전조인지 말하지 않고 들린 대로만 전한다. 위기는 끝난 뒤에야 이름이 붙는다 (decisions.md 38번). */
export function worldText(entry: LogEntry): string {
  const p = entry.payload as Record<string, unknown>
  if (entry.kind === 'CRISIS') {
    return `돌아보니 그때는 ${String(p.name ?? '')}${p.severity === 'DEPRESSION' ? ' — 대공황' : ' — 불황'}이었다`
  }
  return String(p.text ?? '')
}

/** 생활 알림 한 줄. LIFE는 제목과 금액을 따로 그리므로 null. */
export function toastText(entry: LogEntry): string | null {
  const p = entry.payload as Record<string, unknown>
  switch (entry.kind) {
    case 'HOME_SOLD':
      return `${String(p.regionName ?? '')}가 ${won(Number(p.price ?? 0))}에 팔렸다`
    case 'TENANT':
      return `${String(p.regionName ?? '')} 세입자 교체 · 보증금 ${signedWon(Number(p.after ?? 0) - Number(p.before ?? 0))}`
    default:
      return null
  }
}
