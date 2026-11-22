import roster0 from './assets/roster/cats-08-10.png'
import roster1 from './assets/roster/cats-11-13.png'
import roster2 from './assets/roster/cats-14-16.png'
import roster3 from './assets/roster/cats-17-19.png'
import roster4 from './assets/roster/cats-20-22.png'
import roster5 from './assets/roster/cats-23-25.png'
import roster6 from './assets/roster/cats-26-28.png'
import roster7 from './assets/roster/cats-29-31.png'
import roster8 from './assets/roster/cats-32-34.png'
import roster9 from './assets/roster/cats-35-37.png'
import roster10 from './assets/roster/cats-38-40.png'

import roster11 from './assets/roster/companions-0.webp'
import roster12 from './assets/roster/companions-1.webp'

export const ROSTER_ASSETS = {
  roster0,
  roster1,
  roster2,
  roster3,
  roster4,
  roster5,
  roster6,
  roster7,
  roster8,
  roster9,
  roster10,
  roster11,
  roster12,
}
export const rosterAsset = (atlas: number) =>
  ROSTER_ASSETS[`roster${atlas}` as keyof typeof ROSTER_ASSETS]
