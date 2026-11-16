/** 상점·상품을 구분하는 보석 상자와 선물. 작은 메뉴에서도 읽히는 굵은 외곽선. */
export function ShopIcon({
  gift = false,
  className = 'idle-icon',
}: {
  gift?: boolean
  className?: string
}) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <g stroke="#61340d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        {gift ? (
          <>
            <path d="M11 29h42v27H11Z" fill="#ffb329" />
            <path d="M8 23h48v12H8Z" fill="#ffe379" />
            <path d="M27 23h10v33H27Z" fill="#f36b51" />
            <path d="M31 23C8 24 15 4 24 12l8 11C56 24 49 4 40 12Z" fill="#ff8267" />
            <path d="M16 41v9m0-12v1" stroke="#fff1b6" />
          </>
        ) : (
          <>
            <path d="m9 27 5-16h36l5 16v29H9Z" fill="#d48226" />
            <path d="M14 11h36l5 16H9Z" fill="#ffd45b" />
            <path d="M9 30h46v26H9Z" fill="#edaa35" />
            <path d="M16 31v24m32-24v24M9 29h46" stroke="#ffe590" strokeWidth="4" />
            <path d="M9 29h46M9 56h46" />
          </>
        )}
        <path d="m22 30 6-6h8l6 6-10 12Z" fill="#46cefa" />
        <path
          d="m22 30 10 12 10-12M22 30h20m-14-6 4 6 4-6m-4 6v12"
          stroke="#1677b4"
          strokeWidth="1.5"
        />
        <path d="m26 28 2-2h5" stroke="#e3fcff" strokeWidth="2" />
        <path d="M55 5v8m-4-4h8M5 18v6m-3-3h6" stroke="#ffbc28" strokeWidth="2.5" />
      </g>
    </svg>
  )
}
