import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

/** 계약은 contracts/openapi/game.yaml. 타입은 `pnpm gen:api`로 생성한다. */
export const api = createClient<paths>({ baseUrl: '' })

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
export type StockHistory = Schemas['StockHistory']
export type TradeSide = Schemas['TradeRequest']['side']
export type MarketOverview = Schemas['MarketOverview']
export type Indicator = MarketOverview['indicators'][number]
export type NewsItem = MarketOverview['newspaper'][number]
export type StockAnalysis = Schemas['StockAnalysis']
export type Analysis = Schemas['Analysis']
