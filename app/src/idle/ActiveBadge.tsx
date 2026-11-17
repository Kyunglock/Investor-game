import { useId } from 'react'
import { ACTIVES, type ActiveCode, BOOST, isBoost } from '../mental/actives'
import './active-badge.css'

function Sword() {
  return (
    <g stroke="#633b28" strokeWidth="3" strokeLinejoin="round">
      <path d="m26 49 30-35 17-3-2 18-34 30Z" fill="#dbe7f4" />
      <path d="m34 48 36-34-8 18-25 27Z" fill="#9daec7" stroke="none" />
      <path d="m27 50-14 18 7 6 16-18" fill="#c77b30" />
      <path d="m22 45 20 17-5 6-20-17Z" fill="#ffc84e" />
      <circle cx="15" cy="72" r="6" fill="#ffd45c" />
      <path d="m51 20 10-4-3 9" fill="none" stroke="#fff" strokeWidth="2" />
    </g>
  )
}

function Orders({ shower = false }: { shower?: boolean }) {
  return (
    <g stroke="#2c638b" strokeWidth="2.5" strokeLinejoin="round">
      {shower && (
        <g fill="#d8f5ff" strokeWidth="2">
          <path d="m10 16 13-4 5 14-13 4Z M71 33l12 4-5 15-12-4Z M9 51l12 3-3 13-12-3Z" />
          <path d="m13 20 9-3m-8 7 9-3m48 17 6 2m-59 18 7 1" fill="none" />
        </g>
      )}
      <path d="m34 20 39 8-9 45-39-8Z" fill="#a9dafa" />
      <path d="m23 14 40 8-9 45-40-8Z" fill="#f0fcff" />
      <path d="m29 22 23 4m-24 3 14 3" stroke="#91c7e8" />
      <path d="m25 48 9-6 7 4 13-13m-9 0h9v9" fill="none" stroke="#33985c" strokeWidth="4" />
    </g>
  )
}

function Bullets({ fire = false }: { fire?: boolean }) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {fire ? (
        <path
          d="M11 66Q1 44 25 32L20 44Q39 30 37 9Q68 25 59 43L76 32Q86 66 62 74Z"
          fill="#ffbd38"
          stroke="#ed7930"
          strokeWidth="3"
        />
      ) : (
        <path
          d="m24 10-13 21h12l-5 17 23-26H28l8-12Z"
          fill="#ffdc59"
          stroke="#795125"
          strokeWidth="2.5"
        />
      )}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${-i * 8} ${i * 18})`}>
          <path d="M39 23H25m12 6H18" stroke={fire ? '#fff1ab' : '#59bce9'} strokeWidth="3" />
          <path
            d="M43 17h16q12 0 18 9-6 9-18 9H43Z"
            fill="#ffce5a"
            stroke="#734529"
            strokeWidth="2.5"
          />
          <path d="M60 18v16" stroke="#734529" strokeWidth="2" />
          <path d="M46 22h11" stroke="#fff5c9" strokeWidth="3" />
        </g>
      ))}
    </g>
  )
}

function Barrier() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M9 68V49a34 34 0 0 1 68 0v19" fill="#c2f4ef" stroke="#6bbccc" strokeWidth="3" />
      <path d="M14 48h57v28H14Z" fill="#82c95f" stroke="#3f7146" strokeWidth="3" />
      <path d="M14 62h57M31 48v14m22-14v14M43 62v14" fill="none" stroke="#edfbcf" strokeWidth="3" />
      <path
        d="M43 9 63 16v15q-1 14-20 23-19-9-20-23V16Z"
        fill="#ffd15d"
        stroke="#87552c"
        strokeWidth="3"
      />
      <path
        d="m43 16 13 5v11q-1 8-13 15-12-7-13-15V21Z"
        fill="#ffed9c"
        stroke="#e9a83f"
        strokeWidth="2"
      />
      <path
        d="M64 53h9v9h9v9h-9v9h-9v-9h-9v-9h9Z"
        fill="#58ae46"
        stroke="#fffbe6"
        strokeWidth="3"
      />
    </g>
  )
}

/** 전투 단추·장착 칸·스킬 목록에서 같은 효과 그림을 쓴다. 이름과 설명은 부모의 접근성 라벨에 남긴다. */
export function ActiveBadge({ code }: { code: ActiveCode }) {
  const id = useId()
  const ad = isBoost(code)
  const multiplier = ad ? BOOST : code === 'barrage' ? ACTIVES.barrage.shots : ACTIVES.rally.fire
  return (
    <svg className="active-badge" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop stopColor={ad ? '#fff8d6' : '#fcf2ff'} />
          <stop offset="1" stopColor={ad ? '#ffd56b' : '#d8acf5'} />
        </linearGradient>
      </defs>
      <rect x="3" y="5" width="94" height="92" rx="23" fill={ad ? '#b57b29' : '#8452a4'} />
      <rect
        x="3"
        y="2"
        width="94"
        height="92"
        rx="23"
        fill={`url(#${id})`}
        stroke={ad ? '#ba7c26' : '#9b64b9'}
        strokeWidth="3"
      />
      <rect
        x="8"
        y="7"
        width="84"
        height="82"
        rx="19"
        fill="none"
        stroke="#fff9e8"
        strokeWidth="2"
      />
      <g transform="translate(2 4)">
        {code === 'boostDamage' && <Sword />}
        {(code === 'boostBuy' || code === 'barrage') && <Orders shower={code === 'barrage'} />}
        {(code === 'boostFire' || code === 'rally') && <Bullets fire={code === 'rally'} />}
        {code === 'fortify' && <Barrier />}
      </g>
      {code !== 'fortify' && (
        <text
          x="88"
          y={code === 'barrage' ? 68 : 84}
          className="active-badge-value"
          textAnchor="end"
        >
          ×{multiplier}
        </text>
      )}
      {code === 'barrage' && (
        <g transform="translate(10 73)">
          <g transform="translate(0 -3) scale(.23)">
            <Sword />
          </g>
          <text x="23" y="15" className="active-badge-power">
            ×{ACTIVES.barrage.power}
          </text>
        </g>
      )}
      <g stroke={ad ? '#9d6123' : '#81509d'} strokeWidth="2.5" strokeLinejoin="round">
        {ad ? (
          <>
            <rect x="71" y="3" width="25" height="22" rx="6" fill="#cd7d25" />
            <path d="m80 8 9 6-9 6Z" fill="#fff6d9" stroke="none" />
          </>
        ) : (
          <path d="M72 20V5l7 4q4-2 8 0l7-4v15q-1 8-11 8t-11-8Z" fill="#fff4d9" />
        )}
      </g>
    </svg>
  )
}

export function ActiveTime({ seconds, cooldown = false }: { seconds: number; cooldown?: boolean }) {
  return (
    <span className="active-time" aria-hidden="true">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        {cooldown ? (
          <path
            d="M3 5a6 6 0 1 1-1 5M2 1v5h5M8 4v4l3 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <g stroke="#77512d" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M3 2h10q0 4-4 6 4 2 4 6H3q0-4 4-6-4-2-4-6Z" fill="#fff9df" />
            <path d="m5 4 3 3 3-3M4 13l4-4 4 4" fill="#eda43a" stroke="none" />
            <path d="M2 1h12M2 15h12" />
          </g>
        )}
      </svg>
      {Math.ceil(seconds)}s
    </span>
  )
}
