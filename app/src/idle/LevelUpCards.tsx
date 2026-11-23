import type { Company } from '@web/api/client'
import { type CardCode, useRaisingStore } from '@web/features/raising/store'
import { useState } from 'react'
import { haptic } from '../fx/haptics'
import { sfx } from '../fx/sound'
import { ACTIVE_NOTES, type ActiveCode } from '../mental/actives'
import { ActiveBadge } from './ActiveBadge'
import './level-up.css'

/** 고양이 마법 강화 카드 (667번)의 이름과 설명. 고유 스킬 카드는 서버의 이름(actives[].name)과 ACTIVE_NOTES를 쓴다. */
const CAT_MAGIC = {
  name: '고양이 마법 강화',
  note: '출전한 고양이 모두의 마법 레벨이 1 올라요. 환생하기 전까지 이어져요.',
}

/**
 * 전투 레벨과 레벨업 카드 (decisions.md 667번). 매도벽을 부수면 경험치가 오르고, 레벨이 오르면 카드 석 장 가운데 한 장을 고른다.
 *
 * 오른쪽에 레벨 단추가 선다: 다음 레벨까지의 경험치를 둘레의 고리로 보인다. 고를 카드가 있으면 아래에 석 장이 펼쳐지고, 전투는 그대로 돈다. "나중에"로
 * 접어 두면 레벨 단추에 고를 수가 붙고, 누르면 다시 펼친다. 안내(첫 출근)가 도는 동안에는 펼치지 않는다.
 */
export function LevelUpCards({ company, paused }: { company: Company; paused: boolean }) {
  const level = company.idle?.levelUp
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const [folded, setFolded] = useState(false)
  const [picking, setPicking] = useState<CardCode | null>(null)
  if (!level) return null
  const offer = level.offer as CardCode[]
  const ratio = level.next > 0 ? Math.min(1, level.xp / level.next) : 0
  const open = offer.length > 0 && !folded && !paused
  const name = (code: CardCode) =>
    code === 'catMagic'
      ? CAT_MAGIC.name
      : (company.idle?.actives?.find((active) => active.code === code)?.name ?? code)
  const pick = async (code: CardCode) => {
    if (picking || busy) return
    setPicking(code)
    sfx.tap()
    haptic.light()
    try {
      const ok = await useRaisingStore.getState().pickCard(code)
      // 고유 스킬은 서버가 받아 준 뒤에 전투가 효과를 낸다. 고양이 마법은 회사 상태가 바뀌어 전투의 마법 레벨이 저절로 오른다.
      if (ok && code !== 'catMagic')
        window.dispatchEvent(new CustomEvent('idle-active', { detail: code }))
      if (ok) sfx.levelUp()
    } finally {
      setPicking(null)
    }
  }
  return (
    <>
      <button
        type="button"
        className="idle-level"
        data-testid="idle-level"
        data-level={level.level}
        data-pending={level.pending || undefined}
        aria-label={`전투 레벨 ${level.level} · 다음 레벨까지 경험치 ${level.xp} / ${level.next}${
          level.pending ? ` · 고를 카드 ${level.pending}장` : ''
        }`}
        title={`다음 레벨까지 매도벽 ${level.next - level.xp}개`}
        style={{ '--level-ratio': `${ratio}turn` } as React.CSSProperties}
        onClick={() => {
          sfx.tap()
          if (offer.length) setFolded((now) => !now)
        }}
      >
        <span className="idle-level-ring" aria-hidden="true" />
        <span className="idle-level-number" aria-hidden="true">
          <small>Lv</small>
          {level.level}
        </span>
        {level.pending > 0 && (
          <i className="idle-level-pending" aria-hidden="true">
            {level.pending}
          </i>
        )}
      </button>
      {open && (
        <section className="level-cards" data-testid="level-cards" aria-label="레벨업 카드 고르기">
          <header>
            <b className="level-cards-title">레벨업! Lv.{level.level}</b>
            <span>카드 한 장을 골라요{level.pending > 1 ? ` · ${level.pending}장 남음` : ''}</span>
            <button
              type="button"
              className="level-cards-later"
              onClick={() => {
                sfx.tap()
                setFolded(true)
              }}
            >
              나중에
            </button>
          </header>
          <ul>
            {offer.map((code) => (
              <li key={code}>
                <button
                  type="button"
                  className="level-card"
                  data-testid="level-card"
                  data-code={code}
                  disabled={busy || picking !== null}
                  aria-busy={picking === code}
                  onClick={() => void pick(code)}
                >
                  <span className="level-card-art" aria-hidden="true">
                    {code === 'catMagic' ? (
                      <span className="level-card-magic">✦</span>
                    ) : (
                      <ActiveBadge code={code as ActiveCode} />
                    )}
                  </span>
                  <b>{name(code)}</b>
                  <small>
                    {code === 'catMagic'
                      ? `마법 Lv +1${level.magicBonus ? ` (지금 +${level.magicBonus})` : ''}`
                      : code === 'stopLoss'
                        ? '바로 발동'
                        : `${Math.round(level.cardSeconds / 60)}분 동안`}
                  </small>
                  <p>{code === 'catMagic' ? CAT_MAGIC.note : ACTIVE_NOTES[code as ActiveCode]}</p>
                </button>
              </li>
            ))}
          </ul>
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </>
  )
}
