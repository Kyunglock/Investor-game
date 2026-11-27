import type { Company } from '@web/api/client'
import { type Loadout, loadoutOf, STAGE_TEAM_MAX } from '../mental/cards'
import { heroOf } from '../mental/hero'
import { idleLoadout } from './loadout'
import { fieldedInOrder } from './seats'

export type StageTeam = { starter: string | null; companions: string[] }

/**
 * 스테이지 출전 고양이 (decisions.md 669번): 스테이지 편성의 초깃값은 일반 출전 칸의 고양이다. 출발 전에 이번 판의 팀을 따로 바꿀 수 있다. 스테이지는 고른 선발 한 마리로 시작하고, "고양이 카드"를 고를 때마다 한 마리씩 나온다. 나오는 차례는 판마다 무작위다(695번, stageOrder). 나온 고양이는 제 무기를 쏘고 제
 * 고유 스킬을 Lv.1부터 쓰며, 스킬 강화 카드로 그 판 안에서 레벨을 올린다.
 */
export function stageTeamOf(company: Company): StageTeam {
  const companions = fieldedInOrder(company.idle?.cats ?? [])
    .map((cat) => cat.code)
    .slice(0, STAGE_TEAM_MAX)
  const starter = company.idle?.bossFielded === false ? (companions.shift() ?? null) : null
  return { starter, companions }
}

export function replaceStarter(team: StageTeam, starter: string | null): StageTeam {
  const companions = team.companions.flatMap((code) => {
    if (code !== starter) return [code]
    return team.starter ? [team.starter] : []
  })
  return { starter, companions }
}

/**
 * 스테이지에서 고양이가 나오는 차례 (695번): 출전 칸의 차례가 아니라 판마다 섞는다. 전에는 늘 1번 칸의 고양이부터 나와, 뒤 칸의 고양이는
 * 카드를 여러 장 골라야 볼 수 있었다. rand는 0~1을 주는 함수다.
 */
export function stageOrder(team: readonly string[], rand: () => number = Math.random): string[] {
  const order = [...team]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * 스테이지 한 판의 처음 수치: 사장냥의 총에, 나올 고양이들의 총·그림·고유 스킬을 미리 실어 둔다. 선발은 바로 나오고 동료는 카드를 고를 때마다 앞에서부터 나온다. 고유 스킬은 모두 Lv.1에서 시작한다.
 */
export function stageLoadout(
  company: Company,
  companions: readonly string[],
  starter: string | null = null,
): Loadout {
  const team = starter ? [starter, ...companions] : companions
  const hero = heroOf(company)
  // 스테이지 공격력에는 성장 탭의 영구 강화만 적용한다. 일반 강화는 방치 전투에만 남긴다.
  const upgrades = [
    ...hero.upgrades.filter((upgrade) => upgrade.kind !== 'damage'),
    {
      kind: 'damage' as const,
      bonusPercent:
        company.idle?.rebirth?.upgrades.find((upgrade) => upgrade.kind === 'damage')?.bonus ?? 0,
    },
  ]
  const base = loadoutOf(hero.weapon, upgrades)
  if (team.length === 0) return base
  const full = idleLoadout(company, team, upgrades)
  const cats = team.flatMap((code) => (company.idle?.cats ?? []).filter((c) => c.code === code))
  return {
    ...base,
    // 사장냥이 쉬면 (672번) 맨 앞 고양이가 처음부터 나와 싸운다: 고양이 카드는 그다음 고양이부터 부른다.
    heroBenched: starter !== null,
    mates: starter !== null ? 1 : base.mates,
    mateGuns: full.mateGuns,
    mateMagic: full.mateMagic,
    mateMagicLevels: cats.map(() => 1),
    stageCats: cats,
  }
}
