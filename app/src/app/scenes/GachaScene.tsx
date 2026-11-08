import './company-scenes.css'
import type { Company } from '@web/api/client'
import { CollectionGrid, RatesTable } from '@web/features/raising/Gacha'
import { collected, drawable } from '@web/features/raising/gachaRules'
import { useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'

type Part = 'draw' | 'dex'

/**
 * 채용 장면 (decisions.md 312번): 뽑기 · 도감. 뽑기는 큰 채용권 숫자와 1명·N명 뽑기 버튼, 확률표(내보내기는 없앴다, 338번). 도감은 만난 등급을
 * 모은다. 직원 합성은 뺐다(384번).
 */
export function GachaScene({ company }: { company: Company }) {
  const [part, setPart] = useState<Part>('draw')
  if (company.status === 'ENDED') {
    return <p className="text-[13px] text-ink/60">끝난 회사는 사람을 뽑지 않습니다.</p>
  }
  const parts: { id: Part; label: string; badge?: string }[] = [
    { id: 'draw', label: '뽑기' },
    { id: 'dex', label: `도감 ${collected(company)}/${company.gacha.collection.length}` },
  ]
  return (
    <div className="company-scene recruitment-scene" data-testid="gacha-scene">
      <header className="scene-cover">
        <p className="scene-eyebrow">TALENT OFFICE</p>
        <h1>새로운 동료를 만나요</h1>
        <p>작은 만남이 회사의 다음 장을 바꿔요.</p>
        <span className="scene-cover-mark" aria-hidden="true">
          ✦
        </span>
      </header>
      <div className="scene-tabs no-scrollbar" role="tablist">
        {parts.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={part === p.id}
            onClick={() => {
              sfx.tap()
              setPart(p.id)
            }}
            className={`relative min-h-9 shrink-0 rounded-full border-2 px-3 font-game text-[14px] shadow-[0_2px_0_var(--outline)] ${
              part === p.id
                ? 'border-(--outline) bg-(--gold-bright) text-ink'
                : 'border-(--outline) bg-white/80 text-ink'
            }`}
            data-testid={`gacha-part-${p.id}`}
          >
            {p.label}
            {p.badge && (
              <span className="animate-badge-pulse ml-1 rounded-full bg-red-pen px-1.5 text-[10px] text-white">
                {p.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {part === 'draw' && <DrawPart company={company} />}
        {part === 'dex' && (
          <div className="panel p-3">
            <CollectionGrid company={company} />
          </div>
        )}
      </div>
    </div>
  )
}

/** 뽑기: 채용권 숫자, 1명·N명 뽑기, 확률표. */
function DrawPart({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const { draw } = useRaisingStore.getState()
  const g = company.gacha
  const many = drawable(company)
  const full = g.roster >= g.rosterMax
  const press = (count: number, el: Element) => {
    sfx.stamp()
    haptic.medium()
    useFx.getState().burstAt(el, 'sparks')
    void draw(count)
  }
  return (
    <div className="grid gap-3">
      <div className="recruit-ticket panel flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[12px] text-ink/60">채용권</p>
          <p className="font-game text-[38px] leading-none text-[#e08a00] [-webkit-text-stroke:1.5px_var(--outline)] [paint-order:stroke]">
            🎟 <span data-testid="tickets">{g.tickets}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-ink/60">함께하는 동료</p>
          <p className="font-mono-num text-[20px] font-bold" data-testid="roster">
            {g.roster}
            {g.rosterMax < 100_000 && ` / ${g.rosterMax}`}명
          </p>
        </div>
      </div>
      <div className="recruit-actions grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || many < 1}
          onClick={(ev) => press(1, ev.currentTarget)}
          className="btn btn-primary min-h-16 text-[17px]"
          data-testid="draw-one"
        >
          <span>1명 뽑기</span>
          <small>채용권 1장</small>
        </button>
        <button
          type="button"
          disabled={busy || many < 2}
          onClick={(ev) => press(many, ev.currentTarget)}
          className="btn btn-gold min-h-16 text-[17px]"
          data-testid="draw-many"
        >
          <span>{many >= 2 ? `${many}명 뽑기` : '여러 명'}</span>
          <small>{many >= 2 ? `채용권 ${many}장` : '채용권을 모아주세요'}</small>
        </button>
      </div>
      {full ? (
        <p className="text-[12px] text-red-pen" data-testid="roster-full">
          데리고 있을 자리({g.rosterMax}명)가 꽉 찼습니다.
        </p>
      ) : (
        <p className="text-[12px] text-ink/60">
          분기를 넘길 때마다, 연말·업적·이사 때 채용권을 받습니다.
          {company.meeting?.hrCap && ` 인사팀 덕에 ${company.meeting.hrCap} 언저리까지 나옵니다.`}
        </p>
      )}
      <div className="panel p-3">
        <p className="mb-1 text-[13px] font-semibold">어떤 동료를 만나게 될까요?</p>
        <RatesTable company={company} />
      </div>
    </div>
  )
}
