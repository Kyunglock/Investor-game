import type { CatCode } from '@web/features/raising/store'
import { NEW_CATS } from '../mental/catRoster'
import loafAtlas from './assets/cat-loaves.webp'

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

export function LoafCat({ code }: { code: CatCode }) {
  const index = codes.indexOf(code)
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
