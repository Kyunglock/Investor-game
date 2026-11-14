import { useEffect, useState } from 'react'
import { STAGE_ASSETS } from '../mental/assets'
import './loading-screen.css'

/** 기다리는 동안 한 줄씩 바뀌는 도움말 (517번). */
const TIPS = [
  '매도벽을 다섯 개 부술 때마다 뽑기권이 한 장 생겨요',
  '뽑기권 열 장이면 10연속 뽑기로 한 번에 뽑아요',
  '같은 고양이를 또 뽑으면 레벨이 오르고 스킬도 세져요',
  '같은 무기를 모으면 합성해 한 등급 올릴 수 있어요',
  '고양이에게 가진 무기를 하나씩 들려 줄 수 있어요',
  '출전 칸은 넷: 사장냥은 늘 함께 싸워요',
]

/**
 * 그림을 미리 내려받는다 (517번). 하나가 끝날 때마다(실패해도) onEach를 부르므로 로딩이 그림 하나에 걸려 멈추지 않는다. 브라우저 캐시에 들어가 전투
 * 화면이 바로 그린다.
 */
export function preloadImages(urls: string[], onEach: () => void) {
  const images = urls.map((url) => {
    const image = new Image()
    let counted = false
    const done = () => {
      if (counted) return
      counted = true
      onEach()
    }
    image.onload = done
    image.onerror = done
    image.src = url
    if (image.complete) done()
    return image
  })
  return () => {
    for (const image of images) {
      image.onload = null
      image.onerror = null
    }
  }
}

/**
 * 접속 로딩 화면 (decisions.md 517번): 앱을 열면 서버에 접속하고, 회사를 불러오거나 차리고, 전투 그림을 미리 받는 동안 보인다. 막대는 실제로 끝난
 * 단계(progress)를 따라 부드럽게 차오르고, 다 되면(done) 100%를 채운 뒤 사라진다(leaving).
 */
export function LoadingScreen({
  message,
  progress,
  done = false,
  leaving = false,
}: {
  message: string
  /** 0~100: 끝난 단계만큼 */
  progress: number
  done?: boolean
  leaving?: boolean
}) {
  const target = done ? 100 : Math.min(progress, 95)
  const [shown, setShown] = useState(4)
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  useEffect(() => {
    const fill = setInterval(
      () =>
        setShown((p) => (p >= target ? p : Math.min(target, p + Math.max(1, (target - p) * 0.25)))),
      60,
    )
    return () => clearInterval(fill)
  }, [target])
  useEffect(() => {
    const turn = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 2600)
    return () => clearInterval(turn)
  }, [])
  const percent = Math.round(shown)
  return (
    <div
      className="loading-screen app-bg"
      data-testid="loading"
      data-leaving={leaving}
      role="status"
      aria-live="polite"
    >
      <div className="loading-screen-body">
        <h1 className="loading-screen-title">
          흔들리지 않는
          <br />
          <b>고양이</b>
        </h1>
        <div className="loading-screen-hero" aria-hidden="true">
          <img src={STAGE_ASSETS.hero} alt="" draggable={false} />
          <span className="loading-screen-shadow" />
        </div>
        <p className="loading-screen-message">{message}</p>
        <div
          className="loading-screen-bar"
          role="progressbar"
          aria-label="접속 진행"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${shown}%` }} />
          <em>{percent}%</em>
        </div>
        <p className="loading-screen-tip" key={tip}>
          <b>TIP</b> {TIPS[tip]}
        </p>
      </div>
    </div>
  )
}
