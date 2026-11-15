import { useEffect } from 'react'

/** 게임은 앱 화면(/app/)에서 한다 (#803). 분기를 넘기던 옛 웹 게임은 내렸다. */
const APP_URL = '/app/'

/** 첫 화면: 게임 이름과 앱 화면으로 가는 버튼. 배포한 곳에서는 곧바로 앱 화면으로 옮긴다. */
export function App() {
  useEffect(() => {
    if (import.meta.env.PROD) {
      window.location.replace(APP_URL)
    }
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-5 px-4 py-6 text-center">
      <h1 className="font-pen text-[40px] font-normal leading-tight text-pen">
        흔들리지 않는 고양이
      </h1>
      <p className="text-sm text-muted">게임은 앱 화면에서 해요.</p>
      <a
        href={APP_URL}
        className="inline-flex min-h-12 items-center rounded-full bg-wine px-8 text-base font-semibold text-white"
        data-testid="start"
      >
        게임 시작
      </a>
    </main>
  )
}
