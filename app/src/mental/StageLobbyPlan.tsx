import type { Company } from '@web/api/client'
import type { CatCode } from '@web/features/raising/store'
import { useState } from 'react'
import { IdleCats, type LoadoutTab } from '../idle/IdleCats'
import { recommendParty } from '../idle/party'
import { replaceStarter, type StageTeam } from '../idle/stageTeam'
import { BOSS_NAME } from './armory'
import { STAGE_TEAM_MAX } from './cards'

export function StageLobbyTeam({
  company,
  team,
  onChange,
}: {
  company: Company
  team: StageTeam
  onChange: (team: StageTeam) => void
}) {
  const [picked, setPicked] = useState<CatCode | null>(null)
  const [tab, setTab] = useState<LoadoutTab>('고양이')
  const [positions, setPositions] = useState<(string | null)[] | null>(null)
  const idle = company.idle
  if (!idle) return null
  const capacity = Math.min(idle.fieldSlots, STAGE_TEAM_MAX)
  const initial = [team.starter ?? 'boss', ...team.companions]
  const seats = Array.from({ length: capacity + 1 }, (_, i) => (positions ?? initial)[i] ?? null)
  const bossSlot = seats.indexOf('boss')

  function save(next: (string | null)[]) {
    const cats = next.filter((code): code is string => code !== null && code !== 'boss')
    const starter = next.includes('boss') ? null : cats.shift()
    if (starter === undefined) return
    setPositions(next)
    onChange({ starter, companions: cats })
  }

  const preview = {
    ...company,
    idle: {
      ...idle,
      fieldSlots: capacity,
      bossFielded: bossSlot !== -1,
      bossSlot: bossSlot === -1 ? null : bossSlot,
      cats: idle.cats.map((cat) => {
        const slot = seats.indexOf(cat.code)
        return { ...cat, slot: slot === -1 ? null : slot, fielded: slot !== -1 }
      }),
    },
  }
  const companions = recommendParty({
    ...company,
    idle: {
      ...idle,
      fieldSlots: capacity,
      cats: idle.cats.filter((cat) => cat.code !== team.starter),
    },
  })
  return (
    <section
      className="stage-lobby-team loadout-sheet"
      data-testid="stage-lobby-team"
      aria-label="스테이지 출전"
    >
      <label className="stage-starter">
        선발 고양이
        <select
          value={team.starter ?? ''}
          onChange={(event) => {
            const next = replaceStarter(team, event.target.value || null)
            setPositions(null)
            onChange(next)
          }}
        >
          <option value="">{BOSS_NAME}</option>
          {idle.cats
            .filter((cat) => cat.level > 0)
            .map((cat) => (
              <option key={cat.code} value={cat.code}>
                {cat.name}
              </option>
            ))}
        </select>
      </label>
      <IdleCats
        company={preview}
        picked={picked}
        onPick={setPicked}
        tab={tab}
        onTab={setTab}
        formation={{
          recommended: team.starter ? [team.starter, ...companions] : companions,
          setFielded(code, fielded, at) {
            const next = [...seats]
            const from = seats.indexOf(code)
            if (fielded) {
              const to = at ?? seats.indexOf(null)
              if (to < 0) return
              if (from >= 0) next[from] = next[to]
              next[to] = code
            } else if (from >= 0) next[from] = null
            save(next)
          },
          recommend(codes) {
            const starter = team.starter ?? 'boss'
            save([starter, ...codes.filter((code) => code !== starter)])
          },
        }}
      />
    </section>
  )
}
