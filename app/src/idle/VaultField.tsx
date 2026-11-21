import type { Company } from '@web/api/client'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { IDLE_GAME_SPEED } from '../mental/assault'
import guardianArt from '../mental/assets/vault-guard.webp'
import type { BattleHandle, Hud, Outcome } from '../mental/battle'
import { heroOf } from '../mental/hero'
import { idleLoadout } from './loadout'
import {
  bossEncounter,
  bossScale,
  cardMods,
  dungeonEncounter,
  scoreText,
  teamScale,
  VAULT_SIM,
  type Vault,
  vaultLoadout,
} from './vaultBattle'

/**
 * 금고 전투 한 판 (decisions.md 641번). 들어올 때의 팀과 금고(vault)로 판을 차린다: 보스전은 약점·내성·천적을 붙여 피해량을 겨루고,
 * 던전은 팀 화력만큼 단단한 벽에 고른 카드를 붙여 싸운다. 금고 훈련은 두 곳 모두에 붙는다.
 */
export function VaultField({
  company,
  vault,
  boss,
  floor,
  onDone,
  onExit,
}: {
  company: Company
  vault: Vault
  boss: boolean
  floor: number
  onDone: (result: Outcome) => void
  onExit: () => void
}) {
  const [setup] = useState(() => {
    const hero = heroOf(company)
    const team = idleLoadout(company)
    const scale = teamScale(team)
    const training = 1 + vault.trainingPercent / 100
    if (boss) {
      return {
        hero,
        loadout: vaultLoadout(
          team,
          { damage: training },
          vault.boss.rivals.map((cat) => cat.code),
          vault.boss.rivalPercent / 100,
        ),
        spec: bossEncounter(),
        vault: {
          mapWall: 151,
          guardianArt,
          scale: bossScale(vault.boss),
          score: { seconds: vault.boss.seconds * VAULT_SIM },
        },
      }
    }
    const mods = cardMods(vault.dungeon.cards)
    return {
      hero,
      loadout: vaultLoadout(team, { ...mods, damage: mods.damage * training }),
      spec: dungeonEncounter(floor, vault.week, scale, vault.dungeon.cards),
      vault: { mapWall: 1 + 50 * ((vault.week + floor) % 4), guardianArt },
    }
  })
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
          assault: setup.spec,
          hero: setup.hero,
          loadout: setup.loadout,
          vault: setup.vault,
          onHud: setHud,
          onError: setError,
          onBanner: () => {},
          onHurt: () => {},
          onLevelUp: () => {
            game?.applyLoadout(setup.loadout)
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
  }, [setup])
  // 전투 시계는 실제 시간보다 느리게 돈다 (gameSpeed.ts): 남은 시간은 실제 초로 적는다.
  const seconds = hud ? Math.ceil(hud.secondsLeft / VAULT_SIM) : 0
  return (
    <dialog
      ref={dialog}
      className="vault-field"
      data-testid="vault-field"
      aria-label={setup.spec.name}
      onCancel={(e) => {
        e.preventDefault()
        onExit()
      }}
    >
      <div className="vault-canvas" ref={host} />
      <header>
        <div>
          <b>
            {setup.spec.name}
            {!boss && ` · ${floor}층`}
          </b>
          {hud &&
            (boss ? (
              <small data-testid="vault-score">
                피해량 {scoreText(hud.damage)} · {seconds}초
              </small>
            ) : (
              <small>
                매도벽 {hud.segment?.at}/{setup.spec.walls.length} · {seconds}초
              </small>
            ))}
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
