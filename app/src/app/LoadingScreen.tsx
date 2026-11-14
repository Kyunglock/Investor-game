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

const MESSAGES = {
  loading: '회사를 불러오는 중…',
  opening: '새 회사를 차리는 중…',
} as const

/**
 * 로딩 화면 (decisions.md 517번): 앱을 열어 회사를 불러오거나 처음 회사를 차리는 동안 보인다. 사장냥이 통통 뛰고, 막대가 차오르고(서버가 진행을
 * 알려 주지 않으므로 90%까지 천천히 다가간다), 도움말이 바뀐다.
 */
export function LoadingScreen({ stage }: { stage: keyof typeof MESSAGES }) {
  const [progress, setProgress] = useState(8)
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  useEffect(() => {
    const fill = setInterval(() => setProgress((p) => p + (90 - p) * 0.12), 180)
    const turn = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 2600)
    return () => {
      clearInterval(fill)
      clearInterval(turn)
    }
  }, [])
  return (
    <div
      className="loading-screen app-bg"
      data-testid={stage === 'loading' ? 'loading' : 'opening-company'}
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
        <p className="loading-screen-message">{MESSAGES[stage]}</p>
        <div
          className="loading-screen-bar"
          role="progressbar"
          aria-label="불러오는 정도"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="loading-screen-tip" key={tip}>
          <b>TIP</b> {TIPS[tip]}
        </p>
      </div>
    </div>
  )
}
