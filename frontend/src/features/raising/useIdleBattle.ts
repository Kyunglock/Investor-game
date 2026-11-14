import { useEffect, useRef, useState } from 'react'
import { API_BASE, api } from '../../api/client'
import { type IdleContact, IdleContacts } from './idleContacts'
import { useRaisingStore } from './store'

// Heartbeats leave in the order they were made, even across a remount: a late start from the
// previous loop must not land after the next loop's start and take the run back (decisions.md 492).
let queue: Promise<unknown> = Promise.resolve()
function inOrder<T>(send: () => Promise<T>): Promise<T> {
  const sent = queue.then(send, send)
  queue = sent.catch(() => undefined)
  return sent
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
    let disposed = false
    let nativeActive = true
    let runId = crypto.randomUUID()
    // The sequence never goes back, even across runs and reloads: the screen compares it with the
    // server's last handled beat to know which hits are already in the wall health (decisions.md 496).
    let sequence = useRaisingStore.getState().company?.idle?.sequence ?? 0
    let started = false
    let pending = false
    // The screen's wall ran out while a beat was in flight: ask again as soon as it lands (decisions.md 506).
    let urgent = false
    let blocked = false
    let generation = 0
    const contacts = new IdleContacts()
    const visible = () => !document.hidden && nativeActive
    const stop = () => {
      contacts.clear()
      // The server drops pending hits on a stop or a gap, so the renderer forgets its early damage.
      window.dispatchEvent(new Event('idle-hits-clear'))
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
      if (before?.companyId !== companyId || before.status !== 'ACTIVE') return
      pending = true
      const version = generation
      try {
        const body = {
          runId,
          sequence: ++sequence,
          action: started ? ('tick' as const) : ('start' as const),
          hits: started ? contacts.drain() : [],
        }
        if (started)
          window.dispatchEvent(new CustomEvent('idle-hits-sent', { detail: body.sequence }))
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
        if (urgent) {
          urgent = false
          void tick()
        }
      }
    }
    // The server alone breaks a wall. Waiting for the next one-second beat left the wall standing at
    // "100주" and threw the hits of that second away, so the hits go out at once (decisions.md 506).
    const wallDown = () => {
      if (!started || blocked || disposed || !visible()) return
      if (pending) urgent = true
      else void tick()
    }
    const hit = (event: Event) => {
      if (!started || blocked || disposed || !visible()) return
      const company = useRaisingStore.getState().company
      if (company?.companyId !== companyId || !company.idle || company.idle.circuitSeconds) return
      const { wall, kind, damage } = (event as CustomEvent<IdleContact>).detail
      contacts.add(wall, kind, company.idle.wall, damage)
    }
    const clearContacts = () => contacts.clear()
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
    window.addEventListener('idle-hits-clear', clearContacts)
    window.addEventListener('idle-wall-down', wallDown)
    window.addEventListener('idle-app-active', native)
    const timer = setInterval(() => void tick(), 1000)
    void tick()
    return () => {
      disposed = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', stop)
      window.removeEventListener('idle-wall-hit', hit)
      window.removeEventListener('idle-hits-clear', clearContacts)
      window.removeEventListener('idle-wall-down', wallDown)
      window.removeEventListener('idle-app-active', native)
      stop()
    }
  }, [companyId])
  return { connected, blocked, resume: () => resume.current() }
}
