import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { API_BASE, api } from '../../api/client'
import { type IdleContact, IdleContacts } from './idleContacts'
import { IdlePredictor, type IdleServer, type IdleShown } from './idlePredict'
import { useRaisingStore } from './store'

// The screen breaks the wall first and the heartbeat below saves it afterwards (decisions.md 532):
// every hit that will be sent is also replayed here on top of the server's last answer.
const predictor = new IdlePredictor()
let predicted: string | undefined
const NEW_WALL: IdleShown = {
  wall: 1,
  hp: 120,
  maxHp: 120,
  upcoming: [],
  circuitSeconds: 0,
  serial: 0,
}

/** The wall and health to show for the server's `company.idle`: its state plus the hits it has not handled yet. */
export function shownIdle(idle: IdleServer | null | undefined): IdleShown {
  return idle ? predictor.view(idle) : NEW_WALL
}

/** `shownIdle` for React: renders again when the shown wall number or trading halt changes. */
export function useShownIdle(idle: IdleServer | null | undefined): IdleShown {
  useSyncExternalStore(predictor.subscribe, predictor.shownKey)
  return shownIdle(idle)
}

// Heartbeats leave in the order they were made, even across a remount: a late start from the
// previous loop must not land after the next loop's start and take the run back (decisions.md 492).
let queue: Promise<unknown> = Promise.resolve()
function inOrder<T>(send: () => Promise<T>): Promise<T> {
  const sent = queue.then(send, send)
  queue = sent.catch(() => undefined)
  return sent
}

/** Moves under way: hits on the wall being left do not count on the wall the fight moves to. */
let moving = 0

/**
 * 환생 (decisions.md 571번): 매도벽 1로 돌아가고 생선을 받는다. 접속 신호와 차례를 지켜 보내고, 아직 보내지 않은 명중은 떠나는 벽과 함께
 * 버린다. 환생했으면 true. 거절되면(첫 보스를 깨기 전) 그 까닭이 store의 error에 남는다.
 */
export async function rebirthIdle(): Promise<boolean> {
  moving++
  window.dispatchEvent(new Event('idle-moved'))
  predictor.clear()
  try {
    const res = await inOrder(() => api.POST('/api/company/rebirth'))
    if (!res.data) {
      useRaisingStore.setState({ error: res.error?.message ?? '환생하지 못했어요' })
      return false
    }
    useRaisingStore.setState({ company: res.data, error: null })
    return true
  } catch {
    useRaisingStore.setState({ error: '연결이 끊겼어요. 다시 시도해 주세요.' })
    return false
  } finally {
    moving--
    window.dispatchEvent(new Event('idle-moved'))
    predictor.clear()
  }
}

/**
 * One foreground heartbeat loop per application; server owns all progress. `blocked` means the
 * server refused this screen because another one holds the run; `resume` takes the run back.
 */
export function useIdleBattle(companyId?: string) {
  const [connected, setConnected] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const resume = useRef(() => {})
  useEffect(() => {
    if (!companyId) return
    // Nothing shown for another company counts here.
    if (predicted !== companyId) predictor.reset()
    predicted = companyId
    let disposed = false
    let nativeActive = true
    let runId = crypto.randomUUID()
    // The sequence never goes back, even across runs and reloads: the screen compares it with the
    // server's last handled beat to know which hits are already in the wall health (decisions.md 496).
    let sequence = useRaisingStore.getState().company?.idle?.sequence ?? 0
    let started = false
    let pending = false
    let blocked = false
    let generation = 0
    const contacts = new IdleContacts()
    const visible = () => !document.hidden && nativeActive
    const stop = () => {
      contacts.clear()
      // The server drops pending hits on a stop or a gap, so the screen stops counting on them.
      predictor.clear()
      generation++
      started = false
      setConnected(false)
      const body = JSON.stringify({ runId, sequence: ++sequence, action: 'stop' })
      void inOrder(() =>
        fetch(`${API_BASE}/api/company/idle`, {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
      ).catch(() => {})
      runId = crypto.randomUUID()
    }
    const tick = async () => {
      if (disposed || blocked || pending || !visible() || useRaisingStore.getState().busy) return
      const before = useRaisingStore.getState().company
      if (before?.companyId !== companyId) return
      pending = true
      const version = generation
      try {
        const body = {
          runId,
          sequence: ++sequence,
          action: started ? ('tick' as const) : ('start' as const),
          hits: started ? contacts.drain() : [],
        }
        // The hits so far leave with this beat: they are forgotten when the server has handled it (496).
        if (started) predictor.sent(body.sequence)
        const res = await inOrder(() => api.POST('/api/company/idle', { body }))
        if (disposed || version !== generation || !visible()) return
        if (!res.data) {
          blocked = res.response.status === 400
          setBlocked(blocked)
          stop()
          return
        }
        started = true
        setConnected(true)
        // Never overwrite an upgrade or other action that completed during the request.
        if (useRaisingStore.getState().company === before) {
          useRaisingStore.setState({ company: res.data })
        }
      } catch {
        if (!disposed && version === generation) stop()
      } finally {
        pending = false
      }
    }
    const hit = (event: Event) => {
      if (!started || blocked || disposed || !visible() || moving > 0) return
      const company = useRaisingStore.getState().company
      // No hit counts during a trading halt, the screen's own (532) or the server's.
      if (company?.companyId !== companyId || !company.idle) return
      if (shownIdle(company.idle).circuitSeconds > 0) return
      const { wall, kind, depth = 0, damage } = (event as CustomEvent<Partial<IdleContact>>).detail
      if (wall === undefined || kind === undefined || damage === undefined) return
      // Only what the heartbeat will carry is shown: the two must not drift apart.
      if (contacts.add(wall, kind, depth, damage)) predictor.add({ wall, depth, damage })
    }
    const visibility = () => {
      if (!visible()) stop()
      else resume.current()
    }
    resume.current = () => {
      blocked = false
      setBlocked(false)
      void tick()
    }
    const native = (event: Event) => {
      nativeActive = (event as CustomEvent<boolean>).detail
      visibility()
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', stop)
    window.addEventListener('idle-wall-hit', hit)
    window.addEventListener('idle-app-active', native)
    const moved = () => contacts.clear()
    window.addEventListener('idle-moved', moved)
    const timer = setInterval(() => void tick(), 1000)
    void tick()
    return () => {
      disposed = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', stop)
      window.removeEventListener('idle-wall-hit', hit)
      window.removeEventListener('idle-app-active', native)
      window.removeEventListener('idle-moved', moved)
      stop()
    }
  }, [companyId])
  return { connected, blocked, resume: () => resume.current() }
}
