import type { Company } from '@web/api/client'

/** 이슈 장면 (6.1절, decisions.md 309번): 폭락 조짐·경보·선견·뜨는 섹터·시대의 끝, 올해 필요한 인재. 이직 제안 카드는 385번에서 뺐다. */
export function IssueScene({ company }: { company: Company }) {
  const m = company.meeting
  if (!m) {
    return <p className="text-[13px] text-ink/60">끝난 회사에는 이슈가 없습니다.</p>
  }
  const quiet = !m.omen && !m.earlyOmen && !m.forecast && !m.hot && !m.eraEnding
  return (
    <div className="grid gap-2" data-testid="issue-scene">
      {m.omen && (
        <Note
          tone="border-red-pen text-red-pen"
          tag="폭락 조짐"
          tagTone="bg-red-pen"
          testId="company-omen"
        >
          {m.omen}
        </Note>
      )}
      {m.earlyOmen && (
        <Note
          tone="border-red-pen/60 text-red-pen"
          tag="경보"
          tagTone="bg-red-pen"
          testId="early-omen"
        >
          {m.earlyOmen}
        </Note>
      )}
      {m.forecast && (
        <Note tone="border-gold text-gold" tag="선견" tagTone="bg-gold" testId="forecast">
          {m.forecast}
        </Note>
      )}
      {m.hot && (
        <Note tone="border-gold text-gold" tag="★ 뜨는 섹터" tagTone="bg-gold" testId="hot-sector">
          {m.hot}
        </Note>
      )}
      {m.eraEnding && (
        <Note tone="border-teal text-teal" tag="시대의 끝" tagTone="bg-teal" testId="era-ending">
          {m.eraEnding}
        </Note>
      )}
      <Note tone="border-transparent text-ink" tag="올해 필요한 인재" tagTone="bg-ink">
        {m.wanted}
      </Note>
      {quiet && <p className="text-center text-[12px] text-ink/50">조용한 해입니다.</p>}
    </div>
  )
}

function Note({
  tone,
  tag,
  tagTone,
  children,
  testId,
}: {
  tone: string
  tag: string
  tagTone: string
  children: string
  testId?: string
}) {
  return (
    <p className={`panel border-2 p-3 text-[14px] font-semibold ${tone}`} data-testid={testId}>
      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] text-white ${tagTone}`}>
        {tag}
      </span>
      {children}
    </p>
  )
}
