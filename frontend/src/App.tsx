import { useEffect, useState } from 'react'
import { CompanyScreen } from './features/raising/CompanyScreen'
import { CompanyStart } from './features/raising/CompanyStart'
import { IdleBattle } from './features/raising/IdleBattle'
import { useRaisingStore } from './features/raising/store'
import { useTutorial } from './features/raising/tutorial'
import { useIdleBattle } from './features/raising/useIdleBattle'

export function App() {
  return <Raising />
}

/** 증권사 (증권사 육성 설계). 회사가 있으면 회사, 없으면 사장의 사재로 회사를 차리는 시작 화면 (decisions.md 228번). */
function Raising() {
  const status = useRaisingStore((s) => s.status)
  const company = useRaisingStore((s) => s.company)
  const connected = useIdleBattle(company?.companyId)
  const [manage, setManage] = useState(false)
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { load, open } = useRaisingStore.getState()

  useEffect(() => {
    void load()
  }, [load])

  const screen = () => {
    if (company) {
      // 직원이 들고 나거나 분기가 바뀌면(268번) 배치 칸과 회의 창을 새로 그린다.
      const key = `${company.companyId}-${company.year}-${company.quarter}-${company.employees.map((e) => e.id).join('.')}`
      return manage ? (
        <>
          <button type="button" className="btn" onClick={() => setManage(false)}>
            ← 자동 매도벽 돌파
          </button>
          <CompanyScreen key={key} company={company} />
        </>
      ) : (
        <IdleBattle company={company} connected={connected} onManage={() => setManage(true)} />
      )
    }
    // 튜토리얼과 함께 시작하면 켜고 차린다 (302번). 바로 시작은 켜지 않고, 전에 보던 중이었으면 그대로 이어진다.
    return (
      <CompanyStart
        onOpen={(tutorial) => {
          if (tutorial) {
            useTutorial.getState().start()
          }
          void open()
        }}
        busy={busy}
        error={error}
      />
    )
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {status === 'loading' && <p className="text-muted">불러오는 중…</p>}
        {status === 'error' && (
          <p role="alert" className="text-wine">
            서버에 연결할 수 없습니다.
          </p>
        )}
        {status === 'ready' && screen()}
      </main>
    </div>
  )
}
