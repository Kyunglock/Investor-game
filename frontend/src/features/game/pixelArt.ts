import { create } from 'zustand'

export const PIXEL_ART_KEY = 'investor-game.pixel-art'

/** 브라우저에 남긴 그림 설정. 처음은 보인다. 저장소가 막혀 있으면(사생활 보호 모드 등) 보인다. */
function storedShown(): boolean {
  try {
    return typeof localStorage === 'undefined' || localStorage.getItem(PIXEL_ART_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * 도트 그림 끄기 (decisions.md 190번). 회사처럼 남의 눈이 있는 곳에서 게임처럼 보이지 않게 캐릭터·장면 그림을 모두 숨긴다. 글과 숫자는 그대로다.
 * 끈 설정은 브라우저에 남아 새로고침해도 그대로다.
 */
export const usePixelArt = create<{ shown: boolean; setShown: (shown: boolean) => void }>(
  (set) => ({
    shown: storedShown(),
    setShown: (shown) => {
      try {
        localStorage.setItem(PIXEL_ART_KEY, shown ? 'on' : 'off')
      } catch {
        // 저장이 안 되면 이번 화면에서만 바뀐다.
      }
      set({ shown })
    },
  }),
)
