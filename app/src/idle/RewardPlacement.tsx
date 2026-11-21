import type { Company } from '@web/api/client'
import { type CatCode, useRaisingStore } from '@web/features/raising/store'
import { useEffect, useRef, useState } from 'react'
import { haptic } from '../fx/haptics'
import { GunSprite } from '../mental/GunSprite'
import type { Weapon } from '../mental/hero'
import { CatPortrait } from './CatPortrait'
import { fieldSeats } from './seats'
import { useLoadoutDrag } from './useLoadoutDrag'

export type Reward = { cat: CatCode } | { weapon: Pick<Weapon, 'kind' | 'grade'> }

/** 뽑기 결과 안에서 곧바로 놓는다. 전투 팀은 서버 응답을 따라가며 빈 자리·교체를 같은 요청으로 처리한다. */
export function RewardPlacement({
  company,
  reward,
  onDone,
}: {
  company: Company
  reward: Reward
  onDone: (code: CatCode | null) => void
}) {
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const [picked, setPicked] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const cats = company.idle?.cats ?? []
  const alreadyFielded = 'cat' in reward && cats.some((c) => c.code === reward.cat && c.fielded)
  const targets = [
    ...('weapon' in reward ? [{ id: 'boss', code: null as CatCode | null, name: '사장냥' }] : []),
    // 출전 칸 그대로 (599번): 빈 칸에 놓으면 그 칸에 선다.
    ...fieldSeats(cats, company.idle?.fieldSlots ?? 0)
      .map((seat, i) => ({
        id: seat?.code ?? `empty${i}`,
        code: seat?.code ?? null,
        name: seat?.name ?? '빈 칸',
        slot: i,
      }))
      .filter((t) => 'cat' in reward || t.code !== null),
  ]
  const place = async (target: string) => {
    if (useRaisingStore.getState().busy) return
    const t = targets.find((t) => `reward:${t.id}` === target)
    if (!t) return
    const store = useRaisingStore.getState()
    if ('cat' in reward) {
      if (!alreadyFielded)
        await store.fieldCat(
          reward.cat,
          true,
          t.code ?? undefined,
          t.code || !('slot' in t) ? undefined : t.slot,
        )
    } else if (t.code) await store.equipCat(t.code, reward.weapon)
    else await store.equipWeapon(reward.weapon.kind, reward.weapon.grade)
    if (mounted.current && !useRaisingStore.getState().error) {
      haptic.light()
      onDone('cat' in reward ? reward.cat : t.code)
    }
  }
  const { drag, down, consumeClick } = useLoadoutDrag<Reward>(
    (_, target) => !busy && targets.some((t) => `reward:${t.id}` === target),
    (_, target) => {
      void place(target)
    },
  )
  return (
    <section
      className="reward-placement"
      aria-label="획득한 보상 사용"
      data-testid="reward-placement"
    >
      {alreadyFielded ? (
        <button type="button" onClick={() => onDone('cat' in reward ? reward.cat : null)}>
          출전 중 · 팀으로 돌아가기
        </button>
      ) : (
        <>
          <button
            type="button"
            className={`reward-grab ${drag ? 'is-grabbed' : ''}`}
            disabled={busy}
            aria-pressed={picked}
            onPointerDown={busy ? undefined : down(reward)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(event) => {
              if (!consumeClick(event.detail)) setPicked(!picked)
            }}
            data-testid="reward-grab"
          >
            {'cat' in reward ? (
              <CatPortrait
                grade={cats.find((c) => c.code === reward.cat)?.grade}
                code={reward.cat}
              />
            ) : (
              <GunSprite kind={reward.weapon.kind} grade={reward.weapon.grade} width={56} />
            )}
            <span>{'cat' in reward ? '집어서 출전 칸에 놓기' : '집어서 고양이에게 장착'}</span>
          </button>
          <div className="reward-targets">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={busy || (!picked && !drag)}
                className={`${picked || drag ? 'is-drop-ready' : ''} ${drag?.over === `reward:${t.id}` ? 'is-drop-over' : ''}`}
                data-loadout-target={`reward:${t.id}`}
                onClick={() => void place(`reward:${t.id}`)}
                aria-label={`${t.name}에 ${'cat' in reward ? '편성' : '장착'}`}
              >
                {t.id.startsWith('empty') ? (
                  '+'
                ) : (
                  <CatPortrait
                    grade={cats.find((c) => c.code === t.code)?.grade}
                    code={t.code ?? undefined}
                  />
                )}
                <small>{t.name}</small>
              </button>
            ))}
          </div>
          <small aria-live="polite">
            {drag?.over ? '놓으면 바로 적용돼요' : '끌거나, 보상을 누른 뒤 대상을 누르세요'}
          </small>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
