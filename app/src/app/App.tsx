import { useRaisingStore } from '@web/features/raising/store'
import { useTutorial } from '@web/features/raising/tutorial'
import { useEffect, useState } from 'react'
import { FxLayer } from '../fx/FxLayer'
import { armAudio } from '../fx/sound'
import { useCompanyFx } from '../fx/useCompanyFx'
import { STAGE_ASSETS } from '../mental/assets'
import { LoadingScreen, preloadImages } from './LoadingScreen'
import { Shell } from './Shell'
import { TutorialGuide } from './TutorialGuide'
import officeAtlas from './toy-city/assets/cat-atlas.png'
import { firstTab, useAppUi } from './ui'

/**
 * 앱 (decisions.md 309·343번): 제목 화면이 없다. 회사가 있으면 바로 앱 화면의 틀(첫 탭은 사무실), 없으면 묻지 않고 회사를 차려 들어간다. 처음 온 사람은
 * 튜토리얼이 켜진 채 들어간다. 서버 상태는 웹과 같은 스토어가 들고 있다.
 */
/** 접속 때 미리 받는 그림: 전투와 사무실 (517번). */
const BOOT_IMAGES = [...Object.values(STAGE_ASSETS), officeAtlas]

/** 로딩 화면을 적어도 이만큼은 보인다: 빠른 접속에서 번쩍하고 지나가지 않게 (517번). */
const BOOT_MIN_MS = 1400

/** 그림이 이만큼 지나도 다 오지 않으면 기다리지 않고 들어간다. 못 받은 그림은 게임 화면이 다시 받는다. */
const BOOT_MAX_ASSET_MS = 8000

/** 100%를 채운 뒤 로딩 화면이 사라지는 데 걸리는 시간. CSS의 transition과 맞춘다. */
const BOOT_FADE_MS = 450

export function App() {
  const tutorialRevision = useTutorial((s) => s.revision)
  const status = useRaisingStore((s) => s.status)
  const company = useRaisingStore((s) => s.company)
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { load, open } = useRaisingStore.getState()
  useCompanyFx()

  // 접속 로딩 (517번): 서버 접속 → 회사 → 그림. 셋이 다 되고 최소 시간이 지나면 100%를 채우고 사라진다.
  const [loadedImages, setLoadedImages] = useState(0)
  const [assetsGaveUp, setAssetsGaveUp] = useState(false)
  const [minElapsed, setMinElapsed] = useState(false)
  const [boot, setBoot] = useState<'loading' | 'leaving' | 'entered'>('loading')
  useEffect(() => {
    armAudio()
    void load()
    const stop = preloadImages(BOOT_IMAGES, () => setLoadedImages((n) => n + 1))
    const min = setTimeout(() => setMinElapsed(true), BOOT_MIN_MS)
    const max = setTimeout(() => setAssetsGaveUp(true), BOOT_MAX_ASSET_MS)
    return () => {
      stop()
      clearTimeout(min)
      clearTimeout(max)
    }
  }, [load])
  const assetsReady = assetsGaveUp || loadedImages >= BOOT_IMAGES.length
  const ready = status === 'ready' && Boolean(company) && assetsReady && minElapsed
  useEffect(() => {
    if (!ready || boot !== 'loading') return
    const leave = setTimeout(() => setBoot('leaving'), 300)
    return () => clearTimeout(leave)
  }, [ready, boot])
  useEffect(() => {
    if (boot !== 'leaving') return
    const enter = setTimeout(() => setBoot('entered'), BOOT_FADE_MS)
    return () => clearTimeout(enter)
  }, [boot])

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
      {boot !== 'entered' && status !== 'error' && !(opening && error) && (
        <LoadingScreen
          message={
            ready
              ? '접속 완료!'
              : status === 'loading'
                ? '서버에 접속하는 중…'
                : !company
                  ? '새 회사를 차리는 중…'
                  : '고양이들을 깨우는 중…'
          }
          progress={
            10 +
            (status === 'ready' ? 30 : 0) +
            (company ? 25 : 0) +
            Math.round((35 * Math.min(loadedImages, BOOT_IMAGES.length)) / BOOT_IMAGES.length)
          }
          done={ready}
          leaving={boot === 'leaving'}
        />
      )}
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
