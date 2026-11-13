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
    contacts.add(10, 'bullet', 10, 1)
    contacts.add(10, 'bullet', 10, 0.75)
    contacts.add(11, 'meteor', 10, 2.4)
    expect(contacts.drain()).toEqual([
      { wall: 10, kind: 'bullet', count: 2, damage: 1.75 },
      { wall: 11, kind: 'meteor', count: 1, damage: 2.4 },
    ])
    expect(contacts.drain()).toEqual([])
  })
  it('drops stale walls and clears pending hits on stop or reconnect', () => {
    const contacts = new IdleContacts()
    contacts.add(9, 'bullet', 10, 1)
    contacts.add(13, 'meteor', 10, 4.8)
    contacts.add(10, 'water', 10, 1.5)
    contacts.clear()
    expect(contacts.drain()).toEqual([])
  })
  it('ignores invalid damage and caps count and damage together', () => {
    const contacts = new IdleContacts()
    for (const damage of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      contacts.add(10, 'bullet', 10, damage)
    }
    expect(contacts.drain()).toEqual([])
    for (let i = 0; i < 1005; i++) contacts.add(10, 'bullet', 10, 0.75)
    expect(contacts.drain()).toEqual([{ wall: 10, kind: 'bullet', count: 1000, damage: 750 }])
  })
})
