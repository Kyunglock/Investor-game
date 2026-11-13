import { describe, expect, it } from 'vitest'
import { IdleContacts } from './idleContacts'

describe('actual wall contacts', () => {
  it('reports no damage just because a heartbeat passes', () => {
    const contacts = new IdleContacts()
    expect(contacts.drain()).toEqual([])
    expect(contacts.drain()).toEqual([])
  })
  it('batches actual hits by wall and kind exactly once', () => {
    const contacts = new IdleContacts()
    contacts.add(10, 'bullet', 10)
    contacts.add(10, 'bullet', 10)
    contacts.add(11, 'meteor', 10)
    expect(contacts.drain()).toEqual([
      { wall: 10, kind: 'bullet', count: 2 },
      { wall: 11, kind: 'meteor', count: 1 },
    ])
    expect(contacts.drain()).toEqual([])
  })
  it('drops stale walls and clears pending hits on stop or reconnect', () => {
    const contacts = new IdleContacts()
    contacts.add(9, 'bullet', 10)
    contacts.add(13, 'meteor', 10)
    contacts.add(10, 'water', 10)
    contacts.clear()
    expect(contacts.drain()).toEqual([])
  })
})
