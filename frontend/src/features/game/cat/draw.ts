/**
 * 고양이 그림 (decisions.md 341번). 그림은 이미지 파일이 아니라 코드다: 캔버스 경로로 그린다.
 *
 * 규칙(사용자가 고른 레퍼런스): 갈색 가는 윤곽(INK), 파스텔 면, 둥근 머리에 작은 몸, 점 눈, 아주 작은 입, 작은 귀.
 * 부위(꼬리·몸·팔·발·귀·머리)를 먼저 잉크색으로 굵게 깔고 그 위에 털색으로 다시 칠해 **바깥 윤곽선 하나만** 남긴다(안쪽 선 없음). 윤곽은 상자 기준 2.6(344번: 작게 보여도 또렷하게).
 * 좌표는 100×110 상자(머리 중심 50,40 · 발끝 ≈ 99). 그리는 쪽이 ctx.scale로 크기를 정한다.
 */

export const INK = '#4a3528'

export type Pattern = 'solid' | 'tabby' | 'tuxedo' | 'calico' | 'point'
export type Outfit = 'none' | 'hoodie' | 'shirt' | 'suit'
export type Face = 'idle' | 'fire' | 'hurt' | 'star' | 'sad' | 'sleep' | 'boss' | 'joy'
export type Acc =
  | 'tie'
  | 'bowtie'
  | 'ribbon'
  | 'glasses'
  | 'scarf'
  | 'crown'
  | 'necklace'
  | 'headset'
  | 'visor'
  | 'cap'
  | 'beanie'
  | 'hardhat'
  | 'bell'

export interface CatLook {
  /** 기본 털색 */
  fur: string
  /** 무늬색(줄무늬·얼룩). 없으면 fur를 어둡게 */
  fur2?: string
  pattern?: Pattern
  outfit?: Outfit
  acc?: Acc[]
  face?: Face
  /** 모자 색(cap·beanie) */
  hatCol?: string
  /** 두 손으로 권총을 든다 */
  gun?: boolean
  /** 총을 드는 자세(두 팔을 앞으로)만 하고 총은 그리지 않는다. 총을 따로 돌려 그릴 때(멘탈 전투) */
  armsForward?: boolean
  /** 권총 각도(라디안, 기본 위-오른쪽) */
  gunAngle?: number
}

/** 상자 크기. */
export const CAT_W = 100
export const CAT_H = 110
/** 눈의 자리(상자 좌표): 머리 중심 50에서 좌우 dx, 높이 y. 바깥에서 눈을 덮어 깜빡임을 그릴 때 쓴다. */
export const EYE = { cx: 50, dx: 8.5, y: 42 }

type Ctx = CanvasRenderingContext2D

function ell(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  c.beginPath()
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
}
function fs(c: Ctx, color: string, lw = 2.5) {
  c.fillStyle = color
  c.fill()
  if (lw) {
    c.lineWidth = lw
    c.strokeStyle = INK
    c.lineJoin = 'round'
    c.lineCap = 'round'
    c.stroke()
  }
}
function tri(c: Ctx, a: [number, number], b: [number, number], d: [number, number]) {
  c.beginPath()
  c.moveTo(a[0], a[1])
  c.lineTo(b[0], b[1])
  c.lineTo(d[0], d[1])
  c.closePath()
}
function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}
/** 색을 어둡게 (#rrggbb). */
export function dark(hex: string, k = 0.82): string {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) * k) | 0
  const g = (((n >> 8) & 255) * k) | 0
  const b = ((n & 255) * k) | 0
  return `rgb(${r},${g},${b})`
}

/** 고양이 한 마리를 (0,0)~(100,110)에 그린다. */
export function drawCat(c: Ctx, o: CatLook) {
  const fur = o.fur
  const fur2 = o.fur2 ?? dark(fur, 0.86)
  const face = o.face ?? 'idle'
  const acc = o.acc ?? []
  const outfit = o.outfit ?? 'none'
  const HX = 50
  const HY = 40
  const HR = 24
  const HRY = 22
  const BX = 50
  const BY = 72
  const BR = 21
  const BRY = 23
  const bodyCol =
    outfit === 'suit'
      ? '#4b5878'
      : outfit === 'shirt'
        ? '#e3edf5'
        : outfit === 'hoodie'
          ? '#a7afb8'
          : fur
  c.save()
  c.lineJoin = 'round'
  c.lineCap = 'round'
  // 그림자
  ell(c, 50, 97, 22, 5)
  c.fillStyle = 'rgba(74,53,40,.16)'
  c.fill()
  const ear = (sgn: 1 | -1) => {
    const ex = HX + sgn * 15
    const ey = HY - 17
    c.beginPath()
    c.moveTo(ex - sgn * 7, ey + 7)
    c.quadraticCurveTo(ex - sgn * 2, ey - 10, ex + sgn * 3, ey - 9)
    c.quadraticCurveTo(ex + sgn * 9, ey - 2, ex + sgn * 8, ey + 6)
    c.closePath()
  }
  const parts: [() => void, string][] = [
    [() => ell(c, BX, BY, BR, BRY), bodyCol],
    [
      () => {
        if (!o.gun && !o.armsForward) ell(c, BX - BR + 2, BY + 6, 6, 9, 0.3)
        else ell(c, BX - 6, BY + 2, 5, 10, 1.0)
      },
      bodyCol,
    ],
    [
      () => {
        if (!o.gun && !o.armsForward) ell(c, BX + BR - 2, BY + 6, 6, 9, -0.3)
        else ell(c, BX + 13, BY + 3, 5, 9, -1.2)
      },
      bodyCol,
    ],
    [() => ell(c, 40, 94, 8, 5), fur],
    [() => ell(c, 60, 94, 8, 5), fur],
    [() => ear(-1), fur],
    [() => ear(1), fur],
    [() => ell(c, HX, HY, HR, HRY), fur],
  ]
  const tail = () => {
    c.beginPath()
    c.moveTo(BX + BR - 4, BY + 14)
    c.quadraticCurveTo(BX + BR + 18, BY + 16, BX + BR + 12, BY - 6)
  }
  // 1) 잉크 바탕(굵게) → 바깥 윤곽 하나
  tail()
  c.lineWidth = 10.4
  c.strokeStyle = INK
  c.stroke()
  for (const [draw] of parts) {
    draw()
    c.fillStyle = INK
    c.fill()
    c.lineWidth = 5.2
    c.strokeStyle = INK
    c.stroke()
  }
  // 2) 색
  tail()
  c.lineWidth = 5.2
  c.strokeStyle = fur
  c.stroke()
  for (const [draw, col] of parts) {
    draw()
    c.fillStyle = col
    c.fill()
  }
  // 몸 무늬·옷 세부
  c.save()
  ell(c, BX, BY, BR, BRY)
  c.clip()
  if (outfit === 'none' && o.pattern === 'tuxedo') {
    ell(c, BX, BY + 4, 13, 17)
    c.fillStyle = '#fff8ee'
    c.fill()
  }
  if (outfit === 'suit') {
    c.beginPath()
    c.moveTo(BX - 7, BY - 22)
    c.lineTo(BX + 7, BY - 22)
    c.lineTo(BX, BY - 8)
    c.closePath()
    c.fillStyle = '#fff8ee'
    c.fill()
  }
  if (outfit === 'shirt') {
    for (const y of [BY - 10, BY, BY + 10]) {
      ell(c, BX, y, 1.4, 1.4)
      c.fillStyle = '#8a97a8'
      c.fill()
    }
  }
  if (outfit === 'hoodie') {
    c.beginPath()
    c.moveTo(BX - 5, BY - 18)
    c.lineTo(BX - 6, BY - 4)
    c.moveTo(BX + 5, BY - 18)
    c.lineTo(BX + 6, BY - 4)
    c.lineWidth = 2
    c.strokeStyle = '#f3ead6'
    c.stroke()
  }
  c.restore()
  const neck = HY + HRY + 1
  if (acc.includes('tie')) {
    c.beginPath()
    c.moveTo(BX - 3, neck)
    c.lineTo(BX + 3, neck)
    c.lineTo(BX + 2, neck + 3)
    c.lineTo(BX + 4, neck + 15)
    c.lineTo(BX, neck + 19)
    c.lineTo(BX - 4, neck + 15)
    c.lineTo(BX - 2, neck + 3)
    c.closePath()
    c.fillStyle = '#e8503f'
    c.fill()
  }
  if (acc.includes('bowtie')) {
    c.beginPath()
    c.moveTo(BX, neck + 3)
    c.lineTo(BX - 8, neck - 1)
    c.lineTo(BX - 8, neck + 7)
    c.closePath()
    c.moveTo(BX, neck + 3)
    c.lineTo(BX + 8, neck - 1)
    c.lineTo(BX + 8, neck + 7)
    c.closePath()
    c.fillStyle = '#e8503f'
    c.fill()
  }
  if (acc.includes('scarf')) {
    c.beginPath()
    c.moveTo(BX - BR, BY - 18)
    c.quadraticCurveTo(BX, BY - 8, BX + BR, BY - 18)
    c.quadraticCurveTo(BX, BY - 2, BX - BR, BY - 18)
    c.fillStyle = '#e8503f'
    c.fill()
  }
  if (acc.includes('necklace')) {
    c.beginPath()
    c.moveTo(BX - 12, neck - 1)
    c.quadraticCurveTo(BX, neck + 11, BX + 12, neck - 1)
    c.lineWidth = 2
    c.strokeStyle = '#c9972a'
    c.stroke()
    ell(c, BX, neck + 7, 3.2, 3.2)
    c.fillStyle = '#ffd16b'
    c.fill()
  }
  if (acc.includes('bell')) {
    c.beginPath()
    c.moveTo(BX - 14, neck - 1)
    c.quadraticCurveTo(BX, neck + 7, BX + 14, neck - 1)
    c.lineWidth = 3
    c.strokeStyle = '#e8503f'
    c.stroke()
    ell(c, BX, neck + 5, 3.5, 3.5)
    fs(c, '#ffd16b', 1.4)
  }
  // 귀 안쪽
  for (const sgn of [-1, 1] as const) {
    const ex = HX + sgn * 15
    const ey = HY - 17
    c.beginPath()
    c.moveTo(ex - sgn * 3, ey + 4)
    c.quadraticCurveTo(ex, ey - 5, ex + sgn * 3, ey - 5)
    c.quadraticCurveTo(ex + sgn * 5, ey, ex + sgn * 5, ey + 4)
    c.closePath()
    c.fillStyle = '#ffc4cc'
    c.fill()
  }
  // 머리 무늬
  c.save()
  ell(c, HX, HY, HR, HRY)
  c.clip()
  if (o.pattern === 'tabby') {
    c.lineWidth = 3.5
    c.strokeStyle = fur2
    c.lineCap = 'round'
    c.beginPath()
    for (const dx of [-7, 0, 7]) {
      c.moveTo(HX + dx, HY - 23)
      c.lineTo(HX + dx * 0.6, HY - 13)
    }
    c.stroke()
  }
  if (o.pattern === 'tuxedo') {
    ell(c, HX, HY + 10, 13, 10)
    c.fillStyle = '#fff8ee'
    c.fill()
    ell(c, HX - 2, HY - 9, 6, 7, 0.3)
    c.fillStyle = '#fff8ee'
    c.fill()
  }
  if (o.pattern === 'calico') {
    ell(c, HX - 13, HY - 15, 11, 8)
    c.fillStyle = fur2
    c.fill()
    ell(c, HX + 17, HY - 11, 8, 7)
    c.fillStyle = '#5a4336'
    c.fill()
  }
  if (o.pattern === 'point') {
    ell(c, HX, HY + 3, 15, 10)
    c.fillStyle = fur2
    c.fill()
  }
  c.restore()
  // 얼굴
  const EY = HY + 2
  const EX = 8.5
  for (const sgn of [-1, 1] as const) {
    ell(c, HX + sgn * 16, EY + 7, 4.5, 2.5)
    c.fillStyle = 'rgba(255,130,140,.4)'
    c.fill()
  }
  const dot = (x: number, y: number) => {
    ell(c, x, y, 2.1, 2.5)
    c.fillStyle = INK
    c.fill()
  }
  const brow = (sgn: 1 | -1) => {
    const x = HX + sgn * EX
    c.beginPath()
    c.moveTo(x - sgn * 4.5, EY - 4)
    c.lineTo(x + sgn * 3, EY - 6)
    c.lineWidth = 1.8
    c.strokeStyle = INK
    c.stroke()
  }
  const happyEye = (sgn: 1 | -1) => {
    const x = HX + sgn * EX
    c.beginPath()
    c.arc(x, EY + 1, 3, Math.PI * 1.1, Math.PI * 1.9)
    c.lineWidth = 1.8
    c.strokeStyle = INK
    c.stroke()
  }
  if (face === 'boss') {
    for (const sgn of [-1, 1] as const) {
      rrect(c, HX + sgn * EX - 6, EY - 4, 12, 7.5, 3.5)
      c.fillStyle = '#2a2a33'
      c.fill()
      c.beginPath()
      c.moveTo(HX + sgn * EX - 3, EY - 1.5)
      c.lineTo(HX + sgn * EX + 1.5, EY - 2.5)
      c.lineWidth = 1.2
      c.strokeStyle = 'rgba(255,255,255,.7)'
      c.stroke()
    }
    c.beginPath()
    c.moveTo(HX - 2.5, EY - 0.5)
    c.lineTo(HX + 2.5, EY - 0.5)
    c.lineWidth = 1.6
    c.strokeStyle = INK
    c.stroke()
  } else if (face === 'fire') {
    dot(HX - EX, EY)
    dot(HX + EX, EY)
    brow(-1)
    brow(1)
  } else if (face === 'hurt') {
    for (const sgn of [-1, 1] as const) {
      const x = HX + sgn * EX
      c.beginPath()
      c.moveTo(x - 3, EY - 3)
      c.lineTo(x + 3, EY + 3)
      c.moveTo(x + 3, EY - 3)
      c.lineTo(x - 3, EY + 3)
      c.lineWidth = 1.8
      c.strokeStyle = INK
      c.stroke()
    }
    ell(c, HX + 15, EY + 4, 1.6, 3.2)
    c.fillStyle = '#8ec5ef'
    c.fill()
  } else if (face === 'star') {
    for (const sgn of [-1, 1] as const) {
      const x = HX + sgn * EX
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 1.8 : 4.5
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        c.lineTo(x + Math.cos(a) * r, EY + Math.sin(a) * r)
      }
      c.closePath()
      c.fillStyle = '#f2b43a'
      c.fill()
    }
  } else if (face === 'sad') {
    for (const sgn of [-1, 1] as const) {
      happyEye(sgn)
    }
    ell(c, HX + 13, EY + 5, 1.5, 3)
    c.fillStyle = '#8ec5ef'
    c.fill()
  } else if (face === 'joy') {
    happyEye(-1)
    happyEye(1)
  } else if (face === 'sleep') {
    for (const sgn of [-1, 1] as const) {
      const x = HX + sgn * EX
      c.beginPath()
      c.arc(x, EY - 1.5, 3, Math.PI * 0.1, Math.PI * 0.9)
      c.lineWidth = 1.8
      c.strokeStyle = INK
      c.stroke()
    }
    c.fillStyle = INK
    c.font = 'bold 8px sans-serif'
    c.fillText('z', HX + 22, EY - 12)
  } else {
    dot(HX - EX, EY)
    dot(HX + EX, EY)
  }
  if (acc.includes('glasses')) {
    for (const sgn of [-1, 1] as const) {
      ell(c, HX + sgn * EX, EY + 0.5, 5.5, 5)
      c.lineWidth = 1.5
      c.strokeStyle = INK
      c.stroke()
    }
    c.beginPath()
    c.moveTo(HX - 3, EY)
    c.lineTo(HX + 3, EY)
    c.stroke()
  }
  // 코·입
  ell(c, HX, EY + 6, 1.6, 1.2)
  c.fillStyle = '#e88a95'
  c.fill()
  c.lineWidth = 1.4
  c.strokeStyle = INK
  if (face === 'hurt') {
    ell(c, HX, EY + 10.5, 2.4, 2)
    c.fillStyle = '#8a3b3b'
    c.fill()
  } else if (face === 'sad') {
    c.beginPath()
    c.arc(HX, EY + 11.5, 2.2, Math.PI * 1.15, Math.PI * 1.85)
    c.stroke()
  } else if (face === 'star' || face === 'boss' || face === 'joy') {
    c.beginPath()
    c.arc(HX, EY + 8, 2.6, 0.2, Math.PI - 0.2)
    c.stroke()
  } else {
    c.beginPath()
    c.arc(HX - 1.6, EY + 8.2, 1.6, 0, Math.PI)
    c.arc(HX + 1.6, EY + 8.2, 1.6, 0, Math.PI)
    c.stroke()
  }
  // 머리 소품
  if (acc.includes('ribbon')) {
    const bx = HX + 17
    const by = HY - 19
    c.beginPath()
    c.moveTo(bx, by)
    c.lineTo(bx - 7, by - 4.5)
    c.lineTo(bx - 6, by + 4.5)
    c.closePath()
    c.moveTo(bx, by)
    c.lineTo(bx + 7, by - 4.5)
    c.lineTo(bx + 6, by + 4.5)
    c.closePath()
    c.fillStyle = '#ff8fa8'
    c.fill()
    ell(c, bx, by, 2, 2)
    c.fillStyle = '#ffc2d0'
    c.fill()
  }
  if (acc.includes('crown')) {
    const cy = HY - HRY + 2
    c.beginPath()
    c.moveTo(HX - 9, cy + 6)
    c.lineTo(HX - 7, cy - 3)
    c.lineTo(HX - 3, cy + 2)
    c.lineTo(HX, cy - 6)
    c.lineTo(HX + 3, cy + 2)
    c.lineTo(HX + 7, cy - 3)
    c.lineTo(HX + 9, cy + 6)
    c.closePath()
    fs(c, '#ffd16b', 1.6)
  }
  if (acc.includes('headset')) {
    c.beginPath()
    c.arc(HX, HY - 1, 26, Math.PI * 1.12, Math.PI * 1.88)
    c.lineWidth = 2.5
    c.strokeStyle = INK
    c.stroke()
    ell(c, HX - 24, HY + 3, 3.2, 5)
    fs(c, '#6f7b8c', 1.5)
    c.beginPath()
    c.moveTo(HX - 24, HY + 8)
    c.quadraticCurveTo(HX - 24, HY + 18, HX - 12, HY + 16)
    c.lineWidth = 1.8
    c.strokeStyle = INK
    c.stroke()
  }
  if (acc.includes('visor')) {
    rrect(c, HX - 18, HY - 17, 36, 6, 3)
    fs(c, '#5cc8b8', 1.5)
  }
  if (acc.includes('cap')) {
    c.beginPath()
    c.arc(HX, HY - 12, 20, Math.PI, 0)
    c.closePath()
    fs(c, o.hatCol ?? '#e8503f', 1.8)
    rrect(c, HX - 4, HY - 14, 30, 5, 2.5)
    fs(c, o.hatCol ?? '#e8503f', 1.6)
  }
  if (acc.includes('beanie')) {
    c.beginPath()
    c.arc(HX, HY - 10, 21, Math.PI, 0)
    c.closePath()
    fs(c, o.hatCol ?? '#7bb7a0', 1.8)
    rrect(c, HX - 22, HY - 14, 44, 6, 3)
    fs(c, o.hatCol ?? '#7bb7a0', 1.6)
    ell(c, HX, HY - 32, 4, 4)
    fs(c, '#fff8ee', 1.5)
  }
  if (acc.includes('hardhat')) {
    c.beginPath()
    c.arc(HX, HY - 12, 20, Math.PI, 0)
    c.closePath()
    fs(c, '#ffd16b', 1.8)
    rrect(c, HX - 24, HY - 14, 48, 5, 2.5)
    fs(c, '#ffd16b', 1.6)
  }
  // 권총: 두 손으로, 몸 앞 가운데에서 겨눈다. 피벗(GUN_PIVOT)이 뒷손이다.
  if (o.gun) {
    c.save()
    c.translate(GUN_PIVOT.x, GUN_PIVOT.y)
    c.rotate(o.gunAngle ?? -0.85)
    drawGun(c, fur)
    c.restore()
  }
  c.restore()
}

export type GunKind = 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'rifle'
export type GunGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

/** 무기 F~S 등급색. 앱의 총·탄·명중도 같은 팔레트를 쓴다. */
export const GUN_GRADE_COLOR: Record<GunGrade, string> = {
  F: '#94a3b8',
  E: '#34d399',
  D: '#38bdf8',
  C: '#a78bfa',
  B: '#e879f9',
  A: '#fb923c',
  S: '#67e8f9',
}

/**
 * 무기와 그것을 쥔 두 앞발 (344·346번). 원점이 손잡이를 쥔 뒷발(피벗), +x가 총구 방향. 상자 좌표 -8..26 × -8..14 안에 든다.
 * 위로 겨눠도 총으로 읽히게: 긴 총신, 아래로 꺾인 손잡이, 방아쇠울, 가늠쇠. 앞발 하나는 손잡이, 하나는 총신 밑을 받친다.
 * 종류마다 실루엣이 다르다: 권총(기본), 리볼버(실린더), 기관단총(탄창·짧은 개머리), 산탄총(두 겹 총신·나무 펌프), 소총(긴 총신·조준경·나무 개머리).
 * 등급은 몸통색이고 전설은 반짝이까지.
 */
export function drawGun(c: Ctx, fur: string, kind: GunKind = 'pistol', grade: GunGrade = 'F') {
  const body = GUN_GRADE_COLOR[grade]
  const darkBody = dark(body, 0.75)
  const wood = '#a98464'
  c.save()
  c.lineJoin = 'round'
  c.lineCap = 'round'
  // 개머리(기관단총·소총): 피벗 뒤로
  if (kind === 'smg') {
    rrect(c, -8, -2.5, 7, 4.5, 1.5)
    fs(c, darkBody, 1.6)
  } else if (kind === 'rifle' || kind === 'shotgun') {
    c.beginPath()
    c.moveTo(-2, -2.5)
    c.lineTo(-8, 1)
    c.lineTo(-8, 7)
    c.lineTo(-2, 4)
    c.closePath()
    fs(c, wood, 1.6)
  }
  // 손잡이: 뒤로 꺾여 내려간다
  c.save()
  c.translate(1, 1.5)
  c.rotate(0.5)
  rrect(c, -3.2, 0, 6.4, kind === 'revolver' ? 12.5 : 11.5, 2.2)
  fs(c, kind === 'shotgun' || kind === 'rifle' ? wood : dark(body, 0.9), 1.8)
  c.restore()
  // 탄창(기관단총): 총신 아래로 곧게
  if (kind === 'smg') {
    rrect(c, 6, 2, 4.5, 10, 1.2)
    fs(c, darkBody, 1.5)
  }
  // 총신과 슬라이드
  const len = kind === 'smg' ? 18 : kind === 'revolver' ? 21 : 24
  if (kind === 'shotgun') {
    rrect(c, -3, -5.5, len, 4.5, 2)
    fs(c, body, 1.8)
    rrect(c, -3, -1.5, len, 4.5, 2)
    fs(c, body, 1.8)
    rrect(c, 9, -2.5, 7, 6, 1.5)
    fs(c, wood, 1.6)
  } else {
    rrect(c, -3, -4, len, kind === 'rifle' ? 5.5 : 7, 2.5)
    fs(c, body, 1.8)
    rrect(c, -1.5, -3, len - 5, 2.2, 1)
    c.fillStyle = 'rgba(255,255,255,.22)'
    c.fill()
  }
  // 리볼버 실린더
  if (kind === 'revolver') {
    rrect(c, 2, -5.5, 8, 9, 3)
    fs(c, darkBody, 1.6)
    ell(c, 6, -1, 1.6, 1.6)
    c.fillStyle = INK
    c.fill()
  }
  // 조준경(소총)
  if (kind === 'rifle') {
    rrect(c, 5, -8.5, 9, 3.6, 1.6)
    fs(c, darkBody, 1.4)
    ell(c, 14.2, -6.7, 1.3, 1.6)
    c.fillStyle = '#8ec5ef'
    c.fill()
  }
  // 총구와 가늠쇠
  rrect(c, len - 5, kind === 'shotgun' ? -4.5 : -3, 6, kind === 'shotgun' ? 8 : 5, 1.8)
  fs(c, darkBody, 1.6)
  if (kind !== 'rifle' && kind !== 'shotgun') {
    rrect(c, len - 6.5, -6.2, 2.2, 2.6, 0.8)
    fs(c, darkBody, 1.2)
  }
  // 방아쇠울
  c.beginPath()
  c.arc(kind === 'smg' ? 4 : 7.5, 4.5, 3.2, 0.1, Math.PI - 0.1)
  c.lineWidth = 1.8
  c.strokeStyle = INK
  c.stroke()
  // 전설: 반짝이 둘
  if (grade === 'S') {
    for (const [sx, sy, r] of [
      [len - 2, -7.5, 2.2],
      [3, -7, 1.5],
    ]) {
      c.beginPath()
      for (let i = 0; i < 8; i++) {
        const rr = i % 2 ? r * 0.4 : r
        const a = (i * Math.PI) / 4
        c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr)
      }
      c.closePath()
      c.fillStyle = '#fff3b0'
      c.fill()
    }
  }
  // 앞발: 손잡이를 쥔 뒷발, 총신 밑을 받친 앞발
  for (const [px, py] of [
    [0.5, 7.5],
    [kind === 'smg' ? 13 : 11.5, 4.5],
  ]) {
    ell(c, px, py, 4.8, 4.2)
    c.fillStyle = INK
    c.fill()
    ell(c, px, py, 3.5, 2.9)
    c.fillStyle = fur
    c.fill()
  }
  c.restore()
}

/** 권총 피벗(총을 든 손, 상자 좌표). 전투에서 총구 화염·탄의 출발점을 잡는 데 쓴다. */
export const GUN_PIVOT = { x: 75, y: 76 }
/** 피벗에서 총구까지의 길이(상자 좌표). */
export const GUN_LEN = 25

/** 적 넷. 중심 (0,0), 반지름 ≈ 20. 같은 윤곽 규칙으로 단순하게: 이름이 곧 생김새다. */
export type EnemyShape = 'panic' | 'dump' | 'spec' | 'stop'

/**
 * 패닉셀: 파란 동그라미, 걱정 눈썹에 점 눈, 작은 벌린 입, 땀 한 방울, 두 팔 올림.
 * 투매: 종이 더미에 점 눈 둘과 발. 투기: 분홍 풍선, 별눈, 작은 웃음. 손절매: 회색 동그라미, 머리에 가위 날 둘, 무표정.
 * t는 흔들림용 시각(초). frame 둘을 번갈아 보일 때는 t를 0·0.25로 준다.
 */
export function drawEnemy(c: Ctx, kind: EnemyShape, t: number) {
  c.save()
  c.lineJoin = 'round'
  c.lineCap = 'round'
  const wob = Math.sin(t * 12) * 1.2
  const bob = Math.sin(t * 8) * 1
  ell(c, 0, 18, 13, 4)
  c.fillStyle = 'rgba(74,53,40,.16)'
  c.fill()
  const dot = (x: number, y: number) => {
    ell(c, x, y, 1.9, 2.2)
    c.fillStyle = INK
    c.fill()
  }
  const union = (parts: (() => void)[], col: string) => {
    for (const d of parts) {
      d()
      c.fillStyle = INK
      c.fill()
      c.lineWidth = 5.6
      c.strokeStyle = INK
      c.stroke()
    }
    for (const d of parts) {
      d()
      c.fillStyle = col
      c.fill()
    }
  }
  if (kind === 'panic') {
    union(
      [
        () => ell(c, -15, -5 + wob, 3.5, 7.5, -0.5),
        () => ell(c, 15, -5 - wob, 3.5, 7.5, 0.5),
        () => ell(c, 0, 2 + bob, 15, 14),
        () => ell(c, -6, 15, 4, 3),
        () => ell(c, 6, 15, 4, 3),
      ],
      '#aacbf2',
    )
    dot(-5, bob)
    dot(5, bob)
    c.beginPath()
    c.moveTo(-9, -8 + bob)
    c.lineTo(-2.5, -5.5 + bob)
    c.moveTo(9, -8 + bob)
    c.lineTo(2.5, -5.5 + bob)
    c.lineWidth = 1.6
    c.strokeStyle = INK
    c.stroke()
    ell(c, 0, 6.5 + bob, 2.4, 2.8)
    c.fillStyle = '#8a3b3b'
    c.fill()
    ell(c, 13, -11 - ((t * 30) % 7), 1.5, 2.6)
    c.fillStyle = '#8ec5ef'
    c.fill()
  } else if (kind === 'dump') {
    union(
      [
        () => rrect(c, -14, -11, 28, 11, 3),
        () => rrect(c, -12, -4, 28, 11, 3),
        () => rrect(c, -14, 3, 28, 11, 3),
        () => ell(c, -6, 15, 4, 3),
        () => ell(c, 6, 15, 4, 3),
      ],
      '#fff4e0',
    )
    c.beginPath()
    c.moveTo(-12, -4)
    c.lineTo(14, -4)
    c.moveTo(-14, 3)
    c.lineTo(12, 3)
    c.lineWidth = 1.2
    c.strokeStyle = '#e0c5a8'
    c.stroke()
    dot(-5, -6)
    dot(2, -6)
    c.beginPath()
    c.arc(-1.5, -2, 1.6, 0.2, Math.PI - 0.2)
    c.lineWidth = 1.3
    c.strokeStyle = INK
    c.stroke()
  } else if (kind === 'spec') {
    const inf = 1 + Math.sin(t * 2.4) * 0.07
    union(
      [
        () => ell(c, 0, 0, 16 * inf, 17 * inf),
        () => tri(c, [-2.5, 16 * inf], [2.5, 16 * inf], [0, 20 * inf]),
      ],
      '#f6aabd',
    )
    ell(c, -6, -8, 3.2, 4.5, 0.6)
    c.fillStyle = 'rgba(255,255,255,.5)'
    c.fill()
    c.beginPath()
    c.moveTo(0, 19 * inf)
    c.quadraticCurveTo(2.5, 24, 0, 28)
    c.lineWidth = 1.4
    c.strokeStyle = INK
    c.stroke()
    for (const s of [-1, 1]) {
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 1.8 : 4.6
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        c.lineTo(s * 5.5 + Math.cos(a) * r, -1.5 + Math.sin(a) * r)
      }
      c.closePath()
      c.fillStyle = '#f2b43a'
      c.fill()
    }
    c.beginPath()
    c.arc(0, 5, 2.6, 0.2, Math.PI - 0.2)
    c.lineWidth = 1.4
    c.strokeStyle = INK
    c.stroke()
  } else {
    union(
      [
        () => tri(c, [-10, -8 + bob], [-9, -24 + bob], [-2, -9 + bob]),
        () => tri(c, [10, -8 + bob], [9, -24 + bob], [2, -9 + bob]),
        () => ell(c, 0, 3 + bob * 0.5, 15, 14),
        () => ell(c, -6, 16, 4, 3),
        () => ell(c, 6, 16, 4, 3),
      ],
      '#c3c1cc',
    )
    tri(c, [-9, -11 + bob], [-8.5, -21 + bob], [-3.5, -11 + bob])
    c.fillStyle = '#e6e9ef'
    c.fill()
    tri(c, [9, -11 + bob], [8.5, -21 + bob], [3.5, -11 + bob])
    c.fill()
    dot(-5, 1 + bob * 0.5)
    dot(5, 1 + bob * 0.5)
    c.beginPath()
    c.moveTo(-3, 8 + bob * 0.5)
    c.lineTo(3, 8 + bob * 0.5)
    c.lineWidth = 1.4
    c.strokeStyle = INK
    c.stroke()
  }
  c.restore()
}

/** 고양이를 새 캔버스에 굽는다. scale 1이면 100×110px. 화면 배율(dpr)은 호출하는 쪽이 곱한다. */
export function bakeCat(look: CatLook, scale: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(CAT_W * scale)
  cv.height = Math.ceil(CAT_H * scale)
  const c = cv.getContext('2d')
  if (c) {
    c.scale(scale, scale)
    drawCat(c, look)
  }
  return cv
}
