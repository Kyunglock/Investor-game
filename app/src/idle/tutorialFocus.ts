import { useLayoutEffect, useState } from 'react'

export type FocusTarget = { selector: string; text: string; battle?: boolean; drop?: string }
export type FocusBox = { left: number; top: number; width: number; height: number; target: string }

/** 화면을 복제하지 않고 실제 버튼의 위치를 따라간다. 시트 스크롤과 열림 애니메이션도 반영한다. */
export function useTutorialFocus(targets: FocusTarget[], active: boolean) {
  const key = JSON.stringify(targets)
  const [focus, setFocus] = useState<
    (FocusBox & { text: string; battle?: boolean; drop?: FocusBox }) | null
  >(null)
  useLayoutEffect(() => {
    if (!active) {
      setFocus(null)
      return
    }
    const choices = JSON.parse(key) as FocusTarget[]
    let frame = 0
    let scrolled: Element | null = null
    const measure = () => {
      let found: HTMLElement | undefined
      let choice: FocusTarget | undefined
      for (const candidate of choices) {
        found = [...document.querySelectorAll<HTMLElement>(candidate.selector)]
          .reverse()
          .find((el) => el.getClientRects().length > 0)
        if (found) {
          choice = candidate
          break
        }
      }
      if (!found || !choice) {
        setFocus(null)
        return
      }
      if (scrolled !== found && found.closest('[role="dialog"]')) {
        scrolled = found
        found.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
      }
      const rect = found.getBoundingClientRect()
      const hud = choice.battle ? found.closest('.idle-home')?.querySelector('.idle-hud') : null
      const inset = choice.battle ? 2 : -5
      const left = Math.max(4, rect.left + inset)
      const top = Math.max(4, rect.top + inset, hud ? hud.getBoundingClientRect().bottom + 2 : 0)
      const right = Math.min(innerWidth - 4, rect.right - inset)
      const bottom = Math.min(innerHeight - 4, rect.bottom - inset)
      const dropElement = choice.drop
        ? [...document.querySelectorAll<HTMLElement>(choice.drop)].find(
            (el) => el.getClientRects().length > 0,
          )
        : null
      const dropRect = dropElement?.getBoundingClientRect()
      const drop =
        dropRect && choice.drop
          ? {
              left: dropRect.left - 5,
              top: dropRect.top - 5,
              width: dropRect.width + 10,
              height: dropRect.height + 10,
              target: choice.drop,
            }
          : undefined
      const next = {
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
        text: choice.text,
        target: choice.selector,
        battle: choice.battle,
        drop,
      }
      setFocus((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next))
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const observer = new MutationObserver((mutations) => {
      if (
        mutations.some(
          (mutation) =>
            !(
              mutation.target instanceof Element && mutation.target.closest('[data-tutorial-layer]')
            ),
        )
      )
        schedule()
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'data-code', 'data-grade', 'aria-pressed', 'disabled'],
    })
    window.addEventListener('resize', schedule)
    document.addEventListener('scroll', schedule, true)
    document.addEventListener('animationend', schedule, true)
    // 시트가 올라오는 동안에는 목표의 좌표도 움직인다.
    let animationFrame = 0
    const until = performance.now() + 450
    const trackAnimation = () => {
      measure()
      if (performance.now() < until) animationFrame = requestAnimationFrame(trackAnimation)
    }
    trackAnimation()
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      document.removeEventListener('scroll', schedule, true)
      document.removeEventListener('animationend', schedule, true)
    }
  }, [key, active])
  return focus
}

export function tutorialTargets(step: number, menu: string): FocusTarget[] {
  const nav = (name: string, text: string) => ({ selector: `[data-tutorial-menu="${name}"]`, text })
  const night = {
    selector: '[data-testid="cat"][data-code="night"], [data-testid="cat-slot"][data-code="night"]',
    text: '밤냥을 눌러 선택해 주세요.',
  }
  switch (step) {
    case -1:
      return [
        {
          selector: '.idle-canvas',
          battle: true,
          text: '매도벽 돌파냥에 오신 걸 환영해요! 사장냥과 함께 매도벽을 깨고, 든든한 동료를 만나볼까요?',
        },
      ]
    case 0:
      return [
        {
          selector: '[data-testid="idle-wall-number"]',
          text: '사장냥은 자동으로 공격해요. 첫 매도벽이 깨지는 걸 지켜봐요!',
        },
      ]
    case 1:
      return menu === 'growth'
        ? [
            {
              selector: '[data-testid="idle-stat"][data-kind="damage"] .idle-buy',
              text: '이 버튼을 눌러 공격력을 한 번 강화해 주세요.',
            },
          ]
        : [nav('growth', '성장을 눌러 공격력을 올려봐요.')]
    case 2:
      return menu === 'shop'
        ? [
            {
              selector: '[data-testid="cat-draw"]',
              text: '무료 1회 뽑기를 눌러요. 첫 동료는 메테오 마법을 쓰는 A등급 밤냥이에요!',
            },
            { selector: '[data-testid="draw-kind-cat"]', text: '고양이 뽑기를 선택해 주세요.' },
          ]
        : [nav('shop', '상점에서 첫 고양이를 무료로 뽑아봐요!')]
    case 3:
      return menu === 'cats'
        ? [
            {
              selector: '[data-testid="cat"][data-code="night"]',
              drop: '[data-loadout-target^="slot:empty"]',
              text: '밤냥을 꾹 누른 채 빈 출전 칸으로 끌어 놓으세요.',
            },
          ]
        : [nav('cats', '출전 탭을 눌러 밤냥을 출전시켜요.')]
    case 4:
      return menu === 'shop'
        ? [
            {
              selector: '[data-testid="weapon-draw"]',
              text: '무료 1회 뽑기를 눌러 밤냥의 B등급 기관단총을 뽑아봐요!',
            },
            {
              selector: '[data-testid="draw-kind-weapon"]',
              text: '이번에는 무기 뽑기를 선택해 주세요.',
            },
          ]
        : [nav('shop', '상점에서 밤냥에게 줄 첫 무기를 무료로 뽑아봐요!')]
    case 5:
      return menu === 'cats'
        ? [
            {
              selector: '[data-testid="cat-weapon"][data-grade="B"]:not([data-holder])',
              drop: '[data-testid="gun-slot"][data-code="night"]',
              text: '기관단총을 꾹 누른 채 밤냥 아래 무기 칸으로 끌어 놓으세요.',
            },
            {
              selector: '[data-testid="gun-slot"][data-code="night"]',
              text: '밤냥 아래 무기 칸을 눌러 무기 목록을 열어주세요.',
            },
            night,
          ]
        : [nav('cats', '출전 탭에서 밤냥의 무기를 바꿔봐요.')]
    case 7:
      return [nav('battle', '첫 팀 완성! 매도벽을 부숴 레벨이 오르면 스킬 카드를 골라요.')]
    default:
      return []
  }
}
