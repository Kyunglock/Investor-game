import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { CatPortrait } from './CatPortrait'
import { ONBOARDING, tutorialReady } from './onboarding'
import './onboarding-guide.css'

export function IdleTutorial({
  company,
  replay,
  onReplay,
  onGo,
  inSheet,
}: {
  company: Company
  replay: number | null
  onReplay: (step: number | null) => void
  onGo: (menu: 'battle' | 'growth' | 'cats' | 'skills', gear?: boolean) => void
  inSheet: boolean
}) {
  const progress = company.idle?.onboarding
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const [confirmSkip, setConfirmSkip] = useState(false)
  if (!progress) return null
  const step = replay ?? progress.step
  const skillGuide = step >= 8 && progress.skillsUnlocked && !progress.skillGuideSeen
  if (step >= 8 && !skillGuide) return null
  const request = (action: 'next' | 'skip' | 'skills') =>
    void useRaisingStore.getState().tutorial(action, progress.step)
  const ready = tutorialReady(company, step)
  const equipped = company.idle?.actives?.some((a) => !a.ad && a.equipped)
  const [title, text] = skillGuide
    ? [
        '스킬 해금!',
        !inSheet
          ? '100 매도벽 돌파! 이제 사장냥이 직접 쓰는 스킬을 장착할 수 있어요.'
          : !equipped
            ? '스킬 목록에서 원하는 스킬을 골라 장착해 주세요. 최대 3개까지 장착할 수 있어요.'
            : '장착 완료! 돌파 화면 오른쪽의 스킬 버튼을 눌러 사용해 보세요. 사용 후에는 재사용 대기 시간이 있어요.',
      ]
    : ONBOARDING[step]
  const next = () => {
    if (replay !== null) {
      onReplay(step === 7 ? null : step + 1)
      return
    }
    if (skillGuide) {
      if (!inSheet || !equipped) {
        onGo('skills')
      } else {
        onGo('battle')
        request('skills')
      }
      return
    }
    if (!ready) {
      if (step === 1) onGo('growth')
      if (step === 3 || step === 5) onGo('cats', step === 5)
      return
    }
    if (step === 5 || step === 6 || step === 7) onGo('battle')
    request('next')
  }
  const label =
    replay !== null
      ? step === 7
        ? '다시 보기 마치기'
        : '다음 안내'
      : skillGuide
        ? !inSheet || !equipped
          ? '스킬 장착하러 가기'
          : '돌파 화면에서 사용하기'
        : !ready
          ? step === 0
            ? '첫 돌파를 기다리는 중'
            : step === 1
              ? '성장 메뉴 열기'
              : step === 3
                ? '밤냥 출전하러 가기'
                : '밤냥 무기 목록 열기'
          : step === 2
            ? 'A등급 밤냥 받기'
            : step === 4
              ? 'B등급 기관단총 받기'
              : step === 7
                ? '돌파 시작!'
                : '다음'
  return (
    <aside
      className={`idle-tutorial ${inSheet ? 'in-sheet' : 'in-battle'}`}
      data-testid="idle-tutorial"
      data-step={step}
      aria-label="첫 출근 안내"
    >
      <div className="idle-tutorial-copy" aria-live="polite">
        <CatPortrait code={step >= 2 && step <= 6 ? 'night' : undefined} />
        <div>
          <small>
            {replay !== null ? '다시 보기' : skillGuide ? '새 기능' : `첫 출근 · ${step + 1} / 8`}
          </small>
          <strong>{confirmSkip ? '안내를 건너뛸까요?' : title}</strong>
          <p>
            {confirmSkip
              ? '밤냥과 기관단총은 그대로 받아요. 설정에서 안내를 다시 볼 수 있어요.'
              : text}
          </p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="idle-tutorial-actions">
        {confirmSkip ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                request('skip')
                setConfirmSkip(false)
              }}
            >
              선물 받고 건너뛰기
            </button>
            <button type="button" onClick={() => setConfirmSkip(false)}>
              계속 보기
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || (step === 0 && !ready && replay === null)}
              onClick={next}
            >
              {busy ? '저장 중…' : label}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (replay !== null) onReplay(null)
                else if (skillGuide) request('skills')
                else setConfirmSkip(true)
              }}
            >
              {replay !== null ? '닫기' : skillGuide ? '나중에 보기' : '건너뛰기'}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
