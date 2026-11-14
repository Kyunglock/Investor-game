import { useRaisingStore } from '@web/features/raising/store'
import { useTutorial } from '@web/features/raising/tutorial'
import { useEffect } from 'react'
import { FxLayer } from '../fx/FxLayer'
import { armAudio } from '../fx/sound'
import { useCompanyFx } from '../fx/useCompanyFx'
import { LoadingScreen } from './LoadingScreen'
import { Shell } from './Shell'
import { TutorialGuide } from './TutorialGuide'
import { firstTab, useAppUi } from './ui'

/**
 * 앱 (decisions.md 309·343번): 제목 화면이 없다. 회사가 있으면 바로 앱 화면의 틀(첫 탭은 사무실), 없으면 묻지 않고 회사를 차려 들어간다. 처음 온 사람은
 * 튜토리얼이 켜진 채 들어간다. 서버 상태는 웹과 같은 스토어가 들고 있다.
 */
export function App() {
  const tutorialRevision = useTutorial((s) => s.revision)
  const status = useRaisingStore((s) => s.status)
  const company = useRaisingStore((s) => s.company)
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { load, open } = useRaisingStore.getState()
  useCompanyFx()

  useEffect(() => {
    armAudio()
    void load()
  }, [load])

  // 회사가 없으면 바로 차린다(343번): 시작 버튼이 없다. 처음 온 사람은 튜토리얼을 켠 채로. 실패하면 아래에서 다시 시도.
  const opening = status === 'ready' && !company
  useEffect(() => {
    if (!opening || useRaisingStore.getState().busy || useRaisingStore.getState().error) {
      return
    }
    if (useTutorial.getState().fresh) {
      useTutorial.getState().start()
    }
    void open()
  }, [opening, open])

  // 회사가 생기면(차리거나 불러오면) 첫 탭을 정한다: 처음부터 사무실을 보여 준다.
  const companyId = company?.companyId
  useEffect(() => {
    const c = useRaisingStore.getState().company
    if (c && c.companyId === companyId) {
      useAppUi.getState().setTab(firstTab(c))
    }
  }, [companyId])

  return (
    <>
      {status === 'loading' && <LoadingScreen stage="loading" />}
      {status === 'error' && (
        <div className="flex h-dvh flex-col items-center justify-center gap-3 app-bg px-6 text-ink">
          <p role="alert" className="text-[15px]">
            서버에 연결할 수 없습니다.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="btn btn-ghost min-h-12 px-6 text-[14px]"
          >
            다시 시도
          </button>
        </div>
      )}
      {opening && !error && <LoadingScreen stage="opening" />}
      {opening && error && (
        <div
          className="flex h-dvh flex-col items-center justify-center gap-3 app-bg px-6 text-ink"
          data-testid="opening-company"
        >
          <p role="alert" className="text-[15px]">
            {error}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void open()}
            className="btn btn-ghost min-h-12 px-6 text-[14px]"
          >
            다시 시도
          </button>
        </div>
      )}
      {status === 'ready' && company && (
        <>
          <Shell company={company} />
          <TutorialGuide key={`${company.companyId}-${tutorialRevision}`} company={company} />
        </>
      )}
      <FxLayer />
    </>
  )
}
