import type { Company } from '@web/api/client'
import { type UniqueActiveCode, useRaisingStore } from '@web/features/raising/store'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { ACTIVE_HINTS, ACTIVE_NOTES } from '../mental/actives'
import { ActiveBadge, ActiveTime } from './ActiveBadge'

type Active = NonNullable<NonNullable<Company['idle']>['actives']>[number]

const seconds = (value: number) => `${Math.round(value).toLocaleString()}초`

/** 장착 칸에서도 해제할 수 있어, 목록을 오가며 빈자리를 찾지 않아도 된다. */
export function IdleSkills({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const unique = (company.idle?.actives ?? []).filter((active) => !active.ad)
  const slots = company.idle?.activeSlots ?? 0
  const equipped = unique.filter((active) => active.equipped)
  const full = equipped.length >= slots
  const toggle = (active: Active) => {
    sfx.tap()
    haptic.light()
    void useRaisingStore.getState().equipActive(active.code as UniqueActiveCode, !active.equipped)
  }
  return (
    <div className="boss-skills" data-testid="skills">
      <section className="boss-skill-loadout" aria-label="장착 중인 스킬">
        <div className="boss-skill-header">
          <b>장착 중</b>
          <span role="status" aria-label={`${slots}칸 중 ${equipped.length}칸 장착`}>
            {equipped.length} / {slots}
          </span>
        </div>
        <ul className="boss-skill-slots" aria-label="장착 칸">
          {Array.from({ length: slots }, (_, i) => equipped[i] ?? null).map((active, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: 장착 칸은 자리 번호가 곧 열쇠다.
              key={i}
              className={active ? 'is-filled' : ''}
              data-testid="skill-slot"
              data-code={active?.code}
            >
              {active ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`${active.name} 해제`}
                  onClick={() => toggle(active)}
                >
                  <span className="boss-skill-slot-icon">
                    <ActiveBadge code={active.code} />
                  </span>
                  <span className="boss-skill-slot-name">{active.name}</span>
                  <span className="boss-skill-slot-remove" aria-hidden="true">
                    ×
                  </span>
                </button>
              ) : (
                <small>빈 칸</small>
              )}
            </li>
          ))}
        </ul>
        <p className="boss-skill-help" id="boss-skill-help">
          {full
            ? '다른 스킬을 쓰려면 위에서 하나를 눌러 해제하세요.'
            : '아래에서 스킬을 골라 빈 칸에 장착하세요.'}
        </p>
      </section>
      <div className="boss-skill-header">
        <b>사장냥 고유 스킬</b>
        <span>{unique.length}종</span>
      </div>
      <ul className="boss-skill-list" aria-label="고유 스킬">
        {unique.map((active) => (
          <li
            key={active.code}
            className={active.equipped ? 'is-equipped' : ''}
            data-testid="unique-skill"
            data-code={active.code}
            data-equipped={active.equipped}
          >
            <div className="boss-skill-main">
              <span
                className="boss-skill-art"
                role="img"
                aria-label={`${active.name} · ${ACTIVE_NOTES[active.code]}`}
              >
                <ActiveBadge code={active.code} />
              </span>
              <div className="boss-skill-info">
                <div className="boss-skill-title">
                  <b>{active.name}</b>
                  {active.equipped && <span className="boss-skill-status">장착 중</span>}
                </div>
                <p>{ACTIVE_HINTS[active.code]}</p>
              </div>
              <button
                type="button"
                className="boss-skill-equip"
                data-testid="skill-equip"
                aria-pressed={active.equipped}
                aria-label={`${active.name} ${active.equipped ? '해제' : full ? '장착 칸 없음' : '장착'}`}
                aria-describedby={!active.equipped && full ? 'boss-skill-help' : undefined}
                disabled={busy || (!active.equipped && full)}
                onClick={() => toggle(active)}
              >
                {active.equipped ? '해제' : '장착'}
              </button>
            </div>
            <details className="boss-skill-details">
              <summary aria-label={`${active.name} 설명`}>
                효과 자세히{' '}
                <span className="boss-skill-chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <p>{ACTIVE_NOTES[active.code]}</p>
              <span
                className="boss-skill-times"
                role="img"
                aria-label={`${active.seconds > 0 ? `지속 ${seconds(active.seconds)}` : '바로 발동'} · 재사용 대기 ${seconds(active.cooldown)}`}
              >
                <span>
                  {active.seconds > 0 ? '지속' : '즉시'} <ActiveTime seconds={active.seconds} />
                </span>
                <span>
                  재사용 <ActiveTime seconds={active.cooldown} cooldown />
                </span>
              </span>
            </details>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
