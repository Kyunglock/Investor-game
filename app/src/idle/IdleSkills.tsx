import type { Company } from '@web/api/client'
import { type UniqueActiveCode, useRaisingStore } from '@web/features/raising/store'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { ACTIVE_NOTES } from '../mental/actives'
import { ActiveBadge, ActiveTime } from './ActiveBadge'

type Active = NonNullable<NonNullable<Company['idle']>['actives']>[number]

const seconds = (value: number) => `${Math.round(value).toLocaleString()}초`

/**
 * 스킬 탭 (decisions.md 587번): 사장냥의 고유 스킬(매수세례·불장·방어선 구축, 591번의 상한가·손절·물타기)을 보고 장착한다. 위에 장착 칸(셋), 아래에 스킬 목록이 있다.
 * 장착한 스킬만 전투 화면 오른쪽에 단추가 선다. 맨 아래에는 장착하지 않고 광고를 보면 쓰는 광고 스킬(588번)을 알린다.
 */
export function IdleSkills({ company }: { company: Company }) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const actives = company.idle?.actives ?? []
  const unique = actives.filter((active) => !active.ad)
  const ads = actives.filter((active) => active.ad)
  const slots = company.idle?.activeSlots ?? 0
  const equipped = unique.filter((active) => active.equipped)
  const full = equipped.length >= slots
  const toggle = (active: Active) => {
    sfx.tap()
    haptic.light()
    void useRaisingStore.getState().equipActive(active.code as UniqueActiveCode, !active.equipped)
  }
  const info = (active: Active) => (
    <>
      <span
        className="boss-skill-art"
        role="img"
        aria-label={`${active.name} · ${ACTIVE_NOTES[active.code]}`}
      >
        <ActiveBadge code={active.code} />
      </span>
      <span
        className="boss-skill-times"
        role="img"
        aria-label={`${active.seconds > 0 ? `지속 ${seconds(active.seconds)}` : '바로 발동'} · 재사용 대기 ${seconds(active.cooldown)}`}
      >
        <ActiveTime seconds={active.seconds} />
        <ActiveTime seconds={active.cooldown} cooldown />
      </span>
      <details className="boss-skill-details">
        <summary aria-label={`${active.name} 설명`}>ⓘ</summary>
        <b>{active.name}</b>
        <p>{ACTIVE_NOTES[active.code]}</p>
        <p>
          {active.seconds > 0 ? `지속 ${seconds(active.seconds)}` : '바로 발동'} · 재사용 대기{' '}
          {seconds(active.cooldown)}
        </p>
      </details>
    </>
  )
  return (
    <div className="boss-skills" data-testid="skills">
      <p className="idle-subtitle">
        사장냥의 고유 스킬 · 장착 {equipped.length} / {slots} · 장착한 스킬만 전투 화면에 단추가
        서요
      </p>
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
              <span className="boss-skill-slot-icon" role="img" aria-label={active.name}>
                <ActiveBadge code={active.code} />
              </span>
            ) : (
              <small>빈 칸</small>
            )}
          </li>
        ))}
      </ul>
      <ul className="boss-skill-list" aria-label="고유 스킬">
        {unique.map((active) => (
          <li
            key={active.code}
            className={active.equipped ? 'is-equipped' : ''}
            data-testid="unique-skill"
            data-code={active.code}
            data-equipped={active.equipped}
          >
            {info(active)}
            <button
              type="button"
              className="boss-skill-equip"
              data-testid="skill-equip"
              aria-pressed={active.equipped}
              aria-label={`${active.name} ${active.equipped ? '빼기' : full ? '장착 칸 없음' : '장착'}`}
              disabled={busy || (!active.equipped && full)}
              onClick={() => toggle(active)}
            >
              {active.equipped ? '빼기' : full ? '칸 없음' : '장착'}
            </button>
          </li>
        ))}
      </ul>
      {ads.length > 0 && (
        <>
          <b className="boss-skill-heading">광고 스킬</b>
          <p className="idle-subtitle">
            장착하지 않아도 전투 화면 왼쪽에 늘 있어요 · 광고를 보면 바로 써요
          </p>
          <ul className="boss-skill-list" aria-label="광고 스킬">
            {ads.map((active) => (
              <li key={active.code} data-testid="ad-skill" data-code={active.code}>
                {info(active)}
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
