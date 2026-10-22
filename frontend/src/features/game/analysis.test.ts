import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../../api/client'
import {
  indicatorChange,
  indicatorValue,
  insightGauge,
  movingAverage,
  newsMarkers,
  readingLabel,
  stockNews,
} from './analysis'

const entry = (
  kind: LogEntry['kind'],
  day: number,
  payload: Record<string, unknown>,
  seq = 1,
): LogEntry => ({ seq, day, kind, payload })

describe('movingAverage', () => {
  it('앞쪽은 있는 만큼으로 평균하고 창이 차면 창 크기로 나눈다', () => {
    expect(movingAverage([10, 20, 30, 40], 2)).toEqual([10, 15, 25, 35])
    expect(movingAverage([3, 3, 3], 12)).toEqual([3, 3, 3])
    expect(movingAverage([], 6)).toEqual([])
  })
})

describe('insightGauge', () => {
  it('안목을 10칸으로 보여 주고 확률은 없다', () => {
    expect(insightGauge(0)).toBe('○○○○○○○○○○')
    expect(insightGauge(30)).toBe('●●●○○○○○○○')
    expect(insightGauge(100)).toBe('●●●●●●●●●●')
    expect(insightGauge(30)).not.toContain('%')
  })
})

describe('readingLabel', () => {
  it('추세·시황 결론을 우리말로', () => {
    expect(readingLabel('UP')).toBe('상승')
    expect(readingLabel('COLD')).toBe('위축')
    expect(readingLabel('???')).toBe('???')
  })
})

describe('stockNews', () => {
  const game = {
    startAge: 15,
    daysPerYear: 360,
    log: [
      entry(
        'NEWS',
        20 * 360,
        { stockCode: 'ssj', eventTitle: '신공장 증설', chosen: 'BUY', actual: 'BUY' },
        1,
      ),
      entry(
        'PRICE',
        20 * 360,
        { stockCode: 'ssj', direction: 'UP', changeBp: 1400, sectorWide: false },
        2,
      ),
      entry(
        'NEWS',
        21 * 360,
        { stockCode: 'sqh', eventTitle: '다른 종목', chosen: 'BUY', actual: 'BUY' },
        3,
      ),
      entry(
        'SHAKE',
        22 * 360,
        { stockCode: 'ssj', eventTitle: '급락', chosen: 'HOLD', actual: 'SELL' },
        4,
      ),
      entry(
        'TRADE',
        23 * 360 + 30,
        {
          stockCode: 'ssj',
          side: 'BUY',
          actual: 'BUY',
          status: 'EXECUTED',
          quantity: 10,
          price: 71200,
        },
        5,
      ),
      entry(
        'TRADE',
        23 * 360 + 60,
        { stockCode: 'ssj', side: 'SELL', actual: 'HOLD', status: 'HELD' },
        6,
      ),
      entry('LIFE', 23 * 360, { title: '명절' }, 7),
    ],
  }

  it('그 종목의 뉴스·충격·흔들림·매매만 최근 순으로 모은다', () => {
    const items = stockNews(game, 'ssj')
    expect(items.map((i) => i.text)).toEqual([
      '매도 주문 → 못 팔았다',
      '매수 10주 @ 71,200',
      '급락 · 나: 버틴다 → 실제 판다',
      '주가 ▲ 14.0%',
      '신공장 증설 · 나: 매수',
    ])
    expect(items[4].age).toBe(35)
    expect(items[4].month).toBe(240)
    expect(items[1].month).toBe(23 * 12 + 1)
  })

  it('차트 표시는 뉴스·흔들림·매매의 달만', () => {
    expect(newsMarkers(stockNews(game, 'ssj')).map((m) => m.kind)).toEqual([
      'TRADE',
      'TRADE',
      'SHAKE',
      'NEWS',
    ])
  })
})

describe('indicator 표기', () => {
  it('단위에 맞춰 값을 보여 준다', () => {
    expect(indicatorValue('bp', 550)).toBe('5.5%')
    expect(indicatorValue('won', 1300)).toBe('1,300원')
    expect(indicatorValue('score', 48)).toBe('48')
    expect(indicatorValue('ratio', 13000)).toBe('평소의 130%')
    expect(indicatorValue('index', 1234)).toBe('1,234')
  })

  it('1년 변화는 금리·증가율이면 %p, 심리면 차이, 나머지는 비율', () => {
    expect(indicatorChange('bp', 700, 550)).toBe('+1.5%p')
    expect(indicatorChange('score', 40, 55)).toBe('−15')
    expect(indicatorChange('index', 1100, 1000)).toBe('+10.0%')
    expect(indicatorChange('won', 1200, 1300)).toBe('−7.7%')
    expect(indicatorChange('won', 1200, 0)).toBe('—')
  })
})
