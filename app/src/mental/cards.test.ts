import { describe, expect, it } from 'vitest'
import { DEFENSE_SKILL_CODES, SKILL_CODES } from './actives'
import {
  applyCard,
  BASE_LOADOUT,
  bulletStats,
  canAwakenMate,
  loadoutOf,
  MAGICS,
  MAX_BULLET_POWER,
  MAX_MATES,
  type Magic,
  magicCard,
  magicEffect,
  magicGrade,
  mateCard,
  mateMagicCard,
  mateMagicUpCard,
  pickCards,
  SIMPLE_CARDS,
  skillCard,
  skillPower,
  stageCatCard,
  stageSkillCard,
  stageSkillTargets,
  xpToNext,
} from './cards'
import { MAGIC_MAX_LEVEL } from './magic'

function rng(seed: number) {
  let x = seed + 1
  return () => {
    x = (x * 48271) % 2147483647
    return x / 2147483647
  }
}

describe('멘탈 카드 (decisions.md 328·330·377·392·393번)', () => {
  it('석 장은 서로 다른 카드이고, 마법 카드는 지금 레벨의 다음 레벨을 낸다', () => {
    const levels = { water: 2, meteor: 0, lightning: 4, earth: 3, mates: 1 }
    let magics = 0
    let mates = 0
    for (let seed = 0; seed < 80; seed++) {
      const picked = pickCards(levels, rng(seed))
      expect(picked).toHaveLength(3)
      expect(new Set(picked.map((c) => c.code)).size).toBe(3)
      for (const c of picked) {
        if (c.code === 'atk' || c.code === 'spd') {
          expect(SIMPLE_CARDS).toContainEqual(c)
          continue
        }
        if (c.code === 'cat') {
          mates++
          expect(c).toEqual(mateCard(1))
          continue
        }
        if (c.code === 'cat-magic') {
          expect(c).toEqual(mateMagicCard(0))
          continue
        }
        magics++
        const magic = c.code as Magic
        expect(c.level).toEqual({ from: levels[magic], to: levels[magic] + 1 })
        expect(c).toEqual(magicCard(magic, levels[magic]))
      }
    }
    expect(magics).toBeGreaterThan(0)
    expect(mates).toBeGreaterThan(0)
  })

  it('"고양이 한 마리 더"는 희귀 카드이고 고를 때마다 한 마리씩, 최대 셋까지 는다', () => {
    const card = mateCard(0)
    expect(card).toMatchObject({ code: 'cat', grade: 'R', mates: { from: 0, to: 1 } })
    expect(mateCard(2).mates).toEqual({ from: 2, to: MAX_MATES })
    expect(mateCard(MAX_MATES).mates?.to).toBe(MAX_MATES)
    let loadout = BASE_LOADOUT
    expect(loadout.mates).toBe(0)
    for (let i = 0; i < MAX_MATES + 2; i++) {
      loadout = applyCard(loadout, mateCard(loadout.mates))
      expect(loadout.mates).toBe(Math.min(MAX_MATES, i + 1))
    }
    // 고양이는 수치를 바꾸지 않는다: 저마다 사장냥과 같은 수치로 싸운다.
    expect(loadout.damage).toBe(BASE_LOADOUT.damage)
    expect(loadout.fireMs).toBe(BASE_LOADOUT.fireMs)
  })

  it('고양이가 셋 다 차면 고양이 카드는 더 나오지 않고, 그 몫은 일반 카드로 간다', () => {
    const full = { water: 0, meteor: 0, lightning: 0, earth: 0, mates: MAX_MATES }
    let magics = 0
    let slots = 0
    for (let seed = 0; seed < 200; seed++) {
      for (const c of pickCards(full, rng(seed))) {
        expect(c.code).not.toBe('cat')
        slots++
        if (c.level) magics++
      }
    }
    // 마법 몫(45%)은 그대로다. 같은 카드를 다시 굴리니 정확히 45%는 아니다.
    expect(magics / slots).toBeGreaterThan(0.35)
  })

  it('고양이 카드는 칸마다 8%쯤 나온다', () => {
    let cats = 0
    let picks = 0
    for (let seed = 0; seed < 400; seed++) {
      picks++
      if (
        pickCards({ water: 0, meteor: 0, lightning: 0, earth: 0, mates: 0 }, rng(seed)).some(
          (c) => c.code === 'cat',
        )
      )
        cats++
    }
    // 석 장에 한 장이라도 나올 확률 ≈ 1 - 0.92³ ≈ 22%.
    expect(cats / picks).toBeGreaterThan(0.12)
    expect(cats / picks).toBeLessThan(0.34)
  })

  it('최대 레벨인 마법은 더 나오지 않는다', () => {
    const levels = {
      water: MAGIC_MAX_LEVEL,
      meteor: MAGIC_MAX_LEVEL,
      lightning: 1,
      earth: MAGIC_MAX_LEVEL,
    }
    for (let seed = 0; seed < 50; seed++) {
      for (const c of pickCards(levels, rng(seed))) {
        expect(['water', 'meteor', 'earth']).not.toContain(c.code)
      }
    }
  })

  it('일반 카드는 공격력·공격 속도 +10%, 마법은 등급과 상관없이 고를 때마다 한 레벨씩 오른다', () => {
    const [atk, spd] = SIMPLE_CARDS
    expect(applyCard(BASE_LOADOUT, atk).damage).toBeCloseTo(1.1)
    expect(applyCard(BASE_LOADOUT, spd).fireMs).toBeCloseTo(260 / 1.1)
    let loadout = BASE_LOADOUT
    for (let i = 0; i < MAGIC_MAX_LEVEL + 2; i++) {
      loadout = applyCard(loadout, magicCard('meteor', loadout.meteor))
      expect(loadout.meteor).toBe(Math.min(MAGIC_MAX_LEVEL, i + 1))
    }
    expect(loadout.water).toBe(0)
  })

  it('마법 카드의 등급은 오르는 레벨을 보인다: Lv.1 희귀, Lv.2 영웅, Lv.3부터 전설', () => {
    expect(magicCard('water', 0)).toMatchObject({ grade: 'R', level: { from: 0, to: 1 } })
    expect(magicCard('water', 1).grade).toBe('SR')
    expect(magicCard('water', 2).grade).toBe('UR')
    expect(magicGrade(5)).toBe('UR')
  })

  it('카드 문구는 레벨마다 연출 이름과 수치가 바뀐다', () => {
    expect(magicEffect('water', 1)).toContain('물방울')
    expect(magicEffect('water', 2)).toContain('물줄기')
    expect(magicEffect('water', 3)).toContain('큰 물결')
    expect(magicEffect('meteor', 1)).toContain('운석')
    expect(magicEffect('meteor', 3)).toContain('유성우')
    expect(magicEffect('lightning', 3)).toContain('번개')
    expect(magicEffect('lightning', 4)).toContain('2줄기')
    // 땅 (433번): 벽·큰손을 들이받는 피해와, 3단계부터 충격파.
    expect(magicEffect('earth', 1)).toContain('돌 충차')
    expect(magicEffect('earth', 1)).toContain('매도벽만 공격 · 피해 408%')
    expect(magicEffect('earth', 2)).not.toContain('충격파')
    expect(magicEffect('earth', 3)).toContain('대지 충차 · 매도벽만 공격 · 피해 798%')
    for (const m of MAGICS) {
      expect(magicEffect(m, 1)).not.toBe(magicEffect(m, 2))
    }
  })

  it('강화탄은 공격력과 크기가 함께 커지고 최대 단계에서 멈춘다', () => {
    let loadout = BASE_LOADOUT
    for (let i = 0; i < 5; i++)
      loadout = { ...loadout, bulletPower: Math.min(MAX_BULLET_POWER, loadout.bulletPower + 1) }
    expect(bulletStats(loadout).damage).toBeCloseTo(2.2)
    expect(bulletStats(loadout).scale).toBeCloseTo(1.6)
    expect(bulletStats(applyCard(loadout, SIMPLE_CARDS[0])).damage).toBeGreaterThan(
      bulletStats(loadout).damage,
    )
  })

  it('무기가 가진 강화 단계에서 시작한다', () => {
    const loadout = loadoutOf({ damagePercent: 120, fireMs: 240, power: 2, bulletSpeed: 720 })
    expect(loadout.bulletPower).toBe(2)
    expect(bulletStats(loadout).damage).toBeCloseTo(2.16)
  })

  it('범위 피해는 강화 2단계부터 붙고 단계가 오를수록 넓어진다', () => {
    const at = (bulletPower: number) => bulletStats({ ...BASE_LOADOUT, bulletPower })
    expect(at(0).splashRadius).toBe(0)
    expect(at(1).splashRadius).toBe(0)
    expect(at(1).splashDamage).toBe(0)
    expect(at(2).splashRadius).toBeGreaterThan(0)
    expect(at(3).splashRadius).toBeGreaterThan(at(2).splashRadius)
    expect(at(2).splashDamage).toBeCloseTo(at(2).damage * 0.5)
  })

  it('자본으로 산 전투 강화가 무기 위에 붙는다', () => {
    const weapon = { damagePercent: 100, fireMs: 200, power: 0, bulletSpeed: 720 }
    const plain = loadoutOf(weapon)
    const upgraded = loadoutOf(weapon, [
      { kind: 'damage', bonusPercent: 50 },
      { kind: 'fire', bonusPercent: 25 },
    ])
    expect(upgraded.damage).toBeCloseTo(plain.damage * 1.5)
    expect(upgraded.fireMs).toBeCloseTo(160)
    expect(upgraded.moveSpeed).toBe(plain.moveSpeed)
  })

  it('연사 강화는 끝없이 올라도 간격이 0이나 음수가 되지 않는다 (394번)', () => {
    const weapon = { damagePercent: 100, fireMs: 200, power: 0, bulletSpeed: 720 }
    expect(loadoutOf(weapon, [{ kind: 'fire', bonusPercent: 100 }]).fireMs).toBeCloseTo(100)
    expect(loadoutOf(weapon, [{ kind: 'fire', bonusPercent: 1000 }]).fireMs).toBe(60)
  })

  it('체력 강화는 최대 멘탈을 늘린다 (410번)', () => {
    const weapon = { damagePercent: 100, fireMs: 200, power: 0, bulletSpeed: 720 }
    expect(loadoutOf(weapon).maxMental).toBe(100)
    expect(loadoutOf(weapon, [{ kind: 'hp', bonusPercent: 25 }]).maxMental).toBe(125)
    expect(loadoutOf(weapon, [{ kind: 'hp', bonusPercent: 300 }]).maxMental).toBe(400)
  })

  it('다음 레벨까지 드는 경험치는 레벨이 오를수록 커진다', () => {
    expect(xpToNext(1)).toBeLessThan(xpToNext(2))
    expect(xpToNext(5)).toBeLessThan(xpToNext(6))
  })
})

describe('동료 마법 각성', () => {
  it('한 장은 한 마리만 각성시키고 새 동료는 자동 각성하지 않는다', () => {
    const original = { ...BASE_LOADOUT, mates: 2, lightning: 2 }
    const one = applyCard(original, mateMagicCard(0))
    expect(one).toEqual({ ...original, awakenedMates: 1 })
    const summoned = applyCard(one, mateCard(2))
    expect(summoned.awakenedMates).toBe(1)
    const two = applyCard(summoned, mateMagicCard(1))
    expect(two.awakenedMates).toBe(2)
    const three = applyCard(two, mateMagicCard(2))
    expect(applyCard(three, mateMagicCard(3))).toEqual(three)
    expect(three.awakenedMates).toBe(3)
  })
  it('배운 마법과 미각성 동료가 있어야 등장하고 적용된다', () => {
    const eligible = { ...BASE_LOADOUT, mates: 2, water: 1 }
    expect(canAwakenMate(eligible)).toBe(true)
    expect(
      Array.from({ length: 100 }, (_, i) => pickCards(eligible, rng(i)))
        .flat()
        .some((c) => c.code === 'cat-magic'),
    ).toBe(true)
    for (const state of [
      BASE_LOADOUT,
      { ...eligible, mates: 0 },
      { ...eligible, water: 0 },
      { ...eligible, awakenedMates: 2 },
    ]) {
      expect(canAwakenMate(state)).toBe(false)
      expect(applyCard(state, mateMagicCard(0))).toEqual(state)
      for (let i = 0; i < 100; i++)
        expect(pickCards(state, rng(i)).some((c) => c.code === 'cat-magic')).toBe(false)
    }
  })
})

describe('skillPower', () => {
  // 636번: 스킬은 사장냥 무기의 실효 화력(처음 권총에 견준 한 발 피해 × 초당 발수 × 탄 강화)을 따른다.
  it('is 1 for the starting pistol and grows when an A shotgun is merged into an S rifle', () => {
    expect(skillPower({ damagePercent: 100, fireMs: 260, power: 0 })).toBe(1)
    // A 산탄총: 220% × 9 = 1980%, 700ms × 0.8 = 560ms, 탄 강화 2. S 소총: 330% × 5.5 = 1815%, 900ms × 0.4 = 360ms, 탄 강화 3.
    const shotgunA = skillPower({ damagePercent: 1980, fireMs: 560, power: 2 })
    const rifleS = skillPower({ damagePercent: 1815, fireMs: 360, power: 3 })
    expect(shotgunA).toBeCloseTo(16.55, 2)
    expect(rifleS).toBeCloseTo(28.84, 2)
  })
})

describe('매도벽 돌파 스테이지의 카드 (667번)', () => {
  const skills = SKILL_CODES as readonly string[]
  it('사장냥의 스킬 여섯은 스테이지에서만 나온다', () => {
    const levels = { water: 0, meteor: 0, lightning: 0, earth: 0, mates: 0 }
    const seen = new Set<string>()
    for (let seed = 0; seed < 400; seed++) {
      expect(pickCards(levels, rng(seed)).some((c) => skills.includes(c.code))).toBe(false)
      const cards = pickCards(levels, rng(seed), true)
      expect(new Set(cards.map((c) => c.code)).size).toBe(3)
      for (const c of cards) if (skills.includes(c.code)) seen.add(c.code)
    }
    expect([...seen].sort()).toEqual([...SKILL_CODES].sort())
  })
  it('스킬 카드는 수치를 쌓지 않고, 손절만 바로 발동이다', () => {
    const loadout = { ...BASE_LOADOUT, water: 2 }
    for (const code of SKILL_CODES) {
      expect(applyCard(loadout, skillCard(code))).toBe(loadout)
      expect(skillCard(code).effect).toContain(code === 'stopLoss' ? '바로 발동' : '1분 동안')
    }
  })
  it('고양이 마법 강화는 고양이를 모두 각성시키고 배운 마법을 한 레벨씩 올린다', () => {
    const before = {
      ...BASE_LOADOUT,
      mates: 2,
      awakenedMates: 1,
      water: 2,
      meteor: MAGIC_MAX_LEVEL,
    }
    const after = applyCard(before, mateMagicUpCard())
    expect(after).toMatchObject({
      awakenedMates: 2,
      water: 3,
      meteor: MAGIC_MAX_LEVEL,
      lightning: 0,
      earth: 0,
    })
    // 고양이가 없거나 더 오를 마법이 없으면 나오지 않는다.
    const none = { water: 2, meteor: 0, lightning: 0, earth: 0, mates: 0 }
    const full = {
      water: MAGIC_MAX_LEVEL,
      meteor: 0,
      lightning: 0,
      earth: 0,
      mates: 3,
      awakenedMates: 3,
    }
    const ready = { water: 2, meteor: 0, lightning: 0, earth: 0, mates: 3, awakenedMates: 3 }
    let offered = 0
    for (let seed = 0; seed < 400; seed++) {
      expect(pickCards(none, rng(seed), true).some((c) => c.code === 'cat-up')).toBe(false)
      expect(pickCards(full, rng(seed), true).some((c) => c.code === 'cat-up')).toBe(false)
      if (pickCards(ready, rng(seed), true).some((c) => c.code === 'cat-up')) offered++
    }
    expect(offered).toBeGreaterThan(0)
  })
})

describe('스테이지에 데려온 고양이 (669번)', () => {
  const team = [
    { name: '밤냥', skills: ['메테오'] },
    { name: '하늘냥', skills: [] },
    { name: '눈꽃냥', skills: ['얼음', '바람'] },
  ]
  const base = { ...BASE_LOADOUT, stageCats: team, mateMagicLevels: [1, 1, 1] }
  it('고양이 카드는 고른 차례대로 그 고양이를 부른다', () => {
    expect(stageCatCard(base)).toMatchObject({ code: 'cat', name: '밤냥 출전' })
    expect(stageCatCard(base)?.effect).toContain('메테오 Lv.1')
    let loadout = applyCard(
      base,
      stageCatCard(base) as NonNullable<ReturnType<typeof stageCatCard>>,
    )
    expect(loadout.mates).toBe(1)
    expect(stageCatCard(loadout)).toMatchObject({ name: '하늘냥 출전' })
    expect(stageCatCard(loadout)?.effect).toContain('고유 스킬 없음')
    loadout = { ...loadout, mates: 3 }
    expect(stageCatCard(loadout)).toBeNull()
    // 메인 화면처럼 네 마리까지 데려간다.
    const four = { ...base, stageCats: [...team, { name: '민트냥', skills: [] }], mates: 3 }
    expect(stageCatCard(four)).toMatchObject({ name: '민트냥 출전' })
    expect(applyCard(four, mateCard(3)).mates).toBe(4)
    expect(stageCatCard({ ...four, mates: 4 })).toBeNull()
    // 두 마리만 데려왔으면 두 마리까지만 나온다.
    const two = { ...base, stageCats: team.slice(0, 2), mates: 2 }
    expect(stageCatCard(two)).toBeNull()
    expect(applyCard(two, mateCard(2)).mates).toBe(2)
  })
  it('스킬 강화는 나와 있고 스킬이 있는 고양이만, 최고 레벨까지', () => {
    expect(stageSkillTargets(base)).toEqual([])
    expect(stageSkillTargets({ ...base, mates: 2 })).toEqual([0])
    expect(stageSkillTargets({ ...base, mates: 3 })).toEqual([0, 2])
    const out = { ...base, mates: 3, mateMagicLevels: [MAGIC_MAX_LEVEL, 1, 2] }
    expect(stageSkillTargets(out)).toEqual([2])
    const card = stageSkillCard(out, 2)
    expect(card).toMatchObject({ code: 'cat-skill', name: '눈꽃냥 스킬 강화', target: 2 })
    expect(card.level).toEqual({ from: 2, to: 3 })
    expect(applyCard(out, card).mateMagicLevels).toEqual([MAGIC_MAX_LEVEL, 1, 3])
    // 최고 레벨인 고양이는 더 오르지 않는다.
    expect(applyCard(out, { ...card, target: 0 }).mateMagicLevels).toEqual(out.mateMagicLevels)
  })
  it('데려온 고양이가 있으면 각성·마법 강화 카드 대신 고양이와 스킬 강화가 나온다', () => {
    const state = { ...base, mates: 1 }
    const seen = new Set<string>()
    for (let seed = 0; seed < 400; seed++) {
      for (const c of pickCards(state, rng(seed), true)) {
        seen.add(c.code)
        if (c.code === 'cat') expect(c.name).toBe('하늘냥 출전')
        if (c.code === 'cat-skill') expect(c.name).toBe('밤냥 스킬 강화')
      }
    }
    expect(seen.has('cat') && seen.has('cat-skill') && seen.has('rally')).toBe(true)
    expect(seen.has('cat-magic') || seen.has('cat-up')).toBe(false)
  })
})

describe('디펜스 스테이지의 사장냥 스킬 카드 (676번)', () => {
  it('총에 붙는 불장·상한가만 나온다', () => {
    const levels = { water: 0, meteor: 0, lightning: 0, earth: 0, mates: 0 }
    const seen = new Set<string>()
    for (let seed = 0; seed < 400; seed++) {
      for (const card of pickCards(levels, rng(seed), true, DEFENSE_SKILL_CODES)) {
        if ((SKILL_CODES as readonly string[]).includes(card.code)) seen.add(card.code)
      }
    }
    expect([...seen].sort()).toEqual(['limitUp', 'rally'])
  })
})

describe('마법은 고양이의 것 (678번, 디펜스 스테이지)', () => {
  const team = [
    { name: '밤냥', skills: ['메테오'] },
    { name: '하늘냥', skills: [] },
  ]
  const codes = (state: Parameters<typeof pickCards>[0]) => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 400; seed++) {
      for (const card of pickCards(state, rng(seed), true, DEFENSE_SKILL_CODES, true)) {
        expect(new Set(pickCards(state, rng(seed), true, DEFENSE_SKILL_CODES, true)).size).toBe(3)
        seen.add(card.code)
      }
    }
    return seen
  }
  it('사장냥이 배우는 마법 카드는 나오지 않고, 메테오는 밤냥의 카드로만 온다', () => {
    const base = { ...BASE_LOADOUT, stageCats: team, mateMagicLevels: [1, 1] }
    const before = codes(base)
    for (const magic of MAGICS) expect(before.has(magic)).toBe(false)
    expect(before.has('cat')).toBe(true)
    // 밤냥이 나오기 전에는 스킬 강화도 없다: 나온 뒤에야 메테오를 올린다.
    expect(before.has('cat-skill')).toBe(false)
    const after = codes({ ...base, mates: 1 })
    expect(after.has('cat-skill')).toBe(true)
    for (const magic of MAGICS) expect(after.has(magic)).toBe(false)
  })
  it('출전한 고양이가 없으면 마법도 이름 없는 동료도 없다', () => {
    const seen = codes({ ...BASE_LOADOUT })
    expect([...seen].sort()).toEqual(['atk', 'limitUp', 'rally', 'spd'])
  })
})
