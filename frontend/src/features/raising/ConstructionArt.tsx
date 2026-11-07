/**
 * 공사 중 (#347): 건물 그림 위에 비계·크레인·가림막을 얹는다. 크레인 팔이 천천히 흔들리고 매단 짐이 오르내린다. 움직임 줄이기면 멈춘 그림이다.
 * 진행(done/years)만큼 가림막 위로 새 층의 뼈대가 올라와 있다.
 */
export function ConstructionArt({ done, years }: { done: number; years: number }) {
  const rise = Math.max(0.15, Math.min(1, (done + 0.5) / years))
  const frameTop = 64 - Math.round(rise * 34)
  return (
    <svg
      viewBox="0 0 128 80"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      data-testid="construction-art"
    >
      {/* 새 층의 뼈대: 진행만큼 올라와 있다 */}
      <g stroke="#8a6d3b" strokeWidth="1" className="build-frame">
        {[34, 46, 58, 70, 82, 94].map((x) => (
          <line key={x} x1={x} y1={frameTop} x2={x} y2={72} />
        ))}
        {Array.from({ length: Math.ceil((72 - frameTop) / 6) }, (_, i) => frameTop + i * 6).map(
          (y) => (
            <line key={y} x1={34} y1={y} x2={94} y2={y} />
          ),
        )}
      </g>
      {/* 비계와 가림막 */}
      <g>
        <rect x="30" y="52" width="68" height="20" fill="#2f5d50" opacity="0.85" />
        {[36, 52, 68, 84].map((x) => (
          <rect key={x} x={x} y="55" width="10" height="3" fill="#f2c94c" />
        ))}
        <text x="64" y="68" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="700">
          공사 중
        </text>
      </g>
      {/* 크레인 */}
      <g stroke="#e0a526" strokeWidth="1.4" fill="none">
        <line x1="106" y1="72" x2="106" y2="14" />
        <line x1="103" y1="72" x2="106" y2="14" />
        <line x1="109" y1="72" x2="106" y2="14" />
      </g>
      <g className="crane-arm" style={{ transformOrigin: '106px 14px' }}>
        <line x1="66" y1="14" x2="116" y2="14" stroke="#e0a526" strokeWidth="1.4" />
        <line x1="116" y1="14" x2="116" y2="18" stroke="#e0a526" strokeWidth="1.4" />
        <rect x="113" y="18" width="6" height="4" fill="#555" />
        <g className="crane-load">
          <line x1="74" y1="14" x2="74" y2="30" stroke="#333" strokeWidth="0.6" />
          <rect x="70" y="30" width="8" height="4" fill="#b5651d" />
        </g>
      </g>
    </svg>
  )
}
