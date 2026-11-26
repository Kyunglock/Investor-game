import type { Company } from '@web/api/client'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { IDLE_GAME_SPEED } from '../mental/assault'
import guardianArt from '../mental/assets/vault-guard.webp'
import type { BattleHandle, Hud, Outcome } from '../mental/battle'
import { heroOf } from '../mental/hero'
import bossScene from './assets/vault-guardian.webp'
import dungeonScene from './assets/weekly-vault.webp'
import { idleLoadout } from './loadout'
import {
  bossEncounter,
  bossScale,
  bossTier,
  cardMods,
  dungeonEncounter,
  scoreText,
  teamScale,
  VAULT_SIM,
  type Vault,
  vaultLoadout,
} from './vaultBattle'

/** 입장 장면을 적어도 이만큼 보인다(ms). 전장이 그보다 늦게 열리면 열릴 때까지다. */
const INTRO_MS = 1800

/**
 * 금고 전투 한 판 (decisions.md 641번). 들어올 때의 팀과 금고(vault)로 판을 차린다: 보스전은 약점·내성·천적을 붙여 피해량을 겨루고,
 * 던전은 팀 화력만큼 단단한 벽에 고른 카드를 붙여 싸운다. 금고 훈련은 두 곳 모두에 붙는다.
 *
 * 들어설 때 금고 도전 창의 그림(수호냥·금고)을 화면 가득 보이는 입장 장면이 뜬다. 그동안 전투는 멈춰 있어 보스전의 시간이 줄지 않는다.
 */
export function VaultField({
  company,
  vault,
  boss,
  floor,
  party,
  onDone,
  onExit,
}: {
  company: Company
  vault: Vault
  boss: boolean
  floor: number
  /** 데려간 파티 (654번). 없으면 출전 칸의 고양이. */
  party?: string[]
  onDone: (result: Outcome) => void
  onExit: () => void
}) {
  const [setup] = useState(() => {
    const hero = heroOf(company)
    const team = idleLoadout(company, party)
    const scale = teamScale(team)
    const training = 1 + vault.trainingPercent / 100
    if (boss) {
      return {
        hero,
        loadout: vaultLoadout(team, { damage: training }),
        spec: bossEncounter(),
        vault: {
          mapWall: 151,
          guardianArt: bossScene,
          scale: bossScale(vault.boss),
          score: { seconds: vault.boss.seconds * VAULT_SIM, tier: bossTier },
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
  // 입장 장면: 정한 시간이 지나고 전장도 열려야 걷힌다. 열지 못했으면 바로 걷고 까닭을 적는다.
  const [held, setHeld] = useState(true)
  const intro = !error && (held || !hud)
  const handle = useRef<BattleHandle | undefined>(undefined)
  const waiting = useRef(true)
  const ready = hud !== null
  useEffect(() => {
    const timer = window.setTimeout(() => setHeld(false), INTRO_MS)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    waiting.current = intro
    // 전장이 열린 뒤에만 멈춘다: 열리기 전의 전투는 아직 멈출 것이 없다.
    if (ready) handle.current?.setPaused(intro || document.hidden)
  }, [intro, ready])
  useEffect(() => {
    dialog.current?.showModal()
    let closed = false
    let game: BattleHandle | undefined
    const visibility = () => game?.setPaused(document.hidden || waiting.current)
    document.addEventListener('visibilitychange', visibility)
    void import('../mental/battle')
      .then(({ startBattle }) => {
        if (closed || !host.current) return
        game = handle.current = startBattle(host.current, {
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
      handle.current = undefined
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
                피해량 {scoreText(hud.damage)}
                {hud.damage >= 10 && ` · ${bossTier(hud.damage).name}`} · {seconds}초
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
        <div className="vault-health">
          멘탈 {Math.ceil(hud.mental)} / {hud.maxMental}
          {!boss && <progress aria-label="멘탈" value={hud.mental} max={hud.maxMental} />}
        </div>
      )}
      {intro && (
        <div className="vault-intro" data-testid="vault-intro" role="status">
          <img className="vault-intro-back" src={boss ? bossScene : dungeonScene} alt="" />
          <img
            className={boss ? 'vault-intro-art vault-guardian-art' : 'vault-intro-art'}
            src={boss ? bossScene : dungeonScene}
            alt=""
          />
          <div>
            <small>{boss ? '보스전' : `주간 던전 · ${floor}층`}</small>
            <h2>{setup.spec.name}</h2>
            <p>{hud ? '곧 시작해요' : '전장을 여는 중…'}</p>
          </div>
        </div>
      )}
      {error && (
        <p className="vault-loading" role="status">
          {error}
        </p>
      )}
    </dialog>
  )
}
