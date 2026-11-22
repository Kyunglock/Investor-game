import type { Company } from '@web/api/client'
import { useRaisingStore } from '@web/features/raising/store'
import { useEffect, useEffectEvent } from 'react'
import { create } from 'zustand'
import { MAX_BATCH, queuedCost } from '../app/toy-city/upgradeQueue'

/**
 * 지정 자동 강화 (decisions.md 653번): 성장 탭에서 고른 능력치를 돈이 모이는 대로 저절로 강화한다. 고른 것은 이 기기에 회사마다 저장한다.
 * 고른 것 가운데 지금 가장 싼 것부터 사서 고루 오른다.
 */
export type UpgradeKind = NonNullable<Company['battleUpgrades']>[number]['kind']
type Upgrade = NonNullable<Company['battleUpgrades']>[number]

const key = (companyId: string) => `auto-upgrade:${companyId}`

function read(companyId: string): UpgradeKind[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(companyId)) ?? '[]')
    return Array.isArray(raw) ? raw.filter((k): k is UpgradeKind => typeof k === 'string') : []
  } catch {
    return []
  }
}

interface AutoUpgrade {
  companyId: string | null
  kinds: UpgradeKind[]
  load: (companyId: string) => void
  toggle: (kind: UpgradeKind) => void
}

export const useAutoUpgrade = create<AutoUpgrade>((set, get) => ({
  companyId: null,
  kinds: [],
  load: (companyId) => {
    if (get().companyId !== companyId) set({ companyId, kinds: read(companyId) })
  },
  toggle: (kind) => {
    const { companyId, kinds } = get()
    const next = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind]
    set({ kinds: next })
    if (!companyId) return
    try {
      localStorage.setItem(key(companyId), JSON.stringify(next))
    } catch {
      // 저장하지 못해도 이번에는 그대로 쓴다.
    }
  },
}))

/** 지금 살 것: 고른 능력치 가운데 끝까지 오르지 않았고 한 단계라도 살 수 있는 것 중 가장 싼 것을, 가진 돈으로 살 수 있는 만큼(최대 100단계). */
export function nextAutoBuy(
  upgrades: readonly Upgrade[],
  capital: number,
  kinds: readonly UpgradeKind[],
): { kind: UpgradeKind; levels: number } | null {
  const pick = upgrades
    .filter((u) => kinds.includes(u.kind))
    .filter((u) => !(u.maxLevel > 0 && u.level >= u.maxLevel) && u.price <= capital)
    .sort((a, b) => a.price - b.price)[0]
  if (!pick) return null
  let levels = pick.maxLevel > 0 ? Math.min(MAX_BATCH, pick.maxLevel - pick.level) : MAX_BATCH
  while (levels > 1 && queuedCost(pick.price, pick.priceGrowthPercent, 0, levels) > capital)
    levels--
  return { kind: pick.kind, levels }
}

/** 고른 능력치를 1.5초마다 살펴 살 수 있으면 산다. 한 번에 하나만 보낸다. */
export function useAutoUpgradeLoop(company: Company, connected: boolean) {
  const load = useAutoUpgrade((s) => s.load)
  const kinds = useAutoUpgrade((s) => s.kinds)
  useEffect(() => load(company.companyId), [load, company.companyId])
  const tick = useEffectEvent(async () => {
    const store = useRaisingStore.getState()
    const now = store.company
    if (!now || store.busy) return
    const buy = nextAutoBuy(now.battleUpgrades ?? [], now.capital, kinds)
    if (buy) await store.buyBattleUpgrade(buy.kind, buy.levels)
  })
  const on = connected && kinds.length > 0
  useEffect(() => {
    if (!on) return
    let running = false
    const timer = window.setInterval(() => {
      if (running) return
      running = true
      void tick().finally(() => {
        running = false
      })
    }, 1500)
    return () => window.clearInterval(timer)
  }, [on])
}
