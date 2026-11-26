import type { Company } from '@web/api/client'
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalBack } from '../app/useModalBack'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { JackpotFx, REVEAL_HOLD_MS } from '../mental/JackpotFx'
import { CatPortrait, catTrait } from './CatPortrait'
import { catRevealPlan, holdsReveal, shinyCat } from './catGrade'
import { DrawAgain, type RepeatDraw } from './DrawAgain'
import { SkillBadge } from './SkillBadge'
import { skillNames } from './skills'
import '../mental/weapon-reveal.css'

type Cat = NonNullable<Company['idle']>['cats'][number]
export type CatDraw = { cat: Cat; isNew: boolean }

/**
 * 고양이 뽑기 연출 (decisions.md 508번): 무기 뽑기(WeaponReveal)와 같은 창·상자·빛을 쓴다. 상자가 떨다 열리고 고양이가 나온다. 결과는 이번
 * 서버 응답의 스냅샷이다.
 *
 * S등급 이상을 처음 얻으면 (693번) 결과 앞에 축하 장면(wow)이 3초 나온다. 상자의 뜸은 눌러서 건너뛸 수 있지만 이 장면은 넘기거나 닫을 수 없다.
 */
export function CatReveal({
  result,
  price,
  canAgain,
  onClose,
  onAgain,
  useAction,
  repeat,
}: {
  result: CatDraw | null
  /** 한 번 더 뽑는 다이아 값 (526번) */
  price: number
  /** 다이아가 한 번 더 뽑을 만큼 남았다 */
  canAgain: boolean
  onClose: () => void
  repeat?: RepeatDraw
  useAction?: ReactNode
  onAgain: () => void
}) {
  // 응답을 기다릴 때도 뒤로 가기를 소비해 상점이 함께 닫히지 않게 한다.
  useModalBack(() => close())
  const dialog = useRef<HTMLDialogElement>(null)
  const [phase, setPhase] = useState<'charge' | 'open' | 'wow' | 'result'>('charge')
  const hold = result ? holdsReveal(result.cat.grade, result.isNew) : false
  /** 상자가 열리면 갈 곳: 넘길 수 없는 뽑기는 축하 장면을 거친다. */
  const shown = hold ? 'wow' : 'result'
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const sounded = useRef(false)
  const plan = catRevealPlan(result?.cat.grade ?? 'C', result?.isNew ?? false)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => {
      dialog.current?.close()
      previous?.focus()
    }
  }, [])
  useEffect(() => {
    if (!result) return
    if (reduced) {
      setPhase(shown)
      return
    }
    sfx.charge()
    const open = setTimeout(
      () => setPhase((current) => (current === 'charge' ? 'open' : current)),
      plan.charge,
    )
    const reveal = setTimeout(
      () => setPhase((current) => (current === 'wow' || current === 'result' ? current : shown)),
      plan.charge + 220,
    )
    return () => {
      clearTimeout(open)
      clearTimeout(reveal)
    }
  }, [result, reduced, plan.charge, shown])
  useEffect(() => {
    if (phase !== 'wow') return
    const done = setTimeout(() => setPhase('result'), REVEAL_HOLD_MS)
    return () => clearTimeout(done)
  }, [phase])
  useEffect(() => {
    if ((phase !== 'wow' && phase !== 'result') || !result || sounded.current || reduced) return
    sounded.current = true
    if (result.cat.grade === 'S') sfx.celebrate()
    else sfx.weaponReveal(plan.sound)
    if (plan.power >= 3) haptic.burst()
    else haptic.light()
  }, [phase, result, plan.power, plan.sound, reduced])
  useEffect(() => {
    if (phase === 'result') dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [phase])
  const close = () => {
    // 넘길 수 없는 뽑기는 축하 장면이 끝나 결과가 나온 뒤에만 닫힌다 (693번).
    if (result && (!hold || phase === 'result')) onClose()
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="weapon-reveal cat-reveal"
      aria-label="고양이 뽑기"
      data-testid="cat-reveal"
      data-phase={phase}
      data-grade={result ? plan.sound : undefined}
      data-starlight={result?.cat.grade === 'S' || result?.cat.grade === 'SS' || undefined}
      data-power={plan.power}
      data-shiny={result ? shinyCat(result.cat.grade) : false}
      data-hold={phase === 'wow' || undefined}
      style={{ '--reveal-color': plan.color } as CSSProperties}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onKeyDown={(e) => {
        // 아래 고양이 Sheet의 document Escape 처리까지 전달하지 않는다.
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          close()
        }
      }}
    >
      <div className="weapon-reveal-body">
        <div className="weapon-reveal-rays" aria-hidden="true" />
        <div className="weapon-reveal-sparks" aria-hidden="true">
          ✦ ✧ ✦ ✧ ✦
        </div>
        {phase === 'wow' && result ? (
          <section className="jackpot-view" data-testid="cat-reveal-wow" aria-live="polite">
            <p className="jackpot-title">✦ {result.cat.grade} 등급 새 고양이! ✦</p>
            <div className="weapon-reveal-art cat-reveal-art">
              <CatPortrait code={result.cat.code} grade={result.cat.grade} />
            </div>
            <h2>{result.cat.name}</h2>
            <small>엄청난 고양이가 찾아왔어요!</small>
          </section>
        ) : phase !== 'result' ? (
          <button
            type="button"
            className="weapon-reveal-stage"
            onClick={() => result && setPhase(shown)}
            disabled={!result}
            data-testid="cat-reveal-skip"
          >
            <span className="weapon-case" aria-hidden="true">
              <i />
              <b>🐾</b>
            </span>
            <strong>
              {!result
                ? '고양이를 데려오는 중…'
                : phase === 'open'
                  ? '야옹!'
                  : '어떤 고양이가 기다릴까?'}
            </strong>
            <small>{result ? '화면을 누르면 바로 공개' : '잠시만 기다려 주세요'}</small>
          </button>
        ) : (
          result && (
            <section
              className="weapon-reveal-result"
              data-testid="cat-drawn"
              data-code={result.cat.code}
              data-new={result.isNew}
              data-cat-grade={result.cat.grade}
              aria-live="polite"
            >
              <p className="weapon-reveal-new">
                {result.isNew ? 'NEW! 새 고양이' : `레벨 업! Lv.${result.cat.level}`}
              </p>
              <span className="weapon-reveal-grade" data-testid="cat-drawn-grade">
                {result.cat.grade} 등급
                {result.cat.skills.length > 0 &&
                  ` · 고유 ${skillNames(result.cat)} Lv.${result.cat.skillLevel}`}
              </span>
              <div className="weapon-reveal-art cat-reveal-art">
                <CatPortrait code={result.cat.code} grade={result.cat.grade} />
                {/* 고유 스킬 배지 (531번): 초상화 귀퉁이에 건다. */}
                {/* 스킬은 A등급부터 있고 S등급은 둘이다 (561번). */}
                {result.cat.skills.length > 0 && (
                  <span className="cat-reveal-badge">
                    {result.cat.skills.map((skill) => (
                      <SkillBadge
                        key={skill.code}
                        skill={skill.code}
                        level={result.cat.skillLevel}
                        size={result.cat.skills.length > 1 ? 46 : 58}
                      />
                    ))}
                  </span>
                )}
              </div>
              <h2>{result.cat.name}</h2>
              <p className="weapon-reveal-stats">
                무기 공격력의 {result.cat.damagePercent}% · {catTrait(result.cat)}
              </p>
              <p className="weapon-reveal-effect">
                <b>{result.isNew ? '출전 칸에 세우면 함께 싸워요' : '총의 화력이 올랐어요'}</b>
                <br />
                {result.cat.skills.length === 0
                  ? '스킬은 A등급 고양이부터 있어요'
                  : `출전해 있는 동안 ${skillNames(result.cat)}이 나가요`}
                {result.cat.skills.length > 0 && (
                  <>
                    <br />
                    {result.cat.skillNextLevel > 0
                      ? `고양이 Lv.${result.cat.skillNextLevel}이 되면 스킬이 Lv.${result.cat.skillLevel + 1}로 올라요`
                      : '스킬이 최고 레벨이에요'}
                  </>
                )}
              </p>
              {useAction}
              {repeat && (
                <DrawAgain
                  kind="cat"
                  price={price}
                  canAgain={canAgain}
                  onAgain={onAgain}
                  onClose={onClose}
                  repeat={repeat}
                />
              )}
            </section>
          )
        )}
        {phase === 'wow' && <JackpotFx />}
      </div>
    </dialog>,
    document.body,
  )
}
