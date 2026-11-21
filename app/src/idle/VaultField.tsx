import type { Company } from '@web/api/client'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { IDLE_GAME_SPEED } from '../mental/assault'
import guardianArt from '../mental/assets/vault-guard.webp'
import type { BattleHandle, Hud, Outcome } from '../mental/battle'
import { heroOf } from '../mental/hero'
import { idleLoadout } from './loadout'
import { vaultEncounter } from './vaultBattle'

export function VaultField({
  company,
  boss,
  floor,
  week,
  onDone,
  onExit,
}: {
  company: Company
  boss: boolean
  floor: number
  week: number
  onDone: (result: Outcome) => void
  onExit: () => void
}) {
  const [party] = useState(() => ({ hero: heroOf(company), loadout: idleLoadout(company) }))
  const [spec] = useState(() => vaultEncounter(boss, floor, week))
  const [hud, setHud] = useState<Hud | null>(null)
  const [error, setError] = useState('')
  const host = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const finish = useEffectEvent(onDone)
  useEffect(() => {
    dialog.current?.showModal()
    let closed = false
    let game: BattleHandle | undefined
    const visibility = () => game?.setPaused(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    void import('../mental/battle')
      .then(({ startBattle }) => {
        if (closed || !host.current) return
        game = startBattle(host.current, {
          mode: 'assault',
          genre: 'DEFENSE',
          speed: IDLE_GAME_SPEED,
          assault: spec,
          ...party,
          vault: { mapWall: boss ? 151 : 1 + 50 * ((week + floor) % 4), guardianArt },
          onHud: setHud,
          onError: setError,
          onBanner: () => {},
          onHurt: () => {},
          onLevelUp: () => {
            game?.applyLoadout(party.loadout)
            visibility()
          },
          onDone: (result) => {
            if (!closed) finish(result)
          },
        })
      })
      .catch(() => {
        if (!closed) setError('전장을 열지 못했어요. 나갔다가 다시 입장해 주세요.')
      })
    return () => {
      closed = true
      game?.stop()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [boss, floor, week, party, spec])
  return (
    <dialog
      ref={dialog}
      className="vault-field"
      aria-label={spec.name}
      onCancel={(e) => {
        e.preventDefault()
        onExit()
      }}
    >
      <div className="vault-canvas" ref={host} />
      <header>
        <div>
          <b>
            {spec.name}
            {!boss && ` · ${floor}층`}
          </b>
          {hud && (
            <small>
              매도벽 {hud.segment?.at}/{spec.walls.length} · {Math.ceil(hud.secondsLeft)}초
            </small>
          )}
        </div>
        <button type="button" onClick={onExit}>
          나가기
        </button>
      </header>
      {hud && (
        <label className="vault-health">
          멘탈 {Math.ceil(hud.mental)} / {hud.maxMental}
          <progress value={hud.mental} max={hud.maxMental} />
        </label>
      )}
      {(!hud || error) && (
        <p className="vault-loading" role="status">
          {error || '전장을 여는 중…'}
        </p>
      )}
    </dialog>
  )
}
