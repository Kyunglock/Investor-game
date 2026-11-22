import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useState } from 'react'
import { Sheet } from '../app/Sheet'
import { useModalBack } from '../app/useModalBack'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import type { Outcome } from '../mental/battle'
import guardian from './assets/vault-guardian.webp'
import dungeonArt from './assets/weekly-vault.webp'
import { type PartyMode, partyOf, readParty, saveParty } from './party'
import { VaultField } from './VaultField'
import { VaultParty } from './VaultParty'
import { type VaultClear, VaultResult } from './VaultResult'
import { GUARDIAN, leftText, scoreText, type Vault, type VaultCard, vaults } from './vaultBattle'
import './vault-challenges.css'

type Tab = 'boss' | 'dungeon' | 'shop'
const TABS: readonly [Tab, string][] = [
  ['boss', '보스전'],
  ['dungeon', '주간 던전'],
  ['shop', '금고 상점'],
]
const OFFLINE = '연결이 끊겼어요. 다시 시도해 주세요.'

const times = (percent: number) => `×${percent / 100}`

/**
 * 금고 도전 (decisions.md 641번): 보스전·주간 던전·금고 상점. 규칙과 보상은 서버(company.vault)가 정하고, 전투가 끝나면 결과를 알려
 * 금괴를 받는다.
 */
export function VaultChallenges({
  company,
  onBattleChange,
}: {
  company: Company
  onBattleChange: (active: boolean) => void
}) {
  const vault = company.vault
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('boss')
  const [run, setRun] = useState<{
    boss: boolean
    floor: number
    vault: Vault
    party: string[]
  } | null>(null)
  // 저장한 파티 (654번): 보스전·던전마다 따로. 저장한 적이 없으면 null이고, 그때는 출전 칸의 고양이를 데려간다.
  const [saved, setSaved] = useState<Record<PartyMode, string[] | null>>(() => ({
    boss: readParty(company.companyId, 'boss'),
    dungeon: readParty(company.companyId, 'dungeon'),
  }))
  // 클리어 화면 (654번): 던전 층을 깨거나 보스전을 마치면 받은 것을 크게 보여 준다.
  const [result, setResult] = useState<VaultClear | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!open) return
    const tick = () => setNow(Date.now())
    tick()
    const timer = window.setInterval(tick, 30_000)
    return () => window.clearInterval(timer)
  }, [open])
  useEffect(() => () => onBattleChange(false), [onBattleChange])
  function leaveField() {
    setRun(null)
    onBattleChange(false)
  }
  useModalBack(() => {
    if (result) setResult(null)
    else if (run) leaveField()
    else setOpen(false)
  }, open)
  if (!vault) return null

  /** 서버에 알리고 받은 것을 한 줄로 적는다. 끊겼으면 그 까닭을 적는다. */
  async function send(call: () => Promise<Company | null>, done: (after: Vault) => string) {
    if (busy) return
    setBusy(true)
    try {
      const after = (await call())?.vault
      if (!after) {
        setNote(useRaisingStore.getState().error ?? OFFLINE)
        return
      }
      setNote(done(after))
    } finally {
      setBusy(false)
    }
  }

  function end(outcome: Outcome) {
    if (!run) return
    const { boss, floor, party } = run
    const gold = vault?.gold ?? 0
    const tier = vault?.boss.tier ?? 0
    leaveField()
    const store = useRaisingStore.getState()
    if (boss) {
      const early = outcome.reason === 'mental' ? ' (멘탈 소진)' : ''
      void send(
        () => store.reportVaultBoss(outcome.damage, party),
        (after) => {
          const gained = after.gold - gold
          if (gained > 0) sfx.levelUp()
          setResult({
            kind: 'boss',
            damage: outcome.damage,
            early: outcome.reason === 'mental',
            best: after.boss.best,
            tierName: after.boss.tier > tier ? after.boss.tierName : null,
            nextTierName: after.boss.nextTierName,
            nextScore: after.boss.nextScore,
            gold: gained,
          })
          return `피해량 ${scoreText(outcome.damage)}${early}${gained > 0 ? ` · ${after.boss.tierName} 달성 · 금괴 +${gained}` : ''}`
        },
      )
    } else if (outcome.win) {
      void send(
        () => store.clearVaultFloor(floor),
        (after) => {
          sfx.levelUp()
          setResult({
            kind: 'floor',
            floor,
            floors: after.dungeon.floors,
            gold: after.gold - gold,
            totalGold: after.gold,
            cards: after.dungeon.cards.map((card) => card.name),
          })
          return `${floor}층 돌파 · 금괴 +${after.gold - gold}`
        },
      )
    } else {
      setNote(
        outcome.reason === 'time'
          ? '시간 초과 · 카드와 금고 훈련으로 다시 도전하세요'
          : '멘탈 소진 · 다시 도전하세요',
      )
    }
  }

  const partyFor = (mode: PartyMode) => partyOf(company, saved[mode])
  const changeParty = (mode: PartyMode, codes: string[]) => {
    saveParty(company.companyId, mode, codes)
    setSaved((now) => ({ ...now, [mode]: codes }))
  }

  function start(boss: boolean) {
    if (!vault) return
    setNote('')
    setResult(null)
    setRun({
      boss,
      floor: vault.dungeon.cleared + 1,
      vault,
      party: partyFor(boss ? 'boss' : 'dungeon'),
    })
    onBattleChange(true)
  }

  const store = useRaisingStore.getState()
  const cats = company.idle?.cats ?? []
  const { boss, dungeon } = vault
  // 약점·내성·천적 칸의 "출전 중"은 돌파의 출전 칸이 아니라 보스전에 데려갈 파티를 따른다 (655번).
  const bossParty = partyOf(company, saved.boss)
  const status = (cat?: { code: string; level: number }) =>
    !cat || cat.level <= 0 ? '없음' : bossParty.includes(cat.code) ? '출전 중' : '대기'
  /** 그 스킬을 가진 고양이와 그 고양이의 상태. */
  const owner = (code: string) => {
    const cat = cats.find((c) => c.skills.some((skill) => skill.code === code))
    return cat && { name: cat.name, state: status(cat) }
  }
  const floor = dungeon.cleared + 1
  const conquered = dungeon.cleared >= dungeon.floors
  const fill = boss.nextScore > 0 ? Math.min(1, boss.best / boss.nextScore) : 0

  return (
    <>
      <button
        type="button"
        className="vault-entry"
        data-testid="vault-entry"
        onClick={() => {
          setNote('')
          setOpen(true)
        }}
      >
        금고 도전
      </button>
      {result && !run && <VaultResult result={result} onClose={() => setResult(null)} />}
      {run ? (
        <VaultField
          company={company}
          vault={run.vault}
          boss={run.boss}
          floor={run.floor}
          party={run.party}
          onDone={end}
          onExit={leaveField}
        />
      ) : (
        open && (
          <Sheet title="금고 도전" testId="vault-sheet" onClose={() => setOpen(false)}>
            <div className="vault-room">
              <div className="vault-wallet">
                <b data-testid="vault-gold">
                  <i className="vault-gold" aria-hidden />
                  <span className="sr-only">금괴 </span>
                  {vault.gold.toLocaleString('ko-KR')}
                </b>
                <span>새 금고까지 {leftText(vault.resetsAt - now)}</span>
              </div>
              <div className="vault-tabs">
                {TABS.map(([code, name]) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={code === tab}
                    onClick={() => {
                      setTab(code)
                      setNote('')
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {note && (
                <strong className="vault-note" role="status" data-testid="vault-note">
                  {note}
                </strong>
              )}
              {tab === 'boss' && (
                <>
                  <div className="vault-scene">
                    <img src={guardian} alt="" />
                    <div>
                      <small>
                        이번 주 {boss.tier > 0 ? boss.tierName : '기록 없음'}
                        {boss.best > 0 && ` · 최고 ${scoreText(boss.best)}`}
                      </small>
                      <h4>{GUARDIAN}</h4>
                    </div>
                  </div>
                  <p>
                    {boss.seconds}초 동안 넣은 피해량을 겨뤄요. 등급을 하나 올릴 때마다 금괴{' '}
                    {boss.tierGold}개를 받고, 등급은 매주 다시 받을 수 있어요.
                  </p>
                  <div className="vault-tier">
                    <span>
                      다음 등급 <b>{boss.nextTierName}</b>
                    </span>
                    <span>
                      {scoreText(boss.best)} / {scoreText(boss.nextScore)}
                    </span>
                    <progress value={fill} max={1} />
                    {boss.record > 0 && <small>역대 최고 {scoreText(boss.record)}</small>}
                  </div>
                  <dl className="vault-traits" data-testid="vault-traits">
                    <dt className="weak">약점 스킬 {times(boss.weakPercent)}</dt>
                    <dd>
                      {boss.weakSkills.map((skill) => (
                        <Trait key={skill.code} name={skill.name} cat={owner(skill.code)} />
                      ))}
                    </dd>
                    <dt className="resist">내성 스킬 {times(boss.resistPercent)}</dt>
                    <dd>
                      {boss.resistSkills.map((skill) => (
                        <Trait key={skill.code} name={skill.name} cat={owner(skill.code)} />
                      ))}
                    </dd>
                    <dt className="weak">천적 고양이 · 총 피해 {times(boss.rivalPercent)}</dt>
                    <dd>
                      {boss.rivals.map((rival) => (
                        <Trait
                          key={rival.code}
                          name={`${rival.grade} ${rival.name}`}
                          cat={{
                            name: '',
                            state: status(cats.find((cat) => cat.code === rival.code)),
                          }}
                        />
                      ))}
                    </dd>
                  </dl>
                  <VaultParty
                    company={company}
                    vault={vault}
                    mode="boss"
                    party={partyFor('boss')}
                    onChange={(codes) => changeParty('boss', codes)}
                  />
                  <button
                    type="button"
                    className="vault-start"
                    disabled={busy}
                    onClick={() => start(true)}
                  >
                    보스 도전
                  </button>
                </>
              )}
              {tab === 'dungeon' && (
                <>
                  <div className="vault-scene">
                    <img src={dungeonArt} alt="" />
                    <div>
                      <small>
                        주간 탐사 · {dungeon.cleared}/{dungeon.floors}층 돌파
                      </small>
                      <h4>{vaults[vault.week % vaults.length]}</h4>
                    </div>
                  </div>
                  <p>
                    금고의 벽은 출전한 팀의 화력만큼 단단해져요. 층마다 카드를 한 장 골라 그 주 내내
                    들고 싸워요.
                  </p>
                  {dungeon.cards.length > 0 && (
                    <ul className="vault-cards" data-testid="vault-picked">
                      {dungeon.cards.map((card) => (
                        <li key={card.code}>
                          <b>{card.name}</b>
                          <span>{card.effect}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {conquered ? (
                    <strong>이번 주 금고 정복 완료</strong>
                  ) : dungeon.offers.length > 0 ? (
                    <>
                      <strong>{floor}층에 들고 갈 카드를 고르세요</strong>
                      <div className="vault-offers" data-testid="vault-offers">
                        {dungeon.offers.map((card: VaultCard) => (
                          <button
                            key={card.code}
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              sfx.tap()
                              void send(
                                () => store.pickVaultCard(card.code),
                                () => {
                                  haptic.light()
                                  return `${card.name} 카드를 골랐어요`
                                },
                              )
                            }}
                          >
                            <b>{card.name}</b>
                            <span>{card.effect}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <VaultParty
                        company={company}
                        vault={vault}
                        mode="dungeon"
                        party={partyFor('dungeon')}
                        onChange={(codes) => changeParty('dungeon', codes)}
                      />
                      <button
                        type="button"
                        className="vault-start"
                        disabled={busy}
                        onClick={() => start(false)}
                      >
                        {floor}층 입장 · 금괴 +{dungeon.floorGold[floor - 1]}
                      </button>
                    </>
                  )}
                </>
              )}
              {tab === 'shop' && (
                <ul className="vault-shop" data-testid="vault-shop">
                  {vault.shop.map((item) => {
                    const out = item.left <= 0
                    return (
                      <li key={item.code}>
                        <div>
                          <b>
                            {item.name}
                            {item.level != null && ` Lv.${item.level}`}
                          </b>
                          <span>{item.description}</span>
                          {item.weeklyLimit > 0 && (
                            <small className="vault-left">
                              이번 주 {item.left}/{item.weeklyLimit}
                            </small>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={busy || out || vault.gold < item.price}
                          onClick={() => {
                            sfx.tap()
                            void send(
                              () => store.buyVaultItem(item.code),
                              (after) => {
                                haptic.light()
                                sfx.levelUp()
                                return after.lastNote ?? `${item.name} 구매`
                              },
                            )
                          }}
                        >
                          {out ? (
                            item.weeklyLimit > 0 ? (
                              '품절'
                            ) : (
                              '최대'
                            )
                          ) : (
                            <>
                              <i className="vault-gold" aria-hidden />
                              <span className="sr-only">금괴 </span>
                              {item.price}
                            </>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Sheet>
        )
      )}
    </>
  )
}

/** 약점·내성·천적 한 칸: 이름과, 그것을 가진 고양이가 출전 중인지. */
function Trait({ name, cat }: { name: string; cat?: { name: string; state: string } }) {
  return (
    <span className="vault-trait" data-state={cat?.state ?? '없음'}>
      <b>{name}</b>
      {cat && (
        <small>
          {cat.name && `${cat.name} · `}
          {cat.state}
        </small>
      )}
    </span>
  )
}
