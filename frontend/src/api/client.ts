import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

/**
 * 요청이 이만큼 넘게 걸리면 끊는다. 모바일에서 다른 앱에 갔다 오면 진행 중이던 요청이 응답 없이 멈춰, 선택 버튼이 잠긴 채로 남았다.
 * 끊으면 부르는 쪽(store의 safely)이 잠금을 풀고 서버 상태로 다시 맞춘다.
 */
export const REQUEST_TIMEOUT_MS = 10_000

/** 진행 중인 요청. 화면이 가려진 동안 걸려 있던 요청은 돌아오자마자 끊는다(가려진 동안은 시간 초과 타이머도 얼어 있다). */
const inFlight = new Set<{ controller: AbortController; hidden: boolean }>()

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    for (const request of inFlight) {
      if (document.hidden) {
        request.hidden = true
      } else if (request.hidden) {
        request.controller.abort()
      }
    }
  })
}

function timedFetch(request: Request): Promise<Response> {
  const controller = new AbortController()
  const entry = { controller, hidden: typeof document !== 'undefined' && document.hidden }
  inFlight.add(entry)
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  return fetch(request, { signal: controller.signal }).finally(() => {
    clearTimeout(timer)
    inFlight.delete(entry)
  })
}

/** 계약은 contracts/openapi/game.yaml. 타입은 `pnpm gen:api`로 생성한다. */
export const api = createClient<paths>({ baseUrl: '', fetch: timedFetch })

type Schemas = components['schemas']
export type Grade = Schemas['Grade']
export type Company = Schemas['Company']
export type Applicant = Company['applicants'][number]
