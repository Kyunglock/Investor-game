import atlas from './assets/menu-icons.png'
import { IdleIcon, type IdleIconName } from './icons'
import { ShopIcon } from './ShopIcon'

// B안: 굵은 외곽선의 벽 돌파·성장·총·고양이·가게. 원본 투명 아틀라스에서
// 각 그림만 보여 줘 작은 메뉴에서도 배경이나 이웃 아이콘이 섞이지 않는다.
const FRAMES: Partial<Record<IdleIconName, string>> = {
  battle: '70 140 400 400',
  growth: '480 140 370 400',
  weapons: '865 140 415 400',
  cats: '1290 140 400 400',
}

export function MenuIcon({ name }: { name: IdleIconName }) {
  if (name === 'shop') return <ShopIcon className="idle-menu-icon" />
  const frame = FRAMES[name]
  if (!frame) return <IdleIcon name={name} />
  return (
    <svg className="idle-menu-icon" viewBox={frame} aria-hidden="true" overflow="hidden">
      <image href={atlas} width="2172" height="724" />
    </svg>
  )
}
