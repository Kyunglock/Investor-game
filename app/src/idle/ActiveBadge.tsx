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
  const values: Record<ActiveCode, string | null> = {
    barrage: `×${ACTIVES.barrage.shots}`,
    rally: `×${ACTIVES.rally.fire}`,
    fortify: null,
    limitUp: '100%',
    stopLoss: `−${ACTIVES.stopLoss.ratio * 100}%`,
    averaging: `×${ACTIVES.averaging.min}~${ACTIVES.averaging.max}`,
    boostFire: `×${BOOST}`,
    boostDamage: `×${BOOST}`,
    boostBuy: `×${BOOST}`,
  }
  return (
    <svg className="active-badge" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop stopColor={ad ? '#fff8d6' : '#fcf2ff'} />
          <stop offset="1" stopColor={ad ? '#ffd56b' : '#d8acf5'} />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="48"
        fill={`url(#${id})`}
        stroke={ad ? '#ba7c26' : '#9b64b9'}
        strokeWidth="3"
      />
      <circle cx="50" cy="50" r="43" fill="none" stroke="#fff9e8" strokeWidth="2" />
      <g transform="translate(10 8) scale(.85)">
        {code === 'boostDamage' && <Sword />}
        {(code === 'boostBuy' || code === 'barrage') && <Orders shower={code === 'barrage'} />}
        {(code === 'boostFire' || code === 'rally') && <Bullets fire={code === 'rally'} />}
        {code === 'fortify' && <Barrier />}
        {code === 'limitUp' && (
          <>
            <path
              d="m42 9 8 15 20-7-5 19 17 9-19 8 4 19-20-8-12 13-5-20-20-2 15-16-8-18 20 6Z"
              fill="#ffbf48"
              stroke="#cf6633"
              strokeWidth="3"
            />
            <g transform="translate(8 2) scale(.8)">
              <Bullets />
            </g>
          </>
        )}
        {code === 'stopLoss' && (
          <g stroke="#754b43" strokeWidth="3" strokeLinejoin="round">
            <path d="M13 29h47v31H13Z" fill="#d49f80" />
            <path d="M13 44h47M27 29v15m19-15v15M35 44v16" stroke="#fff1d6" />
            <path d="m40 27-9 12 10 7-9 16" fill="none" stroke="#743928" />
            <path
              d="m57 17 8 12 14-8-4 16 12 5-14 7 4 12-15-5-7 10-1-18-11-6 12-8Z"
              fill="#ffbd50"
              stroke="#d66b3a"
            />
            <path
              d="M12 11c-10-6-14 9 0 17 14-8 10-23 0-17Z"
              transform="translate(8 0)"
              fill="#f17683"
            />
          </g>
        )}
        {code === 'averaging' && (
          <>
            <Orders />
            <path
              d="M12 38c-10-6-14 9 0 17 14-8 10-23 0-17Z"
              transform="translate(2 0)"
              fill="#ef8b9d"
              stroke="#97556b"
              strokeWidth="2"
            />
            <path d="M29 41v15m-5-5 5 5 5-5" fill="none" stroke="#92526b" strokeWidth="3" />
          </>
        )}
      </g>
      {values[code] !== null && (
        <text
          x="80"
          y={code === 'barrage' ? 67 : 80}
          className={`active-badge-value ${code === 'averaging' || code === 'limitUp' || code === 'stopLoss' ? 'is-wide' : ''}`}
          textAnchor="end"
        >
          {values[code]}
        </text>
      )}
      <g
        transform="translate(-16 12)"
        stroke={ad ? '#9d6123' : '#81509d'}
        strokeWidth="2.5"
        strokeLinejoin="round"
      >
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
        ) : seconds === 0 ? (
          <path d="m9 1-7 8h5l-1 6 8-9H9l3-5Z" fill="#eda43a" stroke="#77512d" strokeWidth="1" />
        ) : (
          <g stroke="#77512d" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M3 2h10q0 4-4 6 4 2 4 6H3q0-4 4-6-4-2-4-6Z" fill="#fff9df" />
            <path d="m5 4 3 3 3-3M4 13l4-4 4 4" fill="#eda43a" stroke="none" />
            <path d="M2 1h12M2 15h12" />
          </g>
        )}
      </svg>
      {seconds > 0 && `${Math.ceil(seconds)}s`}
    </span>
  )
}
