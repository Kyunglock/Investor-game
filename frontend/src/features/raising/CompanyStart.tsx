import { AdSlot } from '../ads/AdSlot'
import { ADSENSE_SLOT_START } from '../ads/adsense'
import { Document } from '../game/Document'
import { BuildingArt } from './BuildingArt'
import { useTutorial } from './tutorial'

/**
 * 시작 화면 (decisions.md 228·302번): 게임 제목 화면이다. 사표를 던지고 나온 사장의 사재 1억 원, 반지하 사무실의 작은 간판. 처음 온 사람에게는 튜토리얼과
 * 함께 시작하기를 먼저 권하고, 해 본 사람에게는 바로 시작을 먼저 둔다.
 */
export function CompanyStart({
  onOpen,
  busy,
  error,
}: {
  /** tutorial이면 튜토리얼을 켜고 회사를 차린다. */
  onOpen: (tutorial: boolean) => void
  busy: boolean
  error: string | null
}) {
  const fresh = useTutorial((s) => s.fresh)
  const primary =
    'min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90 disabled:opacity-50'
  const secondary =
    'min-h-11 w-full rounded border border-wine text-[14px] font-semibold text-wine hover:bg-wine/10 disabled:opacity-50'
  const withTutorial = (
    <button
      type="button"
      disabled={busy}
      className={fresh ? primary : secondary}
      onClick={() => onOpen(true)}
      data-testid="start-tutorial"
    >
      튜토리얼과 함께 시작
    </button>
  )
  const plain = (
    <button
      type="button"
      disabled={busy}
      className={fresh ? secondary : primary}
      onClick={() => onOpen(false)}
      data-testid="start-plain"
    >
      바로 시작
    </button>
  )
  return (
    <Document title="증권사 사장">
      <p className="text-[12px] font-semibold tracking-[0.2em] text-muted">증권사 육성 게임</p>
      <h2 className="font-serif-kr text-[40px] font-black leading-tight" data-testid="title">
        증권사 사장
      </h2>
      <p className="mt-1 text-[14px] text-muted">
        직원을 뽑고, 회의를 열고, 여의도 랜드마크 타워까지.
      </p>
      <BuildingArt grade="F" />
      <p className="mt-3 text-[13px] leading-relaxed" data-testid="start-story">
        사표를 던지고 나온 날, 통장에는 1억 원이 있었다. 반지하 사무실에 작은 간판을 걸었다.
        <br />
        채용권으로 사람을 뽑아 자리에 앉히면, 직원들은 저마다의 성격대로 돈을 굴린다. 사장은
        회의에서 결정하고, 결산서를 읽고, 건물을 키운다.
      </p>
      <div className="mt-5 grid gap-2">
        {fresh ? withTutorial : plain}
        {fresh ? plain : withTutorial}
      </div>
      <p className="mt-2 text-center text-[12px] text-muted">
        튜토리얼은 처음 다섯 걸음(뽑기 → 앉히기 → 회의 → 결산 → 키우기)을 알려 주고, 언제든 건너뛸
        수 있습니다.
      </p>
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
