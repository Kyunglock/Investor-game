/** 아래 탭의 아이콘 (decisions.md 310번). 이모지는 기기마다 달라서 선으로 그린다. 색은 글자색을 따른다. */
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function BuildingIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" />
      <path d="M15 10h4a1 1 0 0 1 1 1v10" />
      <path d="M2 21h20" />
      <path d="M8 8h3M8 12h3M8 16h3" />
      <path d="M18 14h.01M18 17h.01" />
    </svg>
  )
}

export function ClipboardIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M9 10h6M9 14h6M9 18h3" />
    </svg>
  )
}

export function ChairIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M7 3h8a1 1 0 0 1 1 1v8H6V4a1 1 0 0 1 1-1z" />
      <path d="M4 12h14a1 1 0 0 1 1 1v3H5a1 1 0 0 1-1-1v-3z" />
      <path d="M6 16v5M17 16v5" />
    </svg>
  )
}

export function NewsIcon() {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 5h13a1 1 0 0 1 1 1v12a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5z" />
      <path d="M18 8h2v10a2 2 0 0 1-2 2" />
      <path d="M7 9h7M7 12h7M7 15h5" />
    </svg>
  )
}

export function SoundIcon({ off }: { off: boolean }) {
  return (
    <svg {...base} aria-hidden="true">
      <path d="M4 10v4h3l4 3V7l-4 3H4z" />
      {off ? (
        <path d="M16 9l5 6M21 9l-5 6" />
      ) : (
        <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
      )}
    </svg>
  )
}
