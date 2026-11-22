import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { CatPortrait } from './CatPortrait'
import {
  bossMarks,
  catDps,
  MARK_NAMES,
  type Matchup,
  type PartyMode,
  partyDps,
  recommendParty,
} from './party'
import { scoreText, VAULT_SIM, type Vault } from './vaultBattle'

type Cat = NonNullable<Company['idle']>['cats'][number]

/**
 * 금고 도전의 파티 칸 (decisions.md 653번): 입장하기 전에 데려갈 고양이를 고르고 저장한다. 보스전에서는 고양이마다 약점·내성·천적을 표시하고,
 * 상대의 배율을 넣은 예상 피해량과 추천 편성을 보여 준다.
 */
export function VaultParty({
  company,
  vault,
  mode,
  party,
  onChange,
}: {
  company: Company
  vault: Vault
  mode: PartyMode
  party: string[]
  onChange: (codes: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const slots = company.idle?.fieldSlots ?? 0
  const boss = mode === 'boss'
  const vs: Matchup = { vault, boss }
  const owned = (company.idle?.cats ?? []).filter((c) => c.level > 0)
  const byCode = new Map<string, Cat>(owned.map((c) => [c.code, c]))
  const members = party.flatMap((code) => byCode.get(code) ?? [])
  // 보스전은 정해진 시간 동안의 피해량을, 던전은 팀의 초당 화력을 적는다. 전투 시계는 실제 초보다 빠르다(VAULT_SIM).
  const total = (dps: number) => (boss ? dps * vault.boss.seconds * VAULT_SIM : dps)
  const estimate = total(partyDps(company, party, vs))
  const recommended = recommendParty(company, vs)
  const same = recommended.length === party.length && recommended.every((c) => party.includes(c))
  const shares = new Map(owned.map((c) => [c.code, total(catDps(company, c.code, vs))]))
  const ranked = [...owned].sort((a, b) => (shares.get(b.code) ?? 0) - (shares.get(a.code) ?? 0))
  const toggle = (code: string) => {
    sfx.tap()
    if (party.includes(code)) onChange(party.filter((c) => c !== code))
    else if (party.length < slots) onChange([...party, code])
    else haptic.error()
  }
  const marks = (cat: Cat) =>
    boss &&
    bossMarks(cat, vault.boss).map((mark) => (
      <em key={mark} className={`vault-mark is-${mark}`}>
        {MARK_NAMES[mark]}
      </em>
    ))
  return (
    <section className="vault-party" data-testid={`vault-party-${mode}`} aria-label="데려갈 파티">
      <header>
        <b>
          파티 {members.length} / {slots}
        </b>
        <span data-testid="vault-party-estimate">
          {boss ? '예상 피해량' : '팀 화력'} {scoreText(estimate)}
          {!boss && '/초'}
        </span>
      </header>
      <ul className="vault-party-row">
        {Array.from({ length: slots }, (_, i) => members[i] ?? null).map((cat, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 파티 칸은 자리 번호가 곧 열쇠다.
          <li key={i} className={cat ? '' : 'is-empty'}>
            {cat ? (
              <>
                <CatPortrait code={cat.code as CatCode} grade={cat.grade} />
                <small>Lv.{cat.level}</small>
                <span className="vault-marks">{marks(cat)}</span>
              </>
            ) : (
              <small>빈 칸</small>
            )}
          </li>
        ))}
      </ul>
      <div className="vault-party-actions">
        <button
          type="button"
          data-testid="vault-party-edit"
          aria-expanded={editing}
          onClick={() => {
            sfx.tap()
            setEditing(!editing)
          }}
        >
          {editing ? '편성 닫기' : '파티 편성'}
        </button>
        <button
          type="button"
          data-testid="vault-party-recommend"
          disabled={same}
          onClick={() => {
            sfx.tap()
            haptic.light()
            onChange(recommended)
          }}
        >
          {same ? '추천 편성 사용 중' : '추천 편성'}
        </button>
      </div>
      <p className="vault-party-note">
        {boss
          ? '약점 스킬·천적 고양이의 배율을 넣은 어림이에요(치명타·범위 피해 제외). 추천 편성은 이 값이 가장 큰 파티예요.'
          : '추천 편성은 팀 화력이 가장 큰 파티예요. 금고의 벽도 팀 화력만큼 단단해져요.'}
      </p>
      {editing && (
        <ul className="vault-party-pick" data-testid="vault-party-pick">
          {ranked.map((cat) => {
            const on = party.includes(cat.code)
            return (
              <li key={cat.code}>
                <button
                  type="button"
                  aria-pressed={on}
                  data-code={cat.code}
                  onClick={() => toggle(cat.code)}
                >
                  <CatPortrait code={cat.code as CatCode} grade={cat.grade} />
                  <span>
                    <b>
                      {cat.grade} {cat.name} <small>Lv.{cat.level}</small>
                    </b>
                    <small>
                      {boss ? '피해량' : '화력'} +{scoreText(shares.get(cat.code) ?? 0)}
                      {!boss && '/초'}
                    </small>
                    <span className="vault-marks">{marks(cat)}</span>
                  </span>
                  <i>{on ? '데려감' : party.length >= slots ? '칸 가득' : '추가'}</i>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
