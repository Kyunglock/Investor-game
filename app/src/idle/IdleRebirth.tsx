import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { rebirthIdle } from '@web/features/raising/useIdleBattle'
import { useState } from 'react'
import { watchRewardedAd } from '../app/ads'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { FishIcon } from './FishIcon'
import { rebirthBlock } from './rebirth'

/**
 * 환생 (decisions.md 571번). 성장 탭의 맨 아래에 있다. 매도벽 1로 돌아가고 강화와 돈이 처음으로 돌아가는 대신 생선을 받는다. 되돌릴 수 없어서 한 번 더
 * 묻는다. 물을 때 "광고 보고 3배 받기"를 고르면 생선을 3배로 받는다 (586번): 횟수 한도는 없다.
 */
export function IdleRebirth({ company }: { company: Company }) {
  const rebirth = company.idle?.rebirth
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [got, setGot] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!rebirth) return null
  const block = rebirthBlock(rebirth)
  const run = async (ad: boolean) => {
    if (busy) return
    setBusy(true)
    setError(null)
    // 광고를 끝까지 봤을 때만 3배다. 닫았으면 환생하지 않고 다시 고르게 둔다.
    if (ad && !(await watchRewardedAd('rebirth'))) {
      setBusy(false)
      return
    }
    const gain = ad ? rebirth.adGain : rebirth.gain
    const done = await rebirthIdle(ad)
    setBusy(false)
    setAsking(false)
    if (!done) {
      setError(useRaisingStore.getState().error ?? '환생하지 못했어요. 다시 시도해 주세요.')
      haptic.error()
      return
    }
    sfx.levelUp()
    haptic.success()
    setGot(gain)
  }
  return (
    <section className="idle-rebirth" data-testid="rebirth">
      <b className="idle-rebirth-title">
        환생{' '}
        {rebirth.count > 0 && (
          <small className="idle-rebirth-times">{rebirth.count}번 했어요</small>
        )}
        <span className="idle-fish-count" data-testid="rebirth-fish">
          <FishIcon />
          {rebirth.fish.toLocaleString()}
        </span>
      </b>
      <p className="idle-rebirth-note">
        매도벽 1로 돌아가고 강화와 돈이 처음으로 돌아가요. 대신 고양이 레벨을 올리는 생선을 받아요.
        고양이·무기·다이아는 그대로예요.
      </p>
      {got != null && (
        <p className="idle-rebirth-got" role="status" data-testid="rebirth-got">
          환생했어요! 생선 {got.toLocaleString()}마리를 받았어요 · 고양이 탭에서 레벨을 올려요
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {asking ? (
        <div className="idle-rebirth-ask">
          <span>정말 환생할까요? 되돌릴 수 없어요</span>
          <button
            type="button"
            className="idle-rebirth-button idle-rebirth-ad"
            disabled={busy}
            onClick={() => void run(true)}
            data-testid="rebirth-ad"
          >
            <span className="idle-ad-mark" aria-hidden="true">
              ▶
            </span>
            광고 보고 3배 받기 <FishIcon /> {rebirth.adGain.toLocaleString()}
          </button>
          <button
            type="button"
            className="idle-rebirth-button idle-rebirth-go"
            disabled={busy}
            onClick={() => void run(false)}
            data-testid="rebirth-confirm"
          >
            {busy ? (
              '환생 중…'
            ) : (
              <>
                그냥 환생 <FishIcon /> {rebirth.gain.toLocaleString()}
              </>
            )}
          </button>
          <button
            type="button"
            className="idle-rebirth-button"
            disabled={busy}
            onClick={() => setAsking(false)}
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="idle-rebirth-button idle-rebirth-go"
          disabled={block !== null}
          onClick={() => {
            setGot(null)
            setAsking(true)
          }}
          data-testid="rebirth-open"
        >
          {block ?? (
            <>
              환생하고 <FishIcon /> {rebirth.gain.toLocaleString()}마리 받기
            </>
          )}
        </button>
      )}
    </section>
  )
}
