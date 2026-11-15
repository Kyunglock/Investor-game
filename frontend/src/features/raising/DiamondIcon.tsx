import { diamondText } from './gachaRules'

/**
 * 다이아 그림 (decisions.md 526번): 글자 크기(1em)를 따르는 작은 보석. 값·지갑 옆에 붙인다. 뜻은 옆의 글자나 aria-label이 전하므로 읽어 주지 않는다.
 */
export function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      style={{ display: 'inline-block', verticalAlign: '-0.14em', flexShrink: 0 }}
      aria-hidden="true"
      data-icon="diamond"
    >
      <path
        d="M7 4h10l4.5 5.5L12 21 2.5 9.5Z"
        fill="#7fd4ff"
        stroke="#1f6fb5"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M7 4 2.5 9.5h19L17 4Z"
        fill="#c9f0ff"
        stroke="#1f6fb5"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 4 8 9.5 12 21l4-11.5L14.5 4"
        fill="none"
        stroke="#1f6fb5"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 다이아로 적은 값: 보석과 수. 화면 낭독기에는 "다이아 100개"로 읽힌다. */
export function DiamondPrice({ amount }: { amount: number }) {
  return (
    <span className="whitespace-nowrap" data-price={amount}>
      <DiamondIcon />
      <span className="sr-only">다이아 </span>
      {diamondText(amount)}
      <span className="sr-only">개</span>
    </span>
  )
}
