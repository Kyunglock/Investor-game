import type { CatCode } from '@web/features/raising/store'
import { NEW_CATS } from '../mental/catRoster'
import loafAtlas from './assets/cat-loaves.webp'
import { SPECIAL_PORTRAITS } from './CatPortrait'

const codes = [
  'boss',
  'sky',
  'mint',
  'lilac',
  'sunset',
  'night',
  'snow',
  ...NEW_CATS.map((cat) => cat.code),
]

/** 식빵 그림 아틀라스(8×5)에 든 고양이의 수. 그 뒤에 더한 고양이는 식빵 그림이 아직 없다. */
const LOAVES = 40

export function LoafCat({ code }: { code: CatCode }) {
  const index = codes.indexOf(code)
  // 식빵 그림이 없는 고양이(홍염·심해·사막별·그림자·봄꽃·극광)는 빈 자리로 두지 않고 초상화를 액자로 세운다.
  if (index < 0 || index >= LOAVES) {
    const portrait = SPECIAL_PORTRAITS[code]
    return portrait ? (
      <img className="baking-cat is-portrait" src={portrait} alt="" draggable={false} />
    ) : null
  }
  return (
    <span
      aria-hidden="true"
      className="baking-cat"
      style={{
        backgroundImage: `url(${loafAtlas})`,
        backgroundPosition: `${((index % 8) * 100) / 7}% ${Math.floor(index / 8) * 25}%`,
      }}
    />
  )
}
