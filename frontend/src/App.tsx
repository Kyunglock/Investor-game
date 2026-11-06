import { useEffect } from 'react'
import { useCompanyAutoPlay } from './features/raising/autoPlay'
import { CompanyScreen } from './features/raising/CompanyScreen'
import { CompanyStart } from './features/raising/CompanyStart'
import { useRaisingStore } from './features/raising/store'

export function App() {
  return <Raising />
}

/** 증권사 (증권사 육성 설계). 회사가 있으면 회사, 없으면 사장의 사재로 회사를 차리는 시작 화면 (decisions.md 228번). */
function Raising() {
  const status = useRaisingStore((s) => s.status)
  const company = useRaisingStore((s) => s.company)
  const busy = useRaisingStore((s) => s.busy)
  const error = useRaisingStore((s) => s.error)
  const { load, open } = useRaisingStore.getState()
  // 자동 진행은 회사 화면이 다시 그려져도 이어지도록 여기서 돈다 (245번).
  useCompanyAutoPlay()

  useEffect(() => {
    void load()
  }, [load])

  const screen = () => {
    if (company) {
      // 직원이 들고 나거나 해가 바뀌면 배치 칸을 새로 그린다.
      const key = `${company.companyId}-${company.year}-${company.employees.map((e) => e.id).join('.')}`
      return <CompanyScreen key={key} company={company} />
    }
    return <CompanyStart onOpen={() => void open()} busy={busy} error={error} />
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
