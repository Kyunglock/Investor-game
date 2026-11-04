import createClient from 'openapi-fetch'
import type { components, paths } from './schema'
import { deepSpouseTerms, sexOfResponse } from './spouseTerms'
import { CLIENT_ID, lostToOtherWindow } from './window'

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

/** 모든 요청에 창 ID를 싣고, 다른 창이 판을 넘겨받았다는 409(OTHER_WINDOW)를 받으면 이 창을 보기 전용으로 (#189). */
api.use({
  onRequest({ request }) {
    request.headers.set('X-Client-Id', CLIENT_ID)
    return request
  },
  async onResponse({ response }) {
    if (response.status === 409) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null)
      if ((body as { code?: string } | null)?.code === 'OTHER_WINDOW') {
        lostToOtherWindow()
      }
    }
    return undefined
  },
})

/** 서버 문구의 "배우자"는 내 성별에 맞춰 남편·아내로 바꿔 받는다. 성별이 실린 응답(Game, 선택 결과)만 (decisions.md 91번). */
api.use({
  async onResponse({ response }) {
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) {
      return undefined
    }
    const body: unknown = await response.clone().json()
    const sex = sexOfResponse(body)
    if (sex === null) {
      return undefined
    }
    return new Response(JSON.stringify(deepSpouseTerms(body, sex)), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  },
})

type Schemas = components['schemas']
export type Game = Schemas['Game']
export type Stats = Schemas['Stats']
export type Phase = Schemas['Phase']
export type PendingEvent = Schemas['PendingEvent']
export type Outcome = Schemas['Outcome']
export type LogEntry = Schemas['LogEntry']
export type YearlyAsset = Schemas['Yearly']
export type Holding = Schemas['Holding']
export type StockQuote = Schemas['StockQuote']
export type Market = Schemas['Market']
export type Household = Schemas['Household']
export type Sex = Schemas['Sex']
export type StockHistory = Schemas['StockHistory']
export type TradeSide = Schemas['TradeRequest']['side']
export type MarketOverview = Schemas['MarketOverview']
export type Indicator = MarketOverview['indicators'][number]
export type NewsItem = MarketOverview['newspaper'][number]
export type StockAnalysis = Schemas['StockAnalysis']
export type Analysis = Schemas['Analysis']
