/** 지난 결산 소식 한 줄의 갈래 (decisions.md 398번): 아이콘·색·꼬리표를 정한다. */
export type NewsKind = {
  icon: string
  tag: string
  tone: 'up' | 'down' | 'gold' | 'teal' | 'warn' | 'plain'
}

/**
 * 서버의 결산 소식은 갈래 없는 문장이라(content/raising.json의 문구) 낱말로 가른다. 문구가 바뀌어 아무 데도 맞지 않으면 '소식'으로 보일 뿐이다. 순서가
 * 중요하다: 채용권 줄의 까닭에 "새 건물로 이사했다"가, 버틴 직원 줄에 "폭락장"이 들어 있다.
 */
export function newsKind(line: string): NewsKind {
  if (line.startsWith('호황')) return { icon: '📈', tag: '시장', tone: 'up' }
  if (line.startsWith('폭락장이었다') || line.includes('폭락이 터졌다'))
    return { icon: '📉', tag: '시장', tone: 'down' }
  if (line.startsWith('평범한 한 해')) return { icon: '🌤️', tag: '시장', tone: 'plain' }
  if (line.includes('조짐') || line.startsWith('헛소문'))
    return { icon: '🔍', tag: '조짐', tone: 'warn' }
  if (line.includes('채용권')) return { icon: '🎟️', tag: '채용권', tone: 'gold' }
  if (line.includes('특급 인재')) return { icon: '🎉', tag: '채용', tone: 'gold' }
  if (line.includes('내려갔다')) return { icon: '🔻', tag: '등급', tone: 'down' }
  if (/올라섰다|자랐다|올랐다 \(|되찾았다|실전 경험/.test(line))
    return { icon: '⭐', tag: '성장', tone: 'up' }
  if (/손이 떨려|못 참고|흔들려/.test(line)) return { icon: '💦', tag: '실수', tone: 'warn' }
  if (line.includes('떠났다') || line.includes('일어나 쉰다'))
    return { icon: '👋', tag: '인사', tone: 'plain' }
  if (/건물|랜드마크|공사/.test(line)) return { icon: '🏢', tag: '건물', tone: 'teal' }
  if (line.includes('시대')) return { icon: '🕰️', tag: '시대', tone: 'teal' }
  if (line.includes('금고') || line.includes('바닥났다'))
    return { icon: '💸', tag: '자본', tone: 'down' }
  if (line.includes('멘탈')) return { icon: '🛡️', tag: '멘탈', tone: 'teal' }
  return { icon: '📰', tag: '소식', tone: 'plain' }
}
