import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import type { PointerEventHandler } from 'react'
import { CatPortrait as Portrait } from './CatPortrait'
import { SkillBadge } from './SkillBadge'
import { skillNames } from './skills'

type Cat = NonNullable<Company['idle']>['cats'][number]

/** 낭독기가 읽을 스킬 (561번): 없으면 없다고 읽는다. */
const skillLabel = (cat: Cat) =>
  cat.skills.length > 0 ? `고유 스킬 ${skillNames(cat)}` : '고유 스킬 없음'

/** 6열 격자. 보유 여부와 관계없이 전체 도감을 표시한다. */
const COLUMNS = 6

export function CatRosterGrid({
  cats,
  picked,
  onPick,
  down,
  consumeClick,
  preview = false,
  readable = false,
  disabledCat,
}: {
  cats: Cat[]
  picked: CatCode | null
  onPick: (code: CatCode) => void
  down?: (code: CatCode) => PointerEventHandler<HTMLButtonElement>
  consumeClick?: (detail: number) => boolean
  preview?: boolean
  disabledCat?: (cat: Cat) => boolean
  readable?: boolean
}) {
  return (
    <ul
      className={`idle-cat-grid ${readable ? 'is-readable' : ''}`}
      aria-label={`고양이 인벤토리 · 동료 ${cats.length}종`}
    >
      {Array.from(
        {
          length: readable ? cats.length : Math.max(18, Math.ceil(cats.length / COLUMNS) * COLUMNS),
        },
        (_, i) => cats[i] ?? null,
      ).map((c, i) =>
        c ? (
          <li key={c.code}>
            <button
              type="button"
              className={`idle-cat-cell ${c.level > 0 ? 'owned' : ''} ${c.fielded ? 'fielded' : ''} ${picked === c.code ? 'is-picked' : ''}`}
              data-testid="cat"
              data-code={c.code}
              data-grade={c.grade}
              disabled={(!preview && c.level < 1) || disabledCat?.(c)}
              aria-pressed={readable ? c.fielded : picked === c.code}
              aria-label={
                c.level > 0
                  ? `${c.grade} 등급 ${c.name} 레벨 ${c.level}${c.fielded ? ' 출전 중' : ''} · ${skillLabel(c)}`
                  : `${c.grade} 등급 ${c.name} 아직 없음 · ${skillLabel(c)}`
              }
              onPointerDown={c.level < 1 || c.fielded ? undefined : down?.(c.code)}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(event) => {
                if (!consumeClick?.(event.detail)) onPick(c.code)
              }}
            >
              <Portrait grade={c.grade} code={c.code} locked={c.level < 1} />
              {/* 고유 스킬 (531번): 못 가진 고양이의 스킬은 흑백에 자물쇠다. */}
              {c.skills.length > 0 && (
                <span className="idle-cat-badge">
                  {c.skills.map((skill) => (
                    <SkillBadge
                      key={skill.code}
                      skill={skill.code}
                      level={c.skillLevel}
                      size={c.skills.length > 1 ? 15 : 18}
                      locked={c.level < 1}
                    />
                  ))}
                </span>
              )}
              <em
                className={`idle-cat-grade idle-cat-grade-tag is-${c.grade} ${c.level < 1 ? 'is-locked' : ''}`}
              >
                {c.grade}
              </em>
              {c.level > 0 && <i>Lv.{c.level}</i>}
              {readable && <b className="roster-cat-name">{c.name}</b>}
            </button>
          </li>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: 빈 칸은 자리 번호가 곧 열쇠다.
          <li key={i} className="idle-cat-cell-empty" />
        ),
      )}
    </ul>
  )
}
