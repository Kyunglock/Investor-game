import { describe, expect, it } from 'vitest'
import { IdleContacts } from './idleContacts'

describe('actual wall contacts', () => {
  it('reports no damage just because a heartbeat passes', () => {
    const contacts = new IdleContacts()
    expect(contacts.drain()).toEqual([])
    expect(contacts.drain()).toEqual([])
  })
  it('batches actual hits by wall, kind and depth exactly once', () => {
    const contacts = new IdleContacts()
    expect(contacts.add(10, 'bullet', 0, 1)).toBe(true)
    contacts.add(10, 'bullet', 0, 0.75)
    contacts.add(11, 'bullet', 1, 0.5)
    contacts.add(11, 'bullet', 0, 1)
    contacts.add(10, 'meteor', 0, 2.4)
    expect(contacts.drain()).toEqual([
      { wall: 10, kind: 'bullet', depth: 0, count: 2, damage: 1.75 },
      { wall: 11, kind: 'bullet', depth: 1, count: 1, damage: 0.5 },
      { wall: 11, kind: 'bullet', depth: 0, count: 1, damage: 1 },
      { wall: 10, kind: 'meteor', depth: 0, count: 1, damage: 2.4 },
    ])
    expect(contacts.drain()).toEqual([])
  })
  it('accepts the aurora on both queued walls and rejects other spells or deeper hits', () => {
    const contacts = new IdleContacts()
    expect(contacts.add(11, 'auroraNight', 1, 12)).toBe(true)
    expect(contacts.add(12, 'auroraNight', 2, 12)).toBe(true)
    expect(contacts.drain().map((hit) => hit.damage)).toEqual([12, 12])
    expect(contacts.add(13, 'auroraNight', 3, 12)).toBe(false)
    expect(contacts.add(11, 'meteor', 1, 2.4)).toBe(false)
    expect(contacts.add(13, 'bullet', 3, 1)).toBe(false)
    expect(contacts.add(0, 'bullet', 0, 1)).toBe(false)
    expect(contacts.drain()).toEqual([])
  })
  it('clears pending hits on stop or reconnect', () => {
    const contacts = new IdleContacts()
    contacts.add(10, 'water', 0, 1.5)
    contacts.clear()
    expect(contacts.drain()).toEqual([])
  })
  it('ignores invalid damage and caps count and damage together', () => {
    const contacts = new IdleContacts()
    for (const damage of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(contacts.add(10, 'bullet', 0, damage)).toBe(false)
    }
    expect(contacts.drain()).toEqual([])
    for (let i = 0; i < 1005; i++) contacts.add(10, 'bullet', 0, 0.75)
    expect(contacts.drain()).toEqual([
      { wall: 10, kind: 'bullet', depth: 0, count: 1000, damage: 750 },
    ])
  })
  it('never sends more entries than the API takes, and loses no direct damage to that', () => {
    const contacts = new IdleContacts()
    for (let wall = 1; wall <= 80; wall++) {
      expect(contacts.add(wall, 'bullet', 0, 1)).toBe(true)
      contacts.add(wall + 1, 'bullet', 1, 0.5)
    }
    const hits = contacts.drain()
    expect(hits).toHaveLength(60)
    const direct = hits.filter((hit) => hit.depth === 0)
    expect(direct.reduce((sum, hit) => sum + hit.damage, 0)).toBe(80)
    expect(direct.reduce((sum, hit) => sum + hit.count, 0)).toBe(80)
  })
})
