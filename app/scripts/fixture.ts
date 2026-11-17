import type { components } from '../../frontend/src/api/schema.d.ts'

type Company = components['schemas']['Company']
type Grade = components['schemas']['Grade']

/**
 * 화면을 눈으로 보기 위한 가짜 회사 (scripts/shot.ts). 서버 없이 Playwright가 /api/company에 이 값을 돌려준다. 규칙·숫자는 아무 뜻 없는 보기용이다.
 * 계약(Company)에 맞는지 타입으로 본다: 분기·결산·파산은 없고, 회사는 초마다 벌며 종목회의는 기회로 연다 (#803).
 */
const g = (insight: Grade, patience: Grade, courage: Grade, conviction: Grade, luck: Grade) => ({
  insight,
  patience,
  courage,
  conviction,
  luck,
})

const desks = [
  {
    code: 'semiconductor',
    name: '반도체 데스크',
    statCode: 'courage',
    trades: true,
    sector: 'semiconductor',
    hot: true,
    description: '반도체 종목을 굴린다.',
    gainBp: 3100,
    missBp: 1000,
    crashPercent: 130,
  },
  {
    code: 'bio',
    name: '바이오 데스크',
    statCode: 'patience',
    trades: true,
    sector: 'bio',
    hot: false,
    description: '바이오 종목을 굴린다.',
    gainBp: 2800,
    missBp: 1000,
    crashPercent: 100,
  },
  {
    code: 'food',
    name: '식품 데스크',
    statCode: 'patience',
    trades: true,
    sector: 'food',
    hot: false,
    description: '식품 종목을 굴린다. 폭락장에 덜 빠진다.',
    gainBp: 1800,
    missBp: 600,
    crashPercent: 30,
  },
  {
    code: 'day',
    name: '단타 데스크',
    statCode: 'courage',
    trades: true,
    sector: null,
    hot: false,
    description: '하루에 사고판다.',
    gainBp: 2200,
    missBp: 800,
    crashPercent: 100,
  },
  {
    code: 'scout',
    name: '종목 발굴팀',
    statCode: 'insight',
    trades: false,
    sector: null,
    hot: false,
    description: '종목을 물어 온다.',
    gainBp: null,
    missBp: null,
    crashPercent: null,
  },
  {
    code: 'research',
    name: '리서치 팀',
    statCode: 'insight',
    trades: false,
    sector: null,
    hot: false,
    description: '기사에 형광펜을 긋는다.',
    gainBp: null,
    missBp: null,
    crashPercent: null,
  },
  {
    code: 'risk',
    name: '리스크 관리',
    statCode: 'patience',
    trades: false,
    sector: null,
    hot: false,
    description: '폭락장에 손실을 줄인다.',
    gainBp: null,
    missBp: null,
    crashPercent: null,
  },
  {
    code: 'hr',
    name: '인사팀',
    statCode: 'conviction',
    trades: false,
    sector: null,
    hot: false,
    description: '지원자를 더 데려온다.',
    gainBp: null,
    missBp: null,
    crashPercent: null,
  },
]

const QUIRKS = [
  ['gut', '촉파'],
  ['chat', '단톡방파'],
  ['chart', '차트파'],
  ['news', '뉴스파'],
  ['coffee', '커피파'],
] as const

const employee = (
  id: number,
  name: string,
  overallGrade: Grade,
  grades: Record<string, Grade>,
  // 뽑으면 서버가 바로 앉히므로 모두 자리가 있다 (#801).
  desk: string,
  extra: Partial<Company['employees'][number]> = {},
): Company['employees'][number] => ({
  id,
  name,
  overallGrade,
  effects: [],
  perk: '주니어 · 손 뒤집힘 −10% · 한 해 일하면 40% 확률로 자란다',
  grades,
  desk,
  sector: null,
  sectorName: null,
  role: null,
  // 직원이 1초에 버는 돈 (#803): 보기용으로 번호에 따라 조금씩 다르게 둔다.
  incomePerSecond: 1200 + id * 350,
  // 버릇 (decisions.md 349번): 서버처럼 번호로 정한다.
  quirk: QUIRKS[(id * 7 + 3) % QUIRKS.length][0],
  quirkName: QUIRKS[(id * 7 + 3) % QUIRKS.length][1],
  ...extra,
})

/** 깬 스테이지의 별: 다 받은 칸·덜 받은 칸·보스(1-10)가 한 챕터에 섞여 보이게. */
const STAGE_STARS = [3, 3, 3, 3, 2, 3, 3, 1, 3, 2, 3, 2]

export const company = {
  companyId: '00000000-0000-0000-0000-000000000001',
  number: 1,
  era: { code: 'ai', name: 'AI 반도체 시대', description: '반도체가 뜨고 바이오는 조용하다.' },
  opening: null,
  capital: 412_500_000,
  // 다이아 (526번): 직원·고양이·무기 뽑기에 쓴다. 10연차 한 번과 한 번 뽑기 두 번이 되는 수다.
  diamonds: { amount: 1200, draw: 100, tenDraw: 1000, tenCount: 11, hire: 100 },
  grade: 'E',
  nextGradeCapital: 600_000_000,
  upgrade: { to: 'D', cost: 150_000_000, needed: 750_000_000, affordable: false },
  seats: 8,
  employees: [
    employee(1, '김대리', 'B', g('B', 'A', 'C', 'B', 'D'), 'semiconductor', {
      sector: 'semiconductor',
      sectorName: '반도체',
    }),
    employee(2, '박과장', 'C', g('C', 'C', 'B', 'D', 'C'), 'bio'),
    employee(3, '이사원', 'D', g('A', 'D', 'E', 'D', 'C'), 'research'),
    employee(4, '최주임', 'E', g('E', 'E', 'D', 'F', 'B'), 'semiconductor'),
    employee(5, '한도윤', 'S', g('S', 'A', 'S', 'A', 'B'), 'day'),
    employee(6, '정아름', 'E', g('E', 'D', 'E', 'E', 'D'), 'food'),
    employee(7, '윤서연', 'E', g('E', 'F', 'E', 'E', 'D'), 'bio'),
  ],
  desks,
  meeting: {
    hrCap: null,
    hot: '반도체 섹터에 시대 보너스가 붙는다.',
  },
  // 종목회의의 기회 (#803): 한 시간에 하나씩, 세 개까지.
  meetings: { chances: 2, max: 3, nextSeconds: 1500 },
  // 출석 보상 (528번): 오늘 것은 이미 받은 채로 둔다. 출석판이 스스로 떠서 다른 화면 검사를 가리지 않게.
  // 상점 (541번): 무료 다이아와 돈·다이아 교환. 오늘은 아무것도 사지 않았다.
  shop: {
    items: [
      {
        code: 'free',
        name: '오늘의 무료 다이아',
        priceDiamonds: 0,
        priceMoney: null,
        giveDiamonds: 20,
        giveIncomeMinutes: 0,
        giveMoney: null,
        dailyLimit: 1,
        left: 1,
      },
      {
        code: 'diamonds',
        name: '다이아 꾸러미',
        priceDiamonds: 0,
        priceMoney: 58_200_000,
        giveDiamonds: 20,
        giveIncomeMinutes: 0,
        giveMoney: null,
        dailyLimit: 5,
        left: 5,
      },
      {
        code: 'money-small',
        name: '돈 보따리',
        priceDiamonds: 60,
        priceMoney: null,
        giveDiamonds: 0,
        giveIncomeMinutes: 30,
        giveMoney: 87_300_000,
        dailyLimit: 3,
        left: 3,
      },
      {
        code: 'money-large',
        name: '큰 돈 보따리',
        priceDiamonds: 200,
        priceMoney: null,
        giveDiamonds: 0,
        giveIncomeMinutes: 120,
        giveMoney: 349_200_000,
        dailyLimit: 1,
        left: 1,
      },
    ],
    lastReceipt: null,
  },
  attendance: {
    today: 3,
    claimable: false,
    board: [50, 50, 100, 50, 100, 100, 300].map((diamonds, i) => ({
      day: i + 1,
      diamonds,
      incomeMinutes: 0,
      money: null,
      claimed: i < 3,
    })),
    lastReward: { day: 3, diamonds: 100, money: 0 },
  },
  // 시즌패스 (529·571번): 3단계까지 올라 모두 받은 채다. 보통 단계는 다이아 50, 5의 배수는 큰 보상. 돈은 없다.
  pass: {
    season: 1,
    name: '시즌 1',
    endsAt: 1_795_000_000_000,
    secondsLeft: 12 * 86_400 + 5 * 3600,
    endingSoon: false,
    points: 1020,
    pointsPerStep: 300,
    step: 3,
    claimable: 0,
    steps: Array.from({ length: 30 }, (_, i) => {
      const step = i + 1
      return {
        step,
        diamonds: step === 30 ? 500 : step % 10 === 0 ? 300 : step % 5 === 0 ? 200 : 50,
        weapon: step === 10 || step === 20,
        cat: step === 30,
        reached: step <= 3,
        claimed: step <= 3,
      }
    }),
    missions: [
      { code: 'wall', title: '매도벽 100개 통과', count: 73, target: 100, every: 50, points: 30 },
      { code: 'boss', title: '보스 2번 처치', count: 1, target: 2, every: 1, points: 30 },
      { code: 'upgrade', title: '강화 150번', count: 120, target: 150, every: 50, points: 30 },
      {
        code: 'draw',
        title: '고양이·무기 뽑기 20번',
        count: 11,
        target: 20,
        every: 10,
        points: 30,
      },
      { code: 'merge', title: '무기 합성 5번', count: 2, target: 5, every: 5, points: 30 },
      { code: 'attend', title: '출석 9일', count: 8, target: 9, every: 1, points: 100 },
    ].map((m) => ({ ...m, earned: Math.floor(m.count / m.every) * m.points })),
    lastRewards: [],
  },
  gacha: {
    roster: 7,
    // 데리고 있을 수 있는 수는 자리 수와 같다 (#801).
    rosterMax: 8,
    draws: 9,
    maxDraws: 10,
    rates: [
      { grade: 'F', percent: 30, star: false },
      { grade: 'E', percent: 44, star: false },
      { grade: 'D', percent: 18, star: false },
      { grade: 'C', percent: 6, star: false },
      { grade: 'S', percent: 2, star: true },
    ],
    drawn: [
      {
        employeeId: 4,
        name: '최주임',
        grade: 'E',
        star: false,
        fresh: false,
        perk: '맞히면 1.2배',
      },
      {
        employeeId: 5,
        name: '한도윤',
        grade: 'S',
        star: true,
        fresh: true,
        perk: '맞히면 7.4배 · 끌어주기',
      },
      {
        employeeId: 6,
        name: '정아름',
        grade: 'D',
        star: false,
        fresh: false,
        perk: '맞히면 1.4배',
      },
      {
        employeeId: 7,
        name: '윤서연',
        grade: 'E',
        star: false,
        fresh: false,
        perk: '맞히면 1.2배',
      },
      { employeeId: 8, name: '오세진', grade: 'C', star: false, fresh: true, perk: '맞히면 1.8배' },
    ],
    collection: (
      [
        'F',
        'E',
        'D',
        'C',
        'B',
        'A',
        'S',
        'SS',
        'SSS',
        'X',
        'XX',
        'XXX',
        'Z',
        'ZZ',
        'ZZZ',
        'XS',
        'XSS',
        'GOD',
      ] as Grade[]
    ).map((grade, i) => ({ grade, count: [3, 6, 4, 2, 1, 0, 1][i] ?? 0 })),
  },
  history: {
    timeline: [
      { year: 1, kind: 'open', text: '반지하 원룸에 간판을 걸었다.', grade: null },
      { year: 2, kind: 'grow', text: null, grade: 'E' },
      { year: 2, kind: 'best', text: '김대리가 한 해 120b를 벌었다.', grade: null },
    ],
    achievements: [
      {
        code: 'first-hire',
        name: '첫 직원',
        description: '공채에서 처음 뽑았다',
        year: 1,
        fail: false,
      },
      {
        code: 'first-move',
        name: '첫 이사',
        description: '다음 건물로 갔다',
        year: 2,
        fail: false,
      },
      {
        code: 'crash-survivor',
        name: '폭락장 생존',
        description: '폭락장을 손실 없이 버텼다',
        year: null,
        fail: false,
      },
      {
        code: 'landmark',
        name: '랜드마크',
        description: '랜드마크 타워에 올랐다',
        year: null,
        fail: false,
      },
    ],
    hall: [
      { name: '김대리', from: 1, to: null, totalPnl: 180_000_000, grade: 'B' },
      { name: '박과장', from: 1, to: null, totalPnl: 42_000_000, grade: 'C' },
    ],
  },
  invest: null,
  // 멘탈 보호 스테이지 (527번): 별 30·30·40, 10의 배수는 두 배. 아직 얻지 않은 별의 몫이 남은 다이아다.
  stages: {
    best: STAGE_STARS.length,
    last: 50,
    perChapter: 10,
    stars: STAGE_STARS,
    bonusPercent: 30,
    exAvailable: true,
    diamondsLeft: Array.from({ length: 50 }, (_, i) => {
      const left = [100, 70, 40, 0][STAGE_STARS[i] ?? 0]
      return (i + 1) % 10 === 0 ? left * 2 : left
    }),
    exDiamonds: 300,
    lastResult: null,
  },
} satisfies Company
