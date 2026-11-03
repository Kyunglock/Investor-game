import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import type { Game } from '../../api/client'
import { spouseWord } from '../../api/spouseTerms'
import { childWord, percent, shortWon, signedShortWon, signedWon, won } from './labels'
import { signedPercent } from './market'
import { useGameStore } from './store'
import { yearDelta } from './timeline'
import { compactWon, stockSummary, WORTH_COLORS, worthBar, worthParts } from './worth'

/** 거주 형태 이름 (주거 설계 1절). */
export const TENURE_LABELS: Record<Game['housing']['tenure'], string> = {
  PARENTS: '부모님 집',
  MONTHLY: '월세',
  VILLA_JEONSE: '빌라 전세',
  APT_JEONSE: '아파트 전세',
  OWN: '자가',
}

/** 장부의 탭 (#212). 세로로 쭉 이어지던 가계부·주식·집을 나눠 한눈에 하나씩 본다. */
export type LedgerTab = 'household' | 'worth' | 'stocks' | 'homes'

const LEDGER_TABS: { key: LedgerTab; label: string }[] = [
  { key: 'household', label: '가계부' },
  { key: 'worth', label: '전 재산' },
  { key: 'stocks', label: '주식' },
  { key: 'homes', label: '부동산' },
]

const TAB_STORAGE = 'ledger-tab'

function savedTab(): LedgerTab {
  try {
    const saved = window.localStorage.getItem(TAB_STORAGE)
    if (LEDGER_TABS.some((t) => t.key === saved)) {
      return saved as LedgerTab
    }
  } catch {
    // 저장소를 못 쓰면 기본 탭
  }
  return 'worth'
}

/** 고른 탭. 맨 위 띠의 주식 칸을 누르면 주식 탭이 열리므로 장부 밖에서도 바꾼다. 새로고침해도 남게 브라우저에 적어 둔다. */
export const useLedgerTab = create<{ tab: LedgerTab; setTab: (tab: LedgerTab) => void }>((set) => ({
  tab: savedTab(),
  setTab: (tab) => {
    try {
      window.localStorage.setItem(TAB_STORAGE, tab)
    } catch {
      // 저장 못 해도 이번 화면에서는 바뀐다
    }
    set({ tab })
  },
}))

/**
 * 수첩 오른쪽 쪽: 돈 (2026-10-22 시안 D). 가계부 · 전 재산 · 주식 · 부동산 탭 (#212). 금액은 모두 서버 값이다.
 * 전 재산 숫자는 수첩 맨 위 띠(WorthBand)에 그대로 있고, 전 재산 탭은 그 구성을 막대로 보여 준다 (#210).
 * 매매 버튼은 어느 탭에서든 누를 수 있게 탭 밖 아래에 둔다.
 */
export function LedgerPage({ game }: { game: Game; ageYears: number }) {
  const tab = useLedgerTab((s) => s.tab)
  const setTab = useLedgerTab((s) => s.setTab)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const summaries = tabSummaries(game)
  const moveFocus = (index: number) => {
    const next = (index + LEDGER_TABS.length) % LEDGER_TABS.length
    setTab(LEDGER_TABS[next].key)
    tabRefs.current[next]?.focus()
  }
  return (
    <section
      aria-label="돈"
      className="paper-grid min-w-0 flex-[1_1_440px] px-5 pt-6 pb-8 sm:px-8"
      id="ledger"
    >
      <div
        role="tablist"
        aria-label="장부"
        className="grid grid-cols-4 gap-1 border-b-2 border-pen"
        data-testid="ledger-tabs"
      >
        {LEDGER_TABS.map((t, i) => {
          const selected = tab === t.key
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`ledger-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`ledger-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              className={`-mb-0.5 min-h-[52px] min-w-0 rounded-t border-2 px-1 pt-1 text-center leading-tight ${
                selected
                  ? 'border-pen border-b-paper bg-paper'
                  : 'border-transparent text-pen-soft hover:bg-white'
              }`}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  moveFocus(i + 1)
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  moveFocus(i - 1)
                }
              }}
              data-testid={`ledger-tab-${t.key}`}
            >
              <span className="block whitespace-nowrap font-pen text-[19px] leading-6 sm:text-[22px]">
                {t.label}
              </span>
              <span className="block truncate text-[11px] text-pen-soft">
                {summaries[t.key] ?? ' '}
              </span>
            </button>
          )
        })}
      </div>
      {LEDGER_TABS.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`ledger-panel-${t.key}`}
          aria-labelledby={`ledger-tab-${t.key}`}
          hidden={tab !== t.key}
          className="pt-3"
        >
          {t.key === 'household' && <Household game={game} />}
          {t.key === 'worth' && <WorthPanel game={game} />}
          {t.key === 'stocks' && <Stocks game={game} />}
          {t.key === 'homes' && <Home game={game} />}
        </div>
      ))}
      <TradeButton game={game} />
    </section>
  )
}

/** 탭을 열지 않아도 대략 보이게 탭 아래 짧은 숫자 (#212). */
function tabSummaries(game: Game): Partial<Record<LedgerTab, string>> {
  const h = game.household
  const working = (game.job !== null && game.job !== undefined) || game.fullTimeInvestor
  const saving =
    h.monthlyIncome + h.spouseIncome + h.pension - h.monthlyExpense - game.housing.monthlyCost
  const realEstate = worthParts(game)
    .filter((p) => p.key === 'homes' || p.key === 'deposit')
    .reduce((sum, p) => sum + p.value, 0)
  return {
    household: working ? `월 ${compactWon(saving, true)}` : undefined,
    worth: compactWon(game.totalAsset),
    stocks: game.holdings.length > 0 ? compactWon(game.invested) : '없음',
    homes:
      game.housing.homes.length > 0 || realEstate !== 0
        ? compactWon(realEstate)
        : TENURE_LABELS[game.housing.tenure],
  }
}

/**
 * 전 재산과 현금·주식·빚 타일. 가장 먼저 봐야 하는 숫자라 수첩 맨 위에 쪽 너비 전체로 둔다 (#201).
 * 넓은 화면이든 좁은 화면이든 신원·장면보다 위다. 자산 그래프는 기록부에만 (decisions.md 137번).
 */
export function WorthBand({ game }: { game: Game }) {
  return (
    <section
      aria-label="전 재산"
      className="paper-grid w-full basis-full border-b-2 border-dashed border-[#d5d2cb] px-5 pt-6 pb-5 sm:px-8 md:pl-12"
    >
      <Worth game={game} />
    </section>
  )
}

function Worth({ game }: { game: Game }) {
  // 달마다 바뀌는 "지난달보다"는 읽기도 전에 지나가서, 한 해를 마칠 때만 바뀌는 "작년 한 해"로 (decisions.md 74번).
  const year = yearDelta(game.yearly, game.initialAsset)
  return (
    // 넓은 화면에서는 전 재산과 타일 셋을 한 줄에 나란히 둬서 띠가 낮다 (#201).
    <div className="md:flex md:items-end md:gap-6" data-testid="portfolio-card">
      <div className="flex flex-wrap items-end justify-between gap-3 md:flex-none">
        <div>
          <p className="text-pen-soft">전 재산</p>
          <p
            className="pen-circle inline-block px-3.5 py-0.5 font-pen text-[46px] leading-tight text-red-pen sm:text-[54px]"
            data-testid="total-asset"
          >
            {shortWon(game.totalAsset)}
          </p>
        </div>
        {year && (
          <p
            className={`font-pen text-[24px] ${year.delta < 0 ? 'text-blue-pen' : 'text-red-pen'}`}
            data-testid="year-delta"
          >
            {year.age}세 한 해 {signedShortWon(year.delta)} ({signedPercent(year.bp)})
          </p>
        )}
      </div>
      {/* 현금·주식·빚은 한눈에 들어와야 한다 (decisions.md 137번): 작은 글씨 한 줄 대신 큼직한 타일 셋 */}
      <div className="mt-3 grid grid-cols-3 gap-2 md:mt-0 md:flex-1" data-testid="money-tiles">
        <MoneyTile label="현금" value={game.cash} testId="cash" />
        <MoneyTile
          label="주식"
          value={game.invested}
          testId="invested"
          note={game.holdings.length > 0 ? `${game.holdings.length}종목 · 보기` : undefined}
          onOpen={() => openLedgerTab('stocks')}
        />
        <MoneyTile
          label="빚"
          value={game.debt}
          testId="debt"
          tone={game.debt > 0 ? 'red' : 'pen'}
          note={game.debt > 0 ? '연 5% 이자' : undefined}
        />
      </div>
    </div>
  )
}

function MoneyTile({
  label,
  value,
  testId,
  tone = 'pen',
  note,
  onOpen,
}: {
  label: string
  value: number
  testId: string
  tone?: 'pen' | 'red'
  note?: string
  /** 누르면 장부의 해당 탭을 연다 (#210) */
  onOpen?: () => void
}) {
  const body = (
    <>
      <span className="block text-[12px] text-pen-soft">{label}</span>
      <span
        className={`block truncate font-pen text-[24px] leading-tight sm:text-[30px] ${tone === 'red' ? 'text-red-pen' : 'text-pen'}`}
        data-testid={testId}
      >
        {value === 0 && label === '빚' ? '없음' : shortWon(value)}
      </span>
      {note && <span className="block text-[11px] text-pen-soft">{note}</span>}
    </>
  )
  const box = 'min-w-0 rounded border-2 border-dashed border-[#a6acb8] px-2.5 py-1.5 text-left'
  return onOpen ? (
    <button type="button" className={`${box} hover:bg-white`} onClick={onOpen}>
      {body}
    </button>
  ) : (
    <div className={box}>{body}</div>
  )
}

/** 장부 탭을 열고 그 자리로 내려간다. 좁은 화면에서는 장부가 한참 아래에 있다. */
function openLedgerTab(tab: LedgerTab) {
  useLedgerTab.getState().setTab(tab)
  document.getElementById('ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 전 재산의 구성: 현금·주식·부동산·보증금을 한 줄 막대로, 빚은 그 아래 빨간 줄로 (#210). */
function WorthPanel({ game }: { game: Game }) {
  const bar = worthBar(worthParts(game))
  return (
    <section data-testid="worth-card">
      <h2 className="font-pen text-[28px] font-normal leading-8">무엇으로 이루어졌나</h2>
      {bar.gross <= 0 ? (
        <p className="text-pen-soft">아직 가진 것이 없다.</p>
      ) : (
        <>
          <div
            className="mt-2 flex h-7 w-full gap-[2px] overflow-hidden rounded"
            role="img"
            aria-label={bar.plus
              .map((p) => `${p.label} ${shortWon(p.value)} ${percent(p.share)}`)
              .join(', ')}
            data-testid="worth-bar"
          >
            {bar.plus.map((p) => (
              <div
                key={p.key}
                className="h-full min-w-[3px] first:rounded-l last:rounded-r"
                style={{
                  flexGrow: p.value,
                  flexBasis: 0,
                  background: WORTH_COLORS[p.key as keyof typeof WORTH_COLORS],
                }}
                title={`${p.label} ${won(p.value)} (${percent(p.share)})`}
                data-testid={`worth-seg-${p.key}`}
              />
            ))}
          </div>
          {bar.minus.length > 0 && (
            <div className="mt-1 flex h-2.5 w-full" aria-hidden="true">
              <div
                className="h-full rounded bg-red-pen"
                style={{
                  width: `${Math.min(100, bar.minus.reduce((s, p) => s + p.share, 0) / 100)}%`,
                }}
                title={bar.minus.map((p) => `${p.label} ${won(p.value)}`).join(' · ')}
              />
            </div>
          )}
          <ul className="m-0 mt-3 list-none p-0" data-testid="worth-legend">
            {bar.plus.map((p) => (
              <li
                key={p.key}
                className="flex items-center gap-2 border-b border-[#a6acb8] py-1"
                data-testid={`worth-row-${p.key}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{ background: WORTH_COLORS[p.key as keyof typeof WORTH_COLORS] }}
                />
                <span className="flex-1">{p.label}</span>
                <span>{won(p.value)}</span>
                <span className="w-14 text-right text-[13px] text-pen-soft">
                  {percent(p.share)}
                </span>
              </li>
            ))}
            {bar.minus.map((p) => (
              <li
                key={p.key}
                className="flex items-center gap-2 border-b border-[#a6acb8] py-1 text-red-pen"
                data-testid={`worth-row-${p.key}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 shrink-0 rounded-sm bg-red-pen"
                />
                <span className="flex-1">{p.key === 'homes' ? '집값보다 많은 대출' : p.label}</span>
                <span>{signedWon(p.value)}</span>
                <span className="w-14 text-right text-[13px]">{percent(p.share)}</span>
              </li>
            ))}
            <li className="flex items-center gap-2 pt-1">
              <span className="flex-1 font-pen text-[22px]">전 재산</span>
              <span className="font-pen text-[24px] text-red-pen" data-testid="worth-total">
                {won(game.totalAsset)}
              </span>
              <span className="w-14" />
            </li>
          </ul>
          <p className="mt-1 text-[12px] text-pen-soft">
            비율은 빚을 빼기 전 총자산 {shortWon(bar.gross)}에 대한 것. 부동산은 시세 − 주담대 −
            세입자 보증금, 보증금은 전·월세 보증금 − 전세대출.
          </p>
        </>
      )}
    </section>
  )
}

function Household({ game }: { game: Game }) {
  const h = game.household
  // 전업투자자는 월급만 없을 뿐 생활비가 나가므로 가계부를 보여 준다 (decisions.md 35번).
  const working = (game.job !== null && game.job !== undefined) || game.fullTimeInvestor
  // 자녀 비용은 생활비에 합쳐져 온다. 은퇴 뒤에는 월급 대신 연금. 주거비는 생활비와 따로 나간다 (주거 설계 2절).
  const saving =
    h.monthlyIncome + h.spouseIncome + h.pension - h.monthlyExpense - game.housing.monthlyCost
  const month = Math.floor(game.market.month % 12) + 1
  const family = h.married
    ? `부부${h.spouse ? `(${h.spouse.job})` : ''}${h.children.length > 0 ? ` · 자녀 ${h.children.map((c) => `${c.age}살 ${childWord(c.sex)}${c.leftHome ? '(독립)' : ''}`).join(', ')}` : ''}`
    : '혼자'
  return (
    <section className="mt-2" data-testid="household-card">
      <h2 className="font-pen text-[28px] font-normal leading-8">{month}월 가계부</h2>
      {/* 행복도 (decisions.md 82번): 돈만이 아니라 삶이 어떤지 */}
      <p className="text-[13px] text-pen-soft" data-testid="ledger-happiness">
        행복도 <span className="font-pen text-[20px] text-red-pen">{game.happiness}</span>
        <span className="text-[11px]"> / 100</span>
        {(h.married || h.children.length > 0) && (
          // 가족 점수 (decisions.md 88번): 가족이 생긴 뒤에만
          <span data-testid="ledger-family">
            {' · '}가족 <span className="font-pen text-[20px] text-red-pen">{game.family}</span>
            <span className="text-[11px]"> / 100</span>
          </span>
        )}
      </p>
      {!working ? (
        <p className="text-pen-soft">
          {game.phase === 'CHILDHOOD' ? '아직 부모님 집이다.' : '직업이 생기면 가계부가 시작된다.'}
          {/* 일을 시작하기 전의 돈줄: 20세부터 아르바이트 (decisions.md 96·98번) */}
          {h.pocketMoney && (
            <span className="block" data-testid="ledger-pocket-money">
              {h.pocketMoney.label} 매달 {won(h.pocketMoney.monthly)}
            </span>
          )}
        </p>
      ) : (
        <table className="w-full border-collapse">
          <tbody>
            {h.retired ? (
              <Row label="연금" value={h.pension} />
            ) : (
              <Row label="월급" value={h.monthlyIncome} />
            )}
            {h.married && <Row label={`${spouseWord(game.sex)} 소득`} value={h.spouseIncome} />}
            <Row label={`생활비 (${family})`} value={-h.monthlyExpense} />
            {game.housing.monthlyCost > 0 && (
              <Row label="주거비" value={-game.housing.monthlyCost} />
            )}
            {game.debt > 0 && (
              <tr>
                <th scope="row" className="border-b border-[#a6acb8] py-1 text-left font-normal">
                  빚 <span className="text-[12px] text-pen-soft">연 5% 이자</span>
                </th>
                <td className="border-b border-[#a6acb8] text-right text-red-pen">
                  {won(game.debt)}
                </td>
              </tr>
            )}
            <tr>
              <th
                scope="row"
                className="border-t-2 border-pen pt-1 text-left font-pen text-[22px] font-normal"
              >
                남은 돈
              </th>
              <td
                className={`border-t-2 border-pen pt-1 text-right font-pen text-[26px] ${saving < 0 ? 'text-red-pen' : ''}`}
                data-testid="monthly-saving"
              >
                {signedWon(saving)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <p className="mt-1 text-[13px] text-pen-soft" data-testid="family">
        가족 · {family}
        {h.marriedAge != null && ` (${h.marriedAge}살 결혼)`}
        {h.retired && ' · 은퇴'}
      </p>
    </section>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <th scope="row" className="border-b border-[#a6acb8] py-1 text-left font-normal">
        {label}
      </th>
      <td className={`border-b border-[#a6acb8] text-right ${value < 0 ? 'text-blue-pen' : ''}`}>
        {signedWon(value)}
      </td>
    </tr>
  )
}

function Stocks({ game }: { game: Game }) {
  const total = stockSummary(game)
  return (
    <section data-testid="stocks-card">
      <h2 className="font-pen text-[28px] font-normal leading-8">갖고 있는 주식</h2>
      {game.holdings.length === 0 ? (
        <p className="text-pen-soft">아직 없다.</p>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-3" data-testid="stocks-summary">
          <span>
            평가액 <b className="font-pen text-[26px] font-normal">{won(total.value)}</b>
          </span>
          <span className={total.pnl < 0 ? 'text-blue-pen' : 'text-red-pen'}>
            {signedWon(total.pnl)} ({signedPercent(total.pnlBp)})
          </span>
          <span className="text-[13px] text-pen-soft">{game.holdings.length}종목</span>
        </p>
      )}
      {game.holdings.length > 0 && (
        <ul className="m-0 mt-1 list-none border-t border-[#a6acb8] p-0">
          {game.holdings.map((h) => (
            <li
              key={h.stockCode}
              className="flex justify-between gap-2 py-1"
              data-testid="holding-row"
              data-stock={h.stockCode}
            >
              <span>
                {h.stockName} {h.quantity.toLocaleString('ko-KR')}주
                <span className="ml-1 text-[12px] text-pen-soft">
                  평단 {h.avgCost.toLocaleString('ko-KR')}
                </span>
              </span>
              <span>
                {won(h.value)}{' '}
                <b className={h.pnlBp < 0 ? 'text-blue-pen' : 'text-red-pen'}>
                  {h.pnlBp < 0 ? '↓' : '↑'}
                  {percent(Math.abs(h.pnlBp))}
                </b>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 매매하러 가기. 어느 탭을 보고 있든 누를 수 있게 탭 아래에 둔다 (#212). */
function TradeButton({ game }: { game: Game }) {
  const openMarket = useGameStore((s) => s.openMarket)
  const canTrade = game.phase === 'INVESTING' && game.status === 'ACTIVE'
  return (
    <button
      type="button"
      className="mt-5 min-h-[52px] w-full rounded-full bg-pen text-[16px] text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={!canTrade}
      onClick={openMarket}
      data-testid="open-market"
    >
      매매하러 가기 · 시간 정지
      {!canTrade && game.status === 'ACTIVE' && (
        <span className="ml-1 text-[13px]">(투자 시작 전)</span>
      )}
    </button>
  )
}

const rate = (bp: number) => `${(bp / 100).toFixed(2)}%`

/** 집: 어떻게 사는지, 대출과 금리, 가진 아파트(매물로 내놓기), 아파트 시세 (주거 설계). */
function Home({ game }: { game: Game }) {
  const h = game.housing
  const listHome = useGameStore((s) => s.listHome)
  const busy = Boolean(game.pendingEvent) || game.status !== 'ACTIVE'
  return (
    <section data-testid="housing-card">
      <h2 className="font-pen text-[28px] font-normal leading-8">사는 곳</h2>
      <p data-testid="tenure">
        <b>{TENURE_LABELS[h.tenure]}</b>
        {h.roomsName && ` · ${h.roomsName}`}
        {h.regionName && h.tenure !== 'OWN' && ` · ${h.regionName}`}
        {h.leaseEndAge != null && ` · ${h.leaseEndAge}살 만기`}
        {h.insured && ' · 보증보험'}
        {h.cramped && (
          <span className="text-red-pen" data-testid="cramped">
            {' '}
            · 식구에 비해 좁다
          </span>
        )}
      </p>
      {h.tenure !== 'PARENTS' && (
        <p className="text-[13px] text-pen-soft">
          {h.deposit > 0 && `보증금 ${won(h.deposit)} · `}
          {h.jeonseLoan > 0 && `전세대출 ${won(h.jeonseLoan)} · `}월 주거비 {won(h.monthlyCost)} ·
          주담대 금리 연 {rate(h.mortgageRateBp)}
        </p>
      )}
      {h.homes.length > 0 && (
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0" data-testid="homes">
          {h.homes.map((home) => {
            const gain = home.price - home.purchasePrice
            const equity = home.price - home.mortgage - home.tenantDeposit
            const change = h.quotes.find((q) => q.name === home.regionName)?.change12mBp
            return (
              <li
                key={home.seq}
                className="border-b border-dashed border-[#a6acb8] pb-2"
                data-testid="home-row"
              >
                <p className="flex justify-between gap-2">
                  <span>
                    <b>{home.regionName}</b> {home.residence ? '내가 사는 집' : '갭투자'}
                  </span>
                  <span>
                    시세 {won(home.price)}
                    {change !== undefined && (
                      <span
                        className={`ml-1 text-[13px] ${change >= 0 ? 'text-red-pen' : 'text-blue-pen'}`}
                      >
                        1년 {signedPercent(change)}
                      </span>
                    )}
                  </span>
                </p>
                <p className="flex justify-between gap-2" data-testid="home-equity">
                  <span className="text-pen-soft">내 몫(지분)</span>
                  <span className={`font-pen text-[22px] ${equity < 0 ? 'text-red-pen' : ''}`}>
                    {won(equity)}
                  </span>
                </p>
                <p className="text-[13px] text-pen-soft">
                  산 값 {won(home.purchasePrice)} ·{' '}
                  <span className={gain >= 0 ? 'text-red-pen' : 'text-blue-pen'}>
                    {signedWon(gain)}
                  </span>
                  {home.mortgage > 0 &&
                    ` · 주담대 ${won(home.mortgage)} (30년 원리금균등 · 월 ${won(home.monthlyPayment)})`}
                  {home.tenantDeposit > 0 && ` · 세입자 보증금 ${won(home.tenantDeposit)}`}
                </p>
                {home.mortgage > 0 && (
                  <MortgageRepay
                    seq={home.seq}
                    mortgage={home.mortgage}
                    cash={game.cash}
                    busy={busy}
                  />
                )}
                <button
                  type="button"
                  disabled={busy}
                  className="mt-1 min-h-11 rounded-full border-2 border-pen px-4 text-[13px] hover:bg-white disabled:opacity-40"
                  onClick={() => void listHome(home.seq, !home.listed)}
                  data-testid={`list-home-${home.seq}`}
                >
                  {home.listed ? '매물 거두기 (매수자 기다리는 중)' : '매물로 내놓기'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {h.tenure !== 'PARENTS' && (
        <ul className="m-0 mt-2 list-none p-0 text-[13px] text-pen-soft" data-testid="home-quotes">
          {h.quotes.map((q) => (
            <li key={q.region} className="flex justify-between">
              <span>{q.name}</span>
              <span>
                {won(q.price)} · 1년{' '}
                <span className={q.change12mBp >= 0 ? 'text-red-pen' : 'text-blue-pen'}>
                  {signedPercent(q.change12mBp)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 주담대 일시 상환: 현금으로 원금을 갚아 남은 기간의 월 상환액을 줄인다 (decisions.md 58번). */
function MortgageRepay({
  seq,
  mortgage,
  cash,
  busy,
}: {
  seq: number
  mortgage: number
  cash: number
  busy: boolean
}) {
  const repayMortgage = useGameStore((s) => s.repayMortgage)
  const pause = useGameStore((s) => s.pause)
  const resume = useGameStore((s) => s.resume)
  const [open, setOpen] = useState(false)
  // 금액을 입력하는 동안 시계를 멈춘다. 닫으면(상환·취소·화면 이동) 다시 흐른다 (decisions.md 89번).
  useEffect(() => {
    if (!open) {
      return
    }
    pause()
    return () => resume()
  }, [open, pause, resume])
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const max = Math.min(mortgage, Math.max(0, cash))
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const canSubmit = !busy && !sending && value >= 1 && value <= max
  const submit = async () => {
    setSending(true)
    const failed = await repayMortgage(seq, value)
    setSending(false)
    setError(failed)
    if (!failed) {
      setOpen(false)
      setAmount('')
    }
  }
  if (!open) {
    return (
      <button
        type="button"
        disabled={busy || max < 1}
        className="mt-1 mr-2 min-h-11 rounded-full border-2 border-pen px-4 text-[13px] hover:bg-white disabled:opacity-40"
        onClick={() => setOpen(true)}
        data-testid={`repay-home-${seq}`}
      >
        주담대 일시 상환
      </button>
    )
  }
  return (
    <div className="mt-1 rounded border border-line bg-card px-3 py-2.5" data-testid="repay-form">
      <label className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted">갚을 원금</span>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          className="min-h-10 w-full rounded border border-line bg-card px-2.5 text-right font-mono-num text-base"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="갚을 원금"
        />
        <span className="text-xs text-muted">원</span>
      </label>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {[10, 25, 50, 100].map((p) => (
          <button
            key={p}
            type="button"
            className="min-h-8 rounded border border-line bg-card font-mono-num text-[11px] hover:bg-bg"
            onClick={() => setAmount(String(Math.floor((max * p) / 100)))}
          >
            {p}%
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        현금 {won(cash)} · 남은 주담대 {won(mortgage)} · 최대 {won(max)}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-wine">
          {error}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          className="min-h-11 flex-1 rounded bg-wine text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => void submit()}
        >
          {sending ? '갚는 중…' : '갚기'}
        </button>
        <button
          type="button"
          className="min-h-11 rounded border border-line px-4 text-sm"
          onClick={() => setOpen(false)}
        >
          닫기
        </button>
      </div>
    </div>
  )
}
