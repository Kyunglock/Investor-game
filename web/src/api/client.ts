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
