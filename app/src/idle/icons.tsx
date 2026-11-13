import type { ReactNode } from 'react'

/**
 * 자동 전투 메뉴의 그림 (decisions.md 489번): 이모지·문자 대신 같은 굵기의 선에 옅은 채움을 얹은 SVG라 기기마다 똑같이 보인다. 색은 글자색을 따른다.
 */
const SHAPES = {
  battle: <path d="m6 3 15 15-3 3L3 6V3h3Zm8 11 5-5m-5-6h7v7M3 21l6-6m-4-2 6 6" />,
  company: <path d="M4 22V5l8-3 8 3v17M9 22v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1" />,
  // 성장: 오르는 봉 셋 위로 치솟는 화살표와 반짝임.
  growth: (
    <>
      <path
        d="M3.5 21v-5h4v5Zm6.5 0v-8h4v8Zm6.5 0V10h4v11Z"
        fill="currentColor"
        fillOpacity=".28"
      />
      <path d="m3 11 5-4.5 3.5 2.5L18 3m-4.2-.3L18 3l-.3 4.2" />
      <path d="M5 2.2v2.6M3.7 3.5h2.6" strokeWidth="1.3" />
    </>
  ),
  // 고양이: 쫑긋한 귀, 눈, 코와 입, 수염.
  cats: (
    <>
      <path
        d="M4.5 3.8 9 7.4h6l4.5-3.6v9.4a7.5 7.5 0 0 1-15 0Z"
        fill="currentColor"
        fillOpacity=".28"
      />
      <path d="M9.2 12.2v.9m5.6-.9v.9" strokeWidth="2.2" />
      <path d="M12 15.3v.9m0 0c-.7.9-1.7.9-2.3.3m2.3-.3c.7.9 1.7.9 2.3.3" strokeWidth="1.4" />
      <path d="M1.8 12.6h1.9m-1.6 3 1.9-.5m18.2-2.5h-1.9m1.6 3-1.9-.5" strokeWidth="1.3" />
    </>
  ),
  stats: <path d="M4 20V11m5.3 9V5m5.4 15v-7M20 20V8" />,
  bag: (
    <>
      <path d="M5 9h14l1 11H4Z" fill="currentColor" fillOpacity=".28" />
      <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2M9 13.5h6" />
    </>
  ),
  spark: (
    <path d="m12 3 2 6.2 6 1.8-6 2-2 6-2-6-6-2 6-1.8Z" fill="currentColor" fillOpacity=".28" />
  ),
  // 공격력: 비스듬히 세운 칼.
  damage: (
    <>
      <path d="M20.5 3.5 20 9 10 19l-5-5L15 4Z" fill="currentColor" fillOpacity=".28" />
      <path d="m4 13 7 7M3 21l4.5-4.5M15.5 8.5l-6 6" />
    </>
  ),
  // 공격 속도: 빠르게 나가는 겹화살.
  fire: (
    <>
      <path d="m12.5 5 7 7-7 7Z" fill="currentColor" fillOpacity=".28" />
      <path d="m4.5 6 6 6-6 6M2 12h3" />
    </>
  ),
  // 매수벽: 벽돌 벽.
  hp: (
    <>
      <path d="M3 5h18v14H3Z" fill="currentColor" fillOpacity=".28" />
      <path d="M3 9.7h18M3 14.3h18M9 5v4.7m6-4.7v4.7M6 9.7v4.6m6-4.6v4.6m6-4.6v4.6M9 14.3V19m6-4.7V19" />
    </>
  ),
  // 치명타: 과녁 한가운데에 터지는 별.
  crit: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity=".18" />
      <path
        d="m12 6.5 1.5 3.9 4 .6-3 2.7.9 4-3.4-2.2-3.4 2.2.9-4-3-2.7 4-.6Z"
        fill="currentColor"
        fillOpacity=".5"
      />
      <path d="M12 1.5v2.4m0 16.2v2.4M1.5 12h2.4m16.2 0h2.4" />
    </>
  ),
  water: (
    <>
      <path
        d="M12 3c3.8 4.6 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.2-6.4 6-11Z"
        fill="currentColor"
        fillOpacity=".28"
      />
      <path d="M9.3 14.5a2.8 2.8 0 0 0 2.2 2.6" strokeWidth="1.4" />
    </>
  ),
  bolt: <path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6.5Z" fill="currentColor" fillOpacity=".28" />,
  meteor: (
    <>
      <circle cx="9" cy="15" r="5.5" fill="currentColor" fillOpacity=".28" />
      <path d="M13.5 10.5 21 3m-4 9.5L21.5 8M11.5 7.5 16 3" />
    </>
  ),
  // 충차: 바퀴 달린 통나무.
  ram: (
    <>
      <path d="M3 8.5h14l4 3.5-4 3.5H3Z" fill="currentColor" fillOpacity=".28" />
      <circle cx="7.5" cy="18.5" r="2" />
      <circle cx="15" cy="18.5" r="2" />
      <path d="M7 8.5v7m4-7v7" strokeWidth="1.3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" fillOpacity=".28" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3m-3.5 4v2" />
    </>
  ),
  ticket: (
    <>
      <path
        d="M3 7h18v3.5a1.8 1.8 0 0 0 0 3.5V17H3v-3a1.8 1.8 0 0 0 0-3.5Z"
        fill="currentColor"
        fillOpacity=".28"
      />
      <path d="M14.5 7v2m0 2.5v1.5m0 2.5V17" strokeWidth="1.3" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IdleIconName = keyof typeof SHAPES

export function IdleIcon({ name }: { name: IdleIconName }) {
  return (
    <svg
      className="idle-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SHAPES[name]}
    </svg>
  )
}
