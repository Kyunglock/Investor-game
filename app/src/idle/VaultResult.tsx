import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { scoreText } from './vaultBattle'

export type VaultClear =
  | {
      kind: 'floor'
      floor: number
      floors: number
      gold: number
      totalGold: number
      cards: string[]
    }
  | {
      kind: 'boss'
      damage: number
      early: boolean
      best: number
      /** 이번 판에 새로 닿은 등급. 없으면 null. */
      tierName: string | null
      nextTierName: string
      nextScore: number
      gold: number
    }

/**
 * 금고 도전의 클리어 화면 (decisions.md 654번): 던전 층을 깨거나 보스전을 마치면 결과와 받은 보상을 크게 보여 준다. 확인을 누르면 금고로
 * 돌아간다. 뒤로 가기는 VaultChallenges가 받는다.
 */
export function VaultResult({ result, onClose }: { result: VaultClear; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const root = dialog.current
    root?.showModal()
    return () => root?.close()
  }, [])
  const floor = result.kind === 'floor'
  const conquered = floor && result.floor >= result.floors
  return createPortal(
    <dialog
      ref={dialog}
      className="vault-result"
      data-testid="vault-result"
      data-kind={result.kind}
      aria-labelledby="vault-result-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <p className="vault-result-kicker">{floor ? '주간 던전' : '보스전 결과'}</p>
      <h2 id="vault-result-title">
        {floor
          ? conquered
            ? '금고 정복!'
            : `${result.floor}층 클리어!`
          : result.tierName
            ? `${result.tierName} 달성!`
            : '도전 종료'}
      </h2>
      {floor ? (
        <p>
          {result.floor} / {result.floors}층 돌파
          {conquered && ' · 이번 주 금고를 모두 열었어요'}
        </p>
      ) : (
        <p>
          피해량 <b data-testid="vault-result-damage">{scoreText(result.damage)}</b>
          {result.early && ' (멘탈 소진)'}
          <br />
          이번 주 최고 {scoreText(result.best)}
          {!result.tierName &&
            result.nextScore > result.best &&
            ` · ${result.nextTierName}까지 ${scoreText(result.nextScore - result.best)}`}
        </p>
      )}
      <div className="vault-result-reward" data-testid="vault-result-reward">
        <small>받은 보상</small>
        {result.gold > 0 ? (
          <b>
            <i className="vault-gold" aria-hidden />
            금괴 +{result.gold.toLocaleString('ko-KR')}
          </b>
        ) : (
          <b>새로 받은 보상 없음</b>
        )}
        {floor && <small>가진 금괴 {result.totalGold.toLocaleString('ko-KR')}</small>}
      </div>
      {floor && result.cards.length > 0 && (
        <p className="vault-result-cards">들고 있는 카드 · {result.cards.join(' · ')}</p>
      )}
      <button
        type="button"
        className="vault-result-ok"
        data-testid="vault-result-ok"
        onClick={onClose}
      >
        확인
      </button>
    </dialog>,
    document.body,
  )
}
