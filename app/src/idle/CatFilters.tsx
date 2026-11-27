import type { Company } from '@web/api/client'
import { CAT_GRADES } from './catGrade'
import './cat-filters.css'

type Cat = NonNullable<Company['idle']>['cats'][number]
export type CatFilter = { query: string; group: string; sort: string }
export const DEFAULT_CAT_FILTER: CatFilter = { query: '', group: 'all', sort: 'power' }

export function filterCats(
  cats: Cat[],
  filter: CatFilter,
  selected: readonly string[],
  power: (code: string) => number,
) {
  const query = filter.query.trim().toLocaleLowerCase()
  return cats
    .filter(
      (cat) =>
        (!query ||
          `${cat.name} ${cat.skills.map((s) => s.name).join(' ')}`
            .toLocaleLowerCase()
            .includes(query)) &&
        (filter.group === 'all' ||
          (filter.group === 'fielded'
            ? selected.includes(cat.code)
            : filter.group === 'bench'
              ? cat.level > 0 && !selected.includes(cat.code)
              : cat.grade === filter.group)),
    )
    .sort(
      (a, b) =>
        Number(b.level > 0) - Number(a.level > 0) ||
        (filter.sort === 'level'
          ? b.level - a.level
          : filter.sort === 'grade'
            ? CAT_GRADES.indexOf(a.grade) - CAT_GRADES.indexOf(b.grade)
            : power(b.code) - power(a.code)),
    )
}

export function CatFilters({
  value,
  onChange,
  count,
}: {
  value: CatFilter
  onChange: (value: CatFilter) => void
  count: number
}) {
  return (
    <div className="cat-filters">
      <div className="cat-filter-search">
        <input
          type="search"
          aria-label="고양이 이름·스킬 검색"
          placeholder="이름이나 스킬로 찾기"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
        <select
          aria-label="고양이 정렬"
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value })}
        >
          <option value="power">화력순</option>
          <option value="grade">등급순</option>
          <option value="level">레벨순</option>
        </select>
      </div>
      <fieldset className="cat-filter-groups" aria-label="고양이 필터">
        {(
          [
            ['all', '전체'],
            ['fielded', '출전'],
            ['bench', '대기'],
            ...CAT_GRADES.map((grade) => [grade, grade]),
          ] as string[][]
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={value.group === key}
            onClick={() => onChange({ ...value, group: key })}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <small className="cat-filter-count" role="status">
        {count}마리 · 고양이를 눌러 편성하세요
      </small>
    </div>
  )
}
