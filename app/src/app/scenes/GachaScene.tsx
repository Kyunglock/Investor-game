import type { Company } from '@web/api/client'
import { CollectionGrid, RatesTable, ReleaseList } from '@web/features/raising/Gacha'
import { collected, drawable, mergeGroups } from '@web/features/raising/gachaRules'
import { MergeBoard } from '@web/features/raising/MergeBoard'
import { useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { useFx } from '../../fx/fx'
import { haptic } from '../../fx/haptics'
import { sfx } from '../../fx/sound'

type Part = 'draw' | 'merge' | 'dex'

/** 합성 판의 소리·진동 (318번): 집으면 가볍게, 놓으면 휙, 합쳐지면 두 음. */
const MERGE_EFFECTS = {
  pick: () => haptic.light(),
  drop: () => {
    sfx.whoosh()
    haptic.light()
  },
  merged: () => {
    sfx.levelUp()
    haptic.success()
  },
  failed: () => haptic.error(),
}

/**
 * 채용 장면 (decisions.md 312번): 뽑기 · 합성 · 도감. 뽑기는 큰 채용권 숫자와 1명·N명 뽑기 버튼, 확률표, 쉬는 사람 내보내기. 합성은 같은 등급 카드 두 장을
 * 끌어 겹쳐 한 단계 올리고(MergeBoard, 314·318번), 도감은 만난 등급을 모은다.
 */
export function GachaScene({ company }: { company: Company }) {
  const [part, setPart] = useState<Part>('draw')
  const groups = mergeGroups(company).length
  if (company.status === 'ENDED') {
    return <p className="text-[13px] text-white/60">끝난 회사는 사람을 뽑지 않습니다.</p>
  }
  const parts: { id: Part; label: string; badge?: string }[] = [
    { id: 'draw', label: '뽑기' },
    { id: 'merge', label: '합성', badge: groups > 0 ? String(groups) : undefined },
    { id: 'dex', label: `도감 ${collected(company)}/${company.gacha.collection.length}` },
  ]
  return (
    <div data-testid="gacha-scene">
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist">
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
            className={`relative min-h-9 shrink-0 rounded-full border px-3 text-[13px] font-semibold ${
              part === p.id
                ? 'border-(--gold-bright) bg-(--gold-bright) text-[#3b2a05]'
                : 'border-white/15 bg-white/10 text-white/75'
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
        {part === 'merge' && (
          <div className="panel p-3">
            <MergeBoard company={company} effects={MERGE_EFFECTS} />
          </div>
        )}
        {part === 'dex' && (
          <div className="panel p-3">
            <CollectionGrid company={company} />
          </div>
        )}
      </div>
    </div>
  )
}

/** 뽑기: 채용권 숫자, 1명·N명 뽑기, 확률표, 쉬는 사람 내보내기. */
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
      <div className="panel-dark flex items-center justify-between px-4 py-3 text-white">
        <div>
          <p className="text-[12px] text-white/60">채용권</p>
          <p className="font-mono-num text-[34px] font-black leading-none text-(--gold-bright)">
            🎟 <span data-testid="tickets">{g.tickets}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-white/60">데리고 있는 사람</p>
          <p className="font-mono-num text-[20px] font-bold" data-testid="roster">
            {g.roster} / {g.rosterMax}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy || many < 1}
          onClick={(ev) => press(1, ev.currentTarget)}
          className="btn btn-primary min-h-16 text-[17px]"
          data-testid="draw-one"
        >
          1명 뽑기
        </button>
        <button
          type="button"
          disabled={busy || many < 2}
          onClick={(ev) => press(many, ev.currentTarget)}
          className="btn btn-gold min-h-16 text-[17px]"
          data-testid="draw-many"
        >
          {many >= 2 ? `${many}명 뽑기` : '여러 명'}
        </button>
      </div>
      {full ? (
        <p className="text-[12px] text-[#ff8a7a]" data-testid="roster-full">
          데리고 있을 자리가 꽉 찼습니다. 합성하거나 쉬는 사람을 내보내세요.
        </p>
      ) : (
        <p className="text-[12px] text-white/60">
          분기를 넘길 때마다, 연말·업적·이사 때 채용권을 받습니다.
          {company.meeting?.hrCap && ` 인사팀 덕에 ${company.meeting.hrCap} 언저리까지 나옵니다.`}
        </p>
      )}
      <div className="panel p-3">
        <p className="mb-1 text-[13px] font-semibold">확률표</p>
        <RatesTable company={company} />
      </div>
      <div className="panel p-3">
        <p className="mb-1 text-[13px] font-semibold">쉬는 사람 내보내기</p>
        <ReleaseList company={company} />
      </div>
    </div>
  )
}
