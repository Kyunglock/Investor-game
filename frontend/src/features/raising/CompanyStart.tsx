import { AdSlot } from '../ads/AdSlot'
import { ADSENSE_SLOT_START } from '../ads/adsense'
import { Document } from '../game/Document'

/** 시작 화면. 사장의 사재 1억 원으로 증권사를 차리고, 공채 시장에서 직원을 뽑아 앉힌다 (decisions.md 228번). */
export function CompanyStart({
  onOpen,
  busy,
  error,
}: {
  onOpen: () => void
  busy: boolean
  error: string | null
}) {
  return (
    <Document title="증권사 사장">
      <h2 className="font-serif-kr text-[32px] font-black leading-tight">증권사 차리기</h2>
      <p className="mt-2 text-[13px] text-muted">
        사장의 사재 1억 원으로 작은 증권사를 차립니다.
        <br />
        공채에서 사람을 뽑아 자리에 앉히면, 직원들이 성격대로 굴립니다.
      </p>
      <button
        type="button"
        disabled={busy}
        className="mt-5 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90 disabled:opacity-50"
        onClick={onOpen}
      >
        회사 차리기
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-wine">
          {error}
        </p>
      )}
      {/* 광고는 결정하는 순간이 아닌 첫 화면에만 둔다 (decisions.md 271번). 게시자 ID가 없으면 그리지 않는다. */}
      <AdSlot slot={ADSENSE_SLOT_START} />
      <p className="mt-4 text-center text-[12px] text-muted">
        <a href="/privacy" className="underline">
          개인정보처리방침
        </a>
      </p>
    </Document>
  )
}
