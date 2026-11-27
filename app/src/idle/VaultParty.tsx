import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { CatFilters, DEFAULT_CAT_FILTER, filterCats } from './CatFilters'
import { CatPortrait } from './CatPortrait'
import { catDps, type Matchup, type PartyMode, partyDps, recommendParty } from './party'
import { scoreText, VAULT_SIM, type Vault } from './vaultBattle'
import './party-editor.css'

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
  const [filter, setFilter] = useState(DEFAULT_CAT_FILTER)
  const [pending, setPending] = useState<string | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [previous, setPrevious] = useState<string[] | null>(null)
  const [notice, setNotice] = useState('')
  const slots = company.idle?.fieldSlots ?? 0
  const boss = mode === 'boss'
  const vs: Matchup = { vault, boss }
  const owned = (company.idle?.cats ?? []).filter((c) => c.level > 0)
  const byCode = new Map(owned.map((c) => [c.code as string, c]))
  const total = (codes: string[]) =>
    partyDps(company, codes, vs) * (boss ? vault.boss.seconds * VAULT_SIM : 1)
  const estimate = total(party)
  const recommended = recommendParty(company, vs)
  const same = recommended.length === party.length && recommended.every((c) => party.includes(c))
  const shares = new Map(owned.map((c) => [c.code as string, catDps(company, c.code, vs)]))
  const visible = filterCats(owned, filter, party, (code) => shares.get(code) ?? 0)
  const candidate = pending ? byCode.get(pending) : undefined
  const commit = (next: string[], message: string) => {
    setPrevious([...party])
    onChange(next)
    setPending(null)
    setTarget(null)
    setNotice(message)
    sfx.tap()
    haptic.light()
  }
  const replace = (index: number, code: string) => {
    const next = [...party]
    const old = byCode.get(next[index])
    next[index] = code
    commit(next, `${old?.name ?? '빈 칸'} → ${byCode.get(code)?.name} 교체했어요`)
  }
  const pick = (code: string) => {
    if (party.includes(code)) {
      setTarget(party.indexOf(code))
      setPending(null)
      return
    }
    if (target !== null && target < party.length) {
      replace(target, code)
      return
    }
    if (party.length < slots) {
      commit([...party, code], `${byCode.get(code)?.name} 출전!`)
      return
    }
    setPending(code)
    setTarget(null)
    setNotice('')
  }
  return (
    <section className="vault-party" data-testid={`vault-party-${mode}`} aria-label="데려갈 파티">
      <header className="party-overview">
        <div>
          <small>{boss ? '보스전' : '주간던전'} 출전 팀</small>
          <b>
            파티 {party.length}
            <em> / {slots}</em>
          </b>
        </div>
        <span data-testid="vault-party-estimate">
          <small>{boss ? '예상 피해량' : '팀 화력'}</small>
          <strong>
            {scoreText(estimate)}
            {!boss && <small>/초</small>}
          </strong>
        </span>
      </header>
      <ul className="vault-party-row">
        {Array.from({ length: slots }, (_, index) => {
          const cat = byCode.get(party[index])
          const next = candidate
            ? party.map((code, i) => (i === index ? candidate.code : code))
            : party
          const delta = total(next) - estimate
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: 고정된 출전 자리 번호가 슬롯의 식별자다.
              key={`slot-${index}`}
              className={`${cat ? '' : 'is-empty'} ${target === index ? 'is-target' : ''} ${candidate ? 'is-replaceable' : ''}`}
            >
              <button
                type="button"
                className="party-slot"
                aria-pressed={target === index}
                aria-label={
                  cat
                    ? `${cat.name} ${candidate ? '대신 교체' : '자리 선택'}`
                    : `${index + 1}번 빈 칸 채우기`
                }
                onClick={() => {
                  setEditing(true)
                  if (candidate && cat) replace(index, candidate.code)
                  else {
                    setTarget(target === index ? null : index)
                    setPending(null)
                  }
                }}
              >
                <span className="party-slot-number">{index + 1}</span>
                {cat ? (
                  <>
                    <CatPortrait code={cat.code as CatCode} grade={cat.grade} />
                    <b>{cat.name}</b>
                    <small>
                      {cat.grade} · Lv.{cat.level}
                    </small>
                  </>
                ) : (
                  <>
                    <strong>＋</strong>
                    <small>고양이 추가</small>
                  </>
                )}
                {candidate && cat && (
                  <em className={delta >= 0 ? 'party-gain' : 'party-loss'}>
                    {delta >= 0 ? '+' : '−'}
                    {scoreText(Math.abs(delta))}
                  </em>
                )}
              </button>
              {editing && cat && (
                <button
                  type="button"
                  className="party-remove"
                  aria-label={`${cat.name} 출전 해제`}
                  onClick={() =>
                    commit(
                      party.filter((code) => code !== cat.code),
                      `${cat.name} 출전을 해제했어요`,
                    )
                  }
                >
                  빼기
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="vault-party-actions">
        <button
          type="button"
          data-testid="vault-party-edit"
          aria-expanded={editing}
          onClick={() => {
            setEditing(!editing)
            setPending(null)
            setTarget(null)
          }}
        >
          {editing ? '편성 완료' : '파티 편성'}
        </button>
        <button
          type="button"
          data-testid="vault-party-recommend"
          disabled={same || !slots || !owned.length}
          onClick={() => commit(recommended, '화력이 높은 고양이로 편성했어요')}
        >
          {same ? '추천 편성 중' : '추천 자동 편성'}
        </button>
        {previous && (
          <button
            type="button"
            className="party-undo"
            aria-label="이전 편성으로 되돌리기"
            onClick={() => {
              onChange(previous)
              setPrevious(null)
              setPending(null)
              setTarget(null)
              setNotice('이전 편성으로 되돌렸어요')
            }}
          >
            ↶ 되돌리기
          </button>
        )}
      </div>
      <p className="vault-party-note" role="status">
        {candidate
          ? `${candidate.name}와 바꿀 출전 칸을 누르세요. 화력 변화를 확인할 수 있어요.`
          : target !== null
            ? '아래에서 이 자리에 넣을 고양이를 고르세요.'
            : notice || '영구 강화 적용 · 일반 강화 제외 · 치명타·범위 피해는 예상에서 제외'}
      </p>
      {editing && (
        <div className="party-editor">
          <CatFilters value={filter} onChange={setFilter} count={visible.length} />
          <ul className="vault-party-pick" data-testid="vault-party-pick">
            {visible.map((cat) => {
              const on = party.includes(cat.code)
              return (
                <li key={cat.code}>
                  <button
                    type="button"
                    data-code={cat.code}
                    data-grade={cat.grade}
                    aria-pressed={on}
                    className={pending === cat.code ? 'is-candidate' : ''}
                    onClick={() => pick(cat.code)}
                  >
                    <span className="party-card-top">
                      <em>{cat.grade}</em>
                      <small>Lv.{cat.level}</small>
                    </span>
                    <CatPortrait code={cat.code as CatCode} grade={cat.grade} />
                    <b>{cat.name}</b>
                    <small className="party-card-skills">
                      {cat.skills.map((s) => s.name).join(' · ') || '기본 사격'}
                    </small>
                    <strong className="party-card-power">
                      {scoreText(shares.get(cat.code) ?? 0)}
                      <small>/초</small>
                    </strong>
                    <i>
                      {on
                        ? `출전 ${party.indexOf(cat.code) + 1}`
                        : pending === cat.code
                          ? '교체할 자리 선택'
                          : party.length >= slots
                            ? '교체'
                            : '출전시키기'}
                    </i>
                  </button>
                </li>
              )
            })}
          </ul>
          {!visible.length && (
            <p className="party-empty">
              {owned.length
                ? '조건에 맞는 고양이가 없어요.'
                : '고양이를 획득하면 여기서 팀을 꾸릴 수 있어요.'}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
