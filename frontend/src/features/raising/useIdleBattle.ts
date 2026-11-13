import { useEffect, useState } from 'react'
import { API_BASE, api } from '../../api/client'
import { type IdleContact, IdleContacts } from './idleContacts'
import { useRaisingStore } from './store'

/** One foreground heartbeat loop per application; server owns all progress. */
export function useIdleBattle(companyId?: string) {
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    if (!companyId) return
    let disposed = false
    let nativeActive = true
    let runId = crypto.randomUUID()
    let sequence = 0
    let started = false
    let pending = false
    let blocked = false
    let generation = 0
    const contacts = new IdleContacts()
    const visible = () => !document.hidden && nativeActive
    const stop = () => {
      contacts.clear()
      generation++
      started = false
      setConnected(false)
      void fetch(`${API_BASE}/api/company/idle`, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, sequence: ++sequence, action: 'stop' }),
      }).catch(() => {})
      runId = crypto.randomUUID()
      sequence = 0
    }
    const tick = async () => {
      if (disposed || blocked || pending || !visible() || useRaisingStore.getState().busy) return
      const before = useRaisingStore.getState().company
      if (before?.companyId !== companyId || before.status !== 'ACTIVE') return
      pending = true
      const version = generation
      try {
        const res = await api.POST('/api/company/idle', {
          body: {
            runId,
            sequence: ++sequence,
            action: started ? 'tick' : 'start',
            hits: started ? contacts.drain() : [],
          },
        })
        if (disposed || version !== generation || !visible()) return
        if (!res.data) {
          blocked = res.response.status === 400
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
      if (!started || blocked || disposed || !visible()) return
      const company = useRaisingStore.getState().company
      if (company?.companyId !== companyId || !company.idle || company.idle.circuitSeconds) return
      const { wall, kind } = (event as CustomEvent<IdleContact>).detail
      contacts.add(wall, kind, company.idle.wall)
    }
    const clearContacts = () => contacts.clear()
    const visibility = () => {
      if (!visible()) stop()
      else {
        blocked = false
        void tick()
      }
    }
    const native = (event: Event) => {
      nativeActive = (event as CustomEvent<boolean>).detail
      visibility()
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', stop)
    window.addEventListener('idle-wall-hit', hit)
    window.addEventListener('idle-hits-clear', clearContacts)
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
      window.removeEventListener('idle-app-active', native)
      stop()
    }
  }, [companyId])
  return connected
}
