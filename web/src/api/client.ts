import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

/** 계약은 contracts/openapi/game.yaml. 타입은 `pnpm gen:api`로 생성한다. */
export const api = createClient<paths>({ baseUrl: '' })

export type Game = components['schemas']['Game']
export type Stats = components['schemas']['Stats']
export type Phase = components['schemas']['Phase']
