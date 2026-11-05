import { Document } from '../game/Document'

/** 시작 화면. 증권사 사장이 수습 투자자 한 명을 3분 동안 키운다 (증권사 육성 설계 0절). */
export function RunStart({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <Document title="증권사 사장">
      <h2 className="font-serif-kr text-[32px] font-black leading-tight">수습 투자자 키우기</h2>
      <p className="mt-2 text-[13px] text-muted">
        사장의 돈 1억 원으로 수습 투자자 한 명을 키웁니다.
        <br />
        고르는 건 당신이지만, 실행은 그 사람의 성격이 합니다.
      </p>
      <button
        type="button"
        disabled={busy}
        className="mt-5 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90 disabled:opacity-50"
        onClick={onStart}
      >
        수습 시작
      </button>
    </Document>
  )
}
