import { parseArgs } from 'node:util'
import createClient from 'openapi-fetch'
import type { components, paths } from '../../src/api/schema.d.ts'
import {
  choose,
  freeTrade,
  jitter,
  PERSONAS,
  type Persona,
  type Random,
  seeded,
} from './personas.ts'

// 봇 플레이어로 행동 프로필을 쌓는다 (행동 프로필·봇 설계 4절). 실제 API로 한 판을 70세까지 플레이한다.
//   pnpm bots --base http://localhost:8080 --token "$ADMIN_TOKEN" --games 50
// 판이 끝나면 서버가 result_profile에 익명 프로필을 쌓고, 봇 세션이라 페르소나가 붙는다.

type Game = components['schemas']['Game']

/** 시계를 한 번에 이만큼만 보낸다. 사이사이 자유 매매를 할 틈이 된다. */
const REPORT_EVERY_DAYS = 90
const MAX_STEPS = 5000

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:8080' },
    token: { type: 'string', default: process.env.ADMIN_TOKEN ?? '' },
    games: { type: 'string', default: '50' },
    concurrency: { type: 'string', default: '4' },
    seed: { type: 'string', default: '1' },
    personas: { type: 'string', default: PERSONAS.map((p) => p.code).join(',') },
  },
})

if (!values.token) {
  throw new Error('관리자 토큰이 필요하다 (--token 또는 ADMIN_TOKEN)')
}
const wanted = values.personas.split(',')
const personas = PERSONAS.filter((p) => wanted.includes(p.code))
const gamesPerPersona = Number(values.games)
const seed = Number(values.seed)

interface Job {
  persona: Persona
  index: number
}

const jobs: Job[] = personas.flatMap((persona) =>
  Array.from({ length: gamesPerPersona }, (_, index) => ({ persona, index })),
)

async function play(job: Job): Promise<string> {
  const random: Random = seeded(
    seed * 1_000_003 + PERSONAS.indexOf(job.persona) * 10_007 + job.index,
  )
  const persona = jitter(job.persona, random)
  const cookie = await botSession(persona.code)
  const api = createClient<paths>({ baseUrl: values.base, headers: { cookie } })

  let game = unwrap(await api.POST('/api/games'))
  const endDay = (game.endAge - game.startAge) * game.daysPerYear
  for (let step = 0; step < MAX_STEPS && game.status === 'ACTIVE'; step++) {
    if (game.pendingEvent) {
      const option = choose(persona, game, random)
      game = unwrap(
        await api.POST('/api/games/{gameId}/events/{eventId}/choose', {
          params: { path: { gameId: game.gameId, eventId: game.pendingEvent.eventId } },
          body: { option },
        }),
      ).game
      continue
    }
    const trade = freeTrade(persona, game, random)
    if (trade) {
      game = unwrap(
        await api.POST('/api/games/{gameId}/trades', {
          params: { path: { gameId: game.gameId } },
          body: trade,
        }),
      ).game
    }
    const day = Math.min(game.day + REPORT_EVERY_DAYS, game.nextEventDay ?? endDay, endDay)
    game = unwrap(
      await api.POST('/api/games/{gameId}/advance', {
        params: { path: { gameId: game.gameId } },
        body: { day },
      }),
    )
  }
  return summary(job.persona.code, game)
}

async function botSession(persona: string): Promise<string> {
  const response = await fetch(`${values.base}/api/admin/bot-sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Admin-Token': values.token },
    body: JSON.stringify({ persona }),
  })
  if (response.status !== 204) {
    throw new Error(`봇 세션 발급 실패 ${response.status}: ${await response.text()}`)
  }
  const cookie = response.headers.getSetCookie().find((c) => c.startsWith('IG_SESSION='))
  if (!cookie) {
    throw new Error('봇 세션 쿠키가 없다')
  }
  return cookie.split(';')[0]
}

function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data === undefined) {
    throw new Error(
      `${result.response.status} ${result.response.url}: ${JSON.stringify(result.error)}`,
    )
  }
  return result.data
}

function summary(persona: string, game: Game): string {
  const result = game.result
  if (!result) {
    return `${persona}\t끝나지 않음 (${game.status}, ${game.day}일)`
  }
  return `${persona}\t${result.ending}\t${result.finalAge}세\t최종 자산 ${result.finalAsset.toLocaleString('ko-KR')}원`
}

let next = 0
let failed = 0
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++]
    try {
      console.log(await play(job))
    } catch (e) {
      failed++
      console.error(`${job.persona.code}#${job.index} 실패:`, e instanceof Error ? e.message : e)
    }
  }
}

await Promise.all(Array.from({ length: Number(values.concurrency) }, worker))
console.log(`끝: ${jobs.length - failed}/${jobs.length}판`)
process.exitCode = failed > 0 ? 1 : 0
