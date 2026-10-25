import createClient from 'openapi-fetch'
import type { components, paths } from './schema'
import { deepSpouseTerms, sexOfResponse } from './spouseTerms'

/** 계약은 contracts/openapi/game.yaml. 타입은 `pnpm gen:api`로 생성한다. */
export const api = createClient<paths>({ baseUrl: '' })

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
