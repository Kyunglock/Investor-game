import type { Company } from '@web/api/client'
import { autoPlace } from '@web/features/raising/placement'
import { useRaisingStore } from '@web/features/raising/store'

export type FirstPlayStep = 'welcome' | 'team' | 'ready' | 'play' | 'done'
export const FIRST_PLAY_KEY = 'investor-game.first-play.v1'

export function firstQuarter(c: Company) {
  return (
    c.status !== 'ENDED' &&
    c.number === 1 &&
    c.year === 1 &&
    c.quarter === 1 &&
    !c.lastQuarter &&
    !c.lastSettlement
  )
}

export function readFirstPlay(c: Company): FirstPlayStep {
  try {
    const saved = localStorage.getItem(`${FIRST_PLAY_KEY}:${c.companyId}`)
    if (['welcome', 'team', 'ready', 'play', 'done'].includes(saved ?? ''))
      return saved as FirstPlayStep
  } catch {
    /* 저장 불가 환경에서도 이번 화면 안내는 동작한다. */
  }
  return c.invest?.outcome ? 'play' : 'welcome'
}

export function saveFirstPlay(c: Company, step: FirstPlayStep) {
  try {
    localStorage.setItem(`${FIRST_PLAY_KEY}:${c.companyId}`, step)
  } catch {
    /* 메모리 상태로 이어간다. */
  }
}

let pending: { id: Company['companyId']; task: Promise<void> } | null = null

/** 첫 판 준비만 한다. 회의 결정·전투 시작·분기 결산은 반드시 사용자가 누른다. */
export function prepareFirstPlay(c: Company): Promise<void> {
  if (pending?.id === c.companyId) return pending.task
  const task = (async () => {
    const state = useRaisingStore.getState
    const current = () => {
      const latest = state().company
      if (!latest || latest.companyId !== c.companyId || !firstQuarter(latest))
        throw new Error('회사 상태가 바뀌었어요. 다시 들어와 주세요.')
      if (state().error) throw new Error(state().error ?? '준비하지 못했어요.')
      return latest
    }
    useRaisingStore.setState({ error: null })
    let latest = current()
    if (latest.invest?.outcome) return
    if (latest.employees.length === 0) {
      await state().draw(1)
      // 첫 채용은 준비 과정이다. 별도의 뽑기 결과 창 대신 안내 카드에서 동료를 소개한다.
      useRaisingStore.setState({ justDrew: false })
      latest = current()
      if (latest.employees.length === 0)
        throw new Error('첫 동료를 준비하지 못했어요. 다시 시도해 주세요.')
    }
    if (!latest.employees.some((e) => latest.desks.some((d) => d.code === e.desk && d.trades))) {
      await state().place(autoPlace(latest))
      latest = current()
    }
    if (!latest.invest?.ready) {
      const ready = await state().scout()
      current()
      if (!ready) throw new Error('첫 종목회의를 준비하지 못했어요. 다시 시도해 주세요.')
    }
  })()
  pending = { id: c.companyId, task }
  void task
    .finally(() => {
      if (pending?.task === task) pending = null
    })
    .catch(() => {})
  return task
}
