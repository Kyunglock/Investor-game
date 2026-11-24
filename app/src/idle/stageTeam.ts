import type { Company } from '@web/api/client'
import { type Loadout, loadoutOf, STAGE_TEAM_MAX } from '../mental/cards'
import { heroOf } from '../mental/hero'
import { idleLoadout } from './loadout'
import { fieldedInOrder } from './seats'

/**
 * 스테이지 출전 고양이 (decisions.md 669번): 매도벽 돌파 스테이지에는 출전 탭에서 출전시킨 고양이가 그대로 나간다. 따로 고르는 화면은 두지
 * 않는다. 스테이지는 사장냥 혼자 시작하고, "고양이 카드"를 고를 때마다 출전 칸의 차례대로 한 마리씩 나온다. 나온 고양이는 제 무기를 쏘고 제
 * 고유 스킬을 Lv.1부터 쓰며, 스킬 강화 카드로 그 판 안에서 레벨을 올린다.
 */
export function stageTeamOf(company: Company): string[] {
  return fieldedInOrder(company.idle?.cats ?? [])
    .map((cat) => cat.code)
    .slice(0, STAGE_TEAM_MAX)
}

/**
 * 스테이지 한 판의 처음 수치: 사장냥의 총에, 나올 고양이들의 총·그림·고유 스킬을 미리 실어 둔다. 고양이는 아직 없고(mates 0) 고양이 카드를
 * 고를 때마다 앞에서부터 나온다. 고유 스킬은 모두 Lv.1에서 시작한다.
 */
export function stageLoadout(company: Company, team: readonly string[]): Loadout {
  const hero = heroOf(company)
  const base = loadoutOf(hero.weapon, hero.upgrades)
  if (team.length === 0) return base
  const full = idleLoadout(company, team)
  const cats = team.flatMap((code) => (company.idle?.cats ?? []).filter((c) => c.code === code))
  return {
    ...base,
    // 사장냥이 쉬면 (672번) 맨 앞 고양이가 처음부터 나와 싸운다: 고양이 카드는 그다음 고양이부터 부른다.
    heroBenched: full.heroBenched,
    mates: full.heroBenched ? 1 : base.mates,
    mateGuns: full.mateGuns,
    mateMagic: full.mateMagic,
    mateMagicLevels: cats.map(() => 1),
    stageCats: cats.map((cat) => ({ name: cat.name, skills: cat.skills.map((s) => s.name) })),
  }
}
