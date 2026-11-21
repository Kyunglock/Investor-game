import type { Company } from '@web/api/client'
import { useEffect, useState } from 'react'
import { Sheet } from '../app/Sheet'
import { useModalBack } from '../app/useModalBack'
import type { Outcome } from '../mental/battle'
import guardian from './assets/vault-guardian.webp'
import dungeon from './assets/weekly-vault.webp'
import { VaultField } from './VaultField'
import { nextVaultWeek, vaults, vaultWeek } from './vaultBattle'
import './vault-challenges.css'

function record(key: string) {
  const n = Number(localStorage.getItem(key))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function VaultChallenges({
  company,
  onBattleChange,
}: {
  company: Company
  onBattleChange: (active: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [boss, setBoss] = useState(true)
  const [week, setWeek] = useState(() => vaultWeek(Date.now()))
  const [run, setRun] = useState<{ floor: number; week: number } | null>(null)
  const [result, setResult] = useState('')
  const floorsKey = `vault.week.${company.companyId}.${week}`
  const timeKey = `vault.boss.seconds.${company.companyId}`
  const cleared = Math.min(3, record(floorsKey))
  const best = record(timeKey)
  useEffect(() => {
    if (!open) return
    const refresh = () => setWeek(vaultWeek(Date.now()))
    refresh()
    const timer = window.setTimeout(refresh, Math.max(0, nextVaultWeek(week) - Date.now()) + 10)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [week, open])
  useEffect(() => () => onBattleChange(false), [onBattleChange])
  function leaveField() {
    setRun(null)
    onBattleChange(false)
  }
  useModalBack(() => {
    if (run) leaveField()
    else setOpen(false)
  }, open)
  function end(outcome: Outcome) {
    if (!run) return
    if (outcome.win && boss) {
      localStorage.setItem(timeKey, String(Math.min(record(timeKey) || Infinity, outcome.seconds)))
    } else if (outcome.win && run.week === vaultWeek(Date.now())) {
      localStorage.setItem(floorsKey, String(Math.max(record(floorsKey), run.floor)))
    }
    setResult(
      outcome.win
        ? `${boss ? '수호냥 격파' : run.floor + '층 돌파'} · ${outcome.seconds}초`
        : outcome.reason === 'time'
          ? '시간 초과'
          : '멘탈 소진',
    )
    leaveField()
  }
  return (
    <>
      <button
        type="button"
        className="vault-entry"
        onClick={() => {
          setResult('')
          setOpen(true)
        }}
      >
        금고 도전
      </button>
      {run ? (
        <VaultField
          company={company}
          boss={boss}
          floor={run.floor}
          week={run.week}
          onDone={end}
          onExit={leaveField}
        />
      ) : (
        open && (
          <Sheet title="금고 도전" onClose={() => setOpen(false)}>
            <div className="vault-room">
              <div className="vault-tabs">
                {[true, false].map((mode) => (
                  <button
                    key={String(mode)}
                    type="button"
                    aria-pressed={mode === boss}
                    onClick={() => {
                      setBoss(mode)
                      setResult('')
                    }}
                  >
                    {mode ? '보스전' : '주간 던전'}
                  </button>
                ))}
              </div>
              <div className="vault-scene">
                <img src={boss ? guardian : dungeon} alt="" />
                <div>
                  <small>{boss ? '중앙 금고' : `주간 탐사 · ${cleared}/3층 돌파`}</small>
                  <h4>{boss ? '흑금 수호냥' : vaults[week % vaults.length]}</h4>
                </div>
              </div>
              {result && <strong role="status">{result}</strong>}
              <p>
                {boss
                  ? `출전 중인 고양이들과 수호냥의 대량 매도벽을 돌파하세요.${best ? ' 최고 기록 ' + best + '초' : ''}`
                  : '고양이들과 매도벽을 뚫고 층마다 기다리는 수호냥을 격파하세요. 매주 월요일 0시(한국 시간)에 새 금고가 열립니다.'}
              </p>
              {!boss && cleared >= 3 ? (
                <strong>이번 주 금고 정복 완료</strong>
              ) : (
                <button
                  type="button"
                  className="vault-start"
                  onClick={() => {
                    setResult('')
                    setRun({ floor: boss ? 1 : cleared + 1, week })
                    onBattleChange(true)
                  }}
                >
                  {boss ? '보스 도전' : `${cleared + 1}층 입장`}
                </button>
              )}
            </div>
          </Sheet>
        )
      )}
    </>
  )
}
