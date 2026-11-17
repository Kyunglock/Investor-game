/** 상점 전용 컬러 장난감 아이콘. 메뉴 아이콘과 구분하고 상품별 내용을 보여 준다. */
export function ShopIcon({ kind }: { kind: 'gift' | 'gems' | 'cat' | 'weapon' }) {
  return (
    <svg
      className="shop-art-icon"
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill="none"
      stroke="#234d74"
      strokeWidth="2.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <ellipse cx="32" cy="57" rx="23" ry="4" fill="#183a68" opacity=".15" stroke="none" />
      {kind === 'gift' ? (
        <>
          <path d="M11 29h42v24H11z" fill="#3395ed" />
          <path d="M8 22h48v12H8z" fill="#79caff" />
          <path d="M27 22h10v31H27z" fill="#ffcb61" />
          <path
            d="M31 21C9 22 14 5 23 11c4 3 6 7 8 10Zm2 0C55 22 50 5 41 11c-4 3-6 7-8 10Z"
            fill="#ffe099"
          />
          <path
            d="m48 6 1.5 4.5L54 12l-4.5 1.5L48 18l-1.5-4.5L42 12l4.5-1.5Z"
            fill="#fff1ac"
            stroke="none"
          />
        </>
      ) : kind === 'gems' ? (
        <>
          <path d="M10 32h44v21H10z" fill="#2767ae" />
          <path d="m8 31 8-12h32l8 12Z" fill="#ffd175" />
          <path d="m15 24 7-10h10l7 10-12 16Z" fill="#5ee8ff" />
          <path d="m31 24 7-11h10l8 11-13 16Z" fill="#8cf2ff" />
          <path d="m16 24 11 16 5-26m0 10h23M10 37h44" stroke="#d0ffff" strokeWidth="2" />
          <path d="M28 39h8v10h-8z" fill="#ffd175" />
        </>
      ) : kind === 'cat' ? (
        <>
          <path d="m12 30-1-18 17 9h9l16-9-1 18c9 30-49 32-40 0Z" fill="#ffbd69" />
          <path d="m16 23-1-5 7 5m20 0 7-5-1 6" stroke="#ed865e" />
          <path d="M24 33v3m17-3v3m-11 5 3 3 3-3" stroke="#71442e" />
          <path
            d="M33 44c-4 5-8 2-8 0m8 0c4 5 8 2 8 0M9 36l9 2m-9 6 9-2m37-6-9 2m9 6-9-2"
            stroke="#71442e"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          <path d="M8 21h38l9 7v10H29l-4 18H13l5-18H8z" fill="#71bbeb" />
          <path d="M18 38h11l-4 18H13z" fill="#e8a85d" />
          <path d="M9 21h36v9H9z" fill="#b4e9ff" />
          <path d="M46 24h10v11H46z" fill="#ffd175" />
          <path d="M32 38v7h-6M15 16h10v5m9-5h7v5" />
        </>
      )}
    </svg>
  )
}
