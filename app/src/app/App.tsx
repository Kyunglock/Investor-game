import { useCompanyAutoPlay } from '@web/features/raising/autoPlay'
import { useRaisingStore } from '@web/features/raising/store'
import { useTutorial } from '@web/features/raising/tutorial'
import { useEffect } from 'react'
import { Shell } from './Shell'
import { TitleScene } from './TitleScene'
import { firstTab, useAppUi } from './ui'

/** 앱 (decisions.md 309번): 회사가 있으면 앱 화면의 틀, 없으면 제목 화면. 서버 상태는 웹과 같은 스토어가 들고 있다. */
export function App() {
  const status = useRaisingStore((s) => s.status)
  const company = useRaisingStore((s) => s.company)
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { load, open } = useRaisingStore.getState()
  useCompanyAutoPlay()

  useEffect(() => {
    void load()
  }, [load])

  // 회사가 생기면(차리거나 불러오면) 첫 탭을 정한다: 직원이 없으면 공채부터.
  const companyId = company?.companyId
  useEffect(() => {
    const c = useRaisingStore.getState().company
    if (c && c.companyId === companyId) {
      useAppUi.getState().setTab(firstTab(c))
    }
  }, [companyId])

  if (status === 'loading') {
    return (
      <div
        className="flex h-dvh items-center justify-center bg-[--hud] text-white/70"
        data-testid="loading"
      >
        <p className="animate-pulse-soft text-[14px]">불러오는 중…</p>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-[--hud] px-6 text-white">
        <p role="alert" className="text-[15px]">
          서버에 연결할 수 없습니다.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-12 rounded-xl border border-white/40 px-6 text-[14px] font-semibold"
        >
          다시 시도
        </button>
      </div>
    )
  }
  if (!company) {
    return (
      <TitleScene
        onOpen={(tutorial) => {
          if (tutorial) {
            useTutorial.getState().start()
          }
          void open()
        }}
        busy={busy}
        error={error}
      />
    )
  }
  return <Shell company={company} />
}
