import type { LogEntry } from '../../api/client'
import { signedWon, won } from './labels'

/**
 * 토스트로 지나가는 알림: 생활 이벤트·집이 팔림·세입자 교체와 세상 소식(전조·평범한 기사·헛소문·위기 회고). 상단 오른쪽에 하나씩 차례로 뜨고, 자세한
 * 것은 수첩의 "요즘 있었던 일"에서 본다 (#24, decisions.md 47번). 전조와 기사는 같은 모양이라 토스트만 보고 전조를 가려낼 수 없다 (38번).
 */
const TOAST_KINDS = new Set<LogEntry['kind']>([
  'LIFE',
  'HOME_SOLD',
  'TENANT',
  'OMEN',
  'ARTICLE',
  'CRISIS',
])

/** 새로 들어온 기록 줄 가운데 토스트로 띄울 것. 순서는 기록 순서(오래된 것 먼저) 그대로. */
export function noticesOf(entries: LogEntry[]): LogEntry[] {
  return entries.filter((e) => TOAST_KINDS.has(e.kind))
}

/** 세상 소식 한 줄. 전조는 무엇의 전조인지 말하지 않고 들린 대로만 전한다. 위기는 끝난 뒤에야 이름이 붙는다 (decisions.md 38번). */
export function worldText(entry: LogEntry): string {
  const p = entry.payload as Record<string, unknown>
  if (entry.kind === 'CRISIS') {
    return `돌아보니 그때는 ${String(p.name ?? '')}${p.severity === 'DEPRESSION' ? ' — 대공황' : ' — 불황'}이었다`
  }
  return String(p.text ?? '')
}

/** 토스트 한 줄. LIFE는 제목과 금액을 따로 그리므로 null. */
export function toastText(entry: LogEntry): string | null {
  const p = entry.payload as Record<string, unknown>
  switch (entry.kind) {
    case 'OMEN':
    case 'ARTICLE':
    case 'CRISIS':
      return worldText(entry)
    case 'HOME_SOLD':
      return `${String(p.regionName ?? '')}가 ${won(Number(p.price ?? 0))}에 팔렸다`
    case 'TENANT':
      return `${String(p.regionName ?? '')} 세입자 교체 · 보증금 ${signedWon(Number(p.after ?? 0) - Number(p.before ?? 0))}`
    default:
      return null
  }
}
