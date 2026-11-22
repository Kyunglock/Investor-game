import { describe, expect, it } from 'vitest'
import server from '../../../backend/src/main/java/investorgame/raising/internal/IdleEngine.java?raw'
import contract from '../../../contracts/openapi/game.yaml?raw'
import { CAT_LOOKS } from '../idle/loadout'
import { NEW_CATS, ROSTER_FRAMES, rosterCell } from './catRoster'
import { ROSTER_ASSETS } from './catRosterAssets'
import { MATE_LOOKS } from './mates'

/** Contract IDs, inventory selection, and combat lookup must agree for every cat. */
describe('46종 고양이', () => {
  it('사장냥 한 종과 동료 45종의 코드·전투 모습이 일치한다', () => {
    expect(MATE_LOOKS).toHaveLength(45)
    expect(NEW_CATS).toHaveLength(39)
    expect(Object.keys(CAT_LOOKS)).toHaveLength(45)
    expect(CAT_LOOKS.sky).toBe(0)
    expect(CAT_LOOKS.snow).toBe(5)
    for (const cat of NEW_CATS) {
      expect(contract).toContain(cat.code)
      expect(server).toContain(`"${cat.code}"`)
      const look = MATE_LOOKS[CAT_LOOKS[cat.code]]
      expect(look.name).toBe(cat.name)
      expect(ROSTER_ASSETS).toHaveProperty(look.poses)
    }
  })
  it('각 이미지의 실제 영역이 서로 겹치지 않고 시트 안에 있다', () => {
    for (const [atlas, sheet] of ROSTER_FRAMES.entries()) {
      expect(sheet.cells).toHaveLength(30)
      for (const [i, cell] of sheet.cells.entries()) {
        expect(cell.w).toBeGreaterThan(40)
        expect(cell.h).toBeGreaterThan(40)
        expect(cell.x).toBeGreaterThanOrEqual(0)
        expect(cell.y).toBeGreaterThanOrEqual(0)
        expect(cell.x + cell.w).toBeLessThanOrEqual(sheet.width)
        expect(cell.y + cell.h).toBeLessThanOrEqual(sheet.height)
        for (const other of sheet.cells.slice(i + 1)) {
          const overlapX = Math.min(cell.x + cell.w, other.x + other.w) - Math.max(cell.x, other.x)
          const overlapY = Math.min(cell.y + cell.h, other.y + other.h) - Math.max(cell.y, other.y)
          expect(overlapX <= 2 || overlapY <= 2).toBe(true)
        }
      }
      expect(rosterCell(sheet, atlas, 2, 8)).toEqual(sheet.cells[29])
    }
  })
})
