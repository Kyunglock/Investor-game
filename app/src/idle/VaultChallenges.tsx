import { useEffect, useState } from 'react'
import { Sheet } from '../app/Sheet'
import { useModalBack } from '../app/useModalBack'
import guardian from './assets/vault-guardian.webp'
import dungeon from './assets/weekly-vault.webp'
import {
  enterVault,
  type Fight,
  heavyStrike,
  nextVaultWeek,
  playTurn,
  vaults,
  vaultWeek,
} from './vaultBattle'
import './vault-challenges.css'

type Mode = 'boss' | 'weekly'

function readRecord(key: string) {
  const value = Number(localStorage.getItem(key))
  return Number.isSafeInteger(value) && value > 0 ? value : 0
}

export function VaultChallenges({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  useModalBack(() => setOpen(false), open)
  return (
    <>
      <button type="button" className="vault-entry" onClick={() => setOpen(true)}>
        금고 도전
      </button>
      {open && (
        <Sheet title="금고 도전" onClose={() => setOpen(false)}>
          <VaultRoom companyId={companyId} />
        </Sheet>
      )}
    </>
  )
}

function VaultRoom({ companyId }: { companyId: string }) {
  const [week, setWeek] = useState(() => vaultWeek(Date.now()))
  useEffect(() => {
    const refresh = () => setWeek(vaultWeek(Date.now()))
    const timer = window.setTimeout(refresh, Math.max(0, nextVaultWeek(week) - Date.now()) + 10)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [week])
  return <Arena key={week} companyId={companyId} week={week} />
}

function Arena({ companyId, week }: { companyId: string; week: number }) {
  const bossKey = `vault.boss.${companyId}`
  const floorsKey = `vault.week.${companyId}.${week}`
  const [best, setBest] = useState(() => readRecord(bossKey))
  const [cleared, setCleared] = useState(() => Math.min(3, readRecord(floorsKey)))
  const [mode, setMode] = useState<Mode>('boss')
  const [fight, setFight] = useState<Fight | null>(null)
  const [floor, setFloor] = useState(1)
  const boss = mode === 'boss'
  const title = boss ? '흑금 수호냥' : vaults[week % vaults.length]
  const done = !boss && cleared === 3
  function start() {
    const next = boss ? 1 : cleared + 1
    setFloor(next)
    setFight(enterVault(boss ? 86 : 37 + next * 12, boss ? 0 : (week + next) % 3))
  }
  function act(guard: boolean) {
    if (!fight) return
    const after = playTurn(fight, guard)
    setFight(after)
    if (after.enemy > 0) return
    if (boss) {
      const record = Math.min(readRecord(bossKey) || Infinity, fight.round)
      localStorage.setItem(bossKey, String(record))
      setBest(record)
    } else if (vaultWeek(Date.now()) === week) {
      const record = Math.max(readRecord(floorsKey), floor)
      localStorage.setItem(floorsKey, String(record))
      setCleared(record)
    }
  }
  const playing = fight && fight.hp > 0 && fight.enemy > 0
  return (
    <div className="vault-room">
      <div className="vault-tabs">
        {(['boss', 'weekly'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={mode === item}
            disabled={Boolean(playing)}
            onClick={() => {
              setMode(item)
              setFight(null)
            }}
          >
            {item === 'boss' ? '보스전' : '주간 던전'}
          </button>
        ))}
      </div>
      <div className="vault-scene">
        <img
          src={boss ? guardian : dungeon}
          alt={
            boss
              ? '황금 갑옷을 두른 검은 고양이 수호자'
              : '수정 동굴 안쪽으로 이어지는 세 개의 금고'
          }
        />
        <div>
          <small>{boss ? '중앙 금고' : `주간 탐사 · ${cleared}/3층 돌파`}</small>
          <h4>{title}</h4>
        </div>
      </div>
      {!fight && (
        <p>
          {boss
            ? `수호냥의 강타를 막고 반격하세요. ${best ? `최고 기록 ${best}턴` : '첫 승리에 도전하세요.'}`
            : '한 층을 돌파할 때마다 기록됩니다. 매주 월요일 0시(한국 시간)에 새 금고가 열립니다.'}
        </p>
      )}
      {fight && (
        <div aria-live="polite">
          <strong>
            {boss
              ? title
              : `${floor}층 · ${['금고 파수꾼', '수정 골렘', '왕관 수호자'][floor - 1]}`}
          </strong>
          <label>
            적 체력 {fight.enemy}/{fight.maxEnemy}
            <progress value={fight.enemy} max={fight.maxEnemy} />
          </label>
          <label>
            내 체력 {fight.hp}/36
            <progress value={fight.hp} max={36} />
          </label>
          <p>{fight.log}</p>
          <b>
            {playing
              ? heavyStrike(fight)
                ? '강타 예고 · 방어하면 반격 충전'
                : '일반 공격 예고'
              : fight.hp === 0
                ? '도전 실패'
                : boss
                  ? `보스 격파 · ${fight.round - 1}턴 (최고 ${best}턴)`
                  : `${floor}층 돌파!`}
          </b>
        </div>
      )}
      {playing ? (
        <div className="vault-actions">
          <button type="button" onClick={() => act(false)}>
            {fight.charged ? '충전 반격' : '공격'}
          </button>
          <button type="button" onClick={() => act(true)}>
            방어
          </button>
        </div>
      ) : done ? (
        <strong>이번 주 금고 정복 완료</strong>
      ) : (
        <button className="vault-start" type="button" onClick={start}>
          {boss ? '보스 도전' : `${cleared + 1}층 입장`}
        </button>
      )}
    </div>
  )
}
