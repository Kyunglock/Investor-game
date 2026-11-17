import atlas from './assets/menu-icons.png'
import { IdleIcon, type IdleIconName } from './icons'

// B안: 굵은 외곽선의 벽 돌파·성장·총·고양이·가게. 원본 투명 아틀라스에서
// 각 그림만 보여 줘 작은 메뉴에서도 배경이나 이웃 아이콘이 섞이지 않는다.
const FRAMES: Partial<Record<IdleIconName, string>> = {
  battle: '70 140 400 400',
  growth: '480 140 370 400',
  weapons: '865 140 415 400',
  cats: '1290 140 400 400',
  shop: '1708 140 415 400',
}

/** 스킬 탭 (587번): 아틀라스에 그림이 없어 같은 굵은 외곽선의 장난감 번개 배지를 직접 그린다. */
function SkillsIcon() {
  return (
    <svg className="idle-menu-icon" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="25" fill="#5a2d91" />
      <circle cx="32" cy="31" r="25" fill="#9b5cf0" stroke="#3b1d66" strokeWidth="4" />
      <path d="M14 22a22 22 0 0 1 30-9" fill="none" stroke="#d9c2ff" strokeWidth="4" />
      <path
        d="M37 8 17 35h13l-4 21 21-29H34Z"
        fill="#ffd84d"
        stroke="#3b1d66"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M35 14 23 31h5" fill="none" stroke="#fff6c2" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function MenuIcon({ name }: { name: IdleIconName }) {
  if (name === 'skills') return <SkillsIcon />
  const frame = FRAMES[name]
  if (!frame) return <IdleIcon name={name} />
  return (
    <svg className="idle-menu-icon" viewBox={frame} aria-hidden="true" overflow="hidden">
      <image href={atlas} width="2172" height="724" />
    </svg>
  )
}
