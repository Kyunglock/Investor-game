/**
 * 결과 공유 (#197, 카카오톡 #275): 공유 문구·링크·결과 카드 이미지·카카오톡 카드. 서버가 공유 ID를 만들고(POST /share), 링크는 /r/{id}다.
 * /r/{id}는 링크 미리보기(Open Graph)를 담은 서버 HTML이고, 사람은 화면의 /share/{id}로 넘어간다.
 */
import type { components } from '../../api/schema'
import { percent, shortWon } from './labels'
import { ADORNMENTS } from './pixel/adornments'
import { bodyFor } from './pixel/bodies'
import { layersFor } from './pixel/layers'
import { MARKS } from './pixel/marks'
import { CHARACTER_PALETTE } from './pixel/palette'
import { CHAR_HEIGHT, CHAR_WIDTH, compose, type Layer } from './pixel/sprite'

export type ShareCard = components['schemas']['ShareCard']

const ENDING: Record<ShareCard['ending'], string> = {
  NORMAL: '은퇴',
  BANKRUPT: '파산',
  QUIT: '중단',
}

const HOME: Record<string, string> = {
  PARENTS: '부모님 집',
  MONTHLY: '월세',
  VILLA_JEONSE: '빌라 전세',
  APT_JEONSE: '아파트 전세',
  OWN: '내 집',
}

export function shareLink(shareId: string, origin = window.location.origin): string {
  return `${origin}/r/${shareId}`
}

export function displayName(card: ShareCard): string {
  return card.name?.trim() ? card.name : '어느 투자자'
}

/** "70세 은퇴 · 최종 자산 12억 3,400만 원" */
export function headline(card: ShareCard): string {
  return `${card.finalAge}세 ${ENDING[card.ending]} · 최종 자산 ${shortWon(card.finalAsset)}`
}

/** "개발자 · 결혼 · 아이 둘 · 내 집" */
export function lifeLine(card: ShareCard): string {
  const parts = [card.jobTitle ?? '무직']
  parts.push(card.married ? '결혼' : '미혼')
  if (card.children > 0) {
    parts.push(`아이 ${card.children}명`)
  }
  parts.push(HOME[card.home] ?? card.home)
  return parts.join(' · ')
}

/** 공유할 때 붙는 글. focus가 type이면 성향 보고서만 ("나는 ○○형 투자자"). */
export function shareText(card: ShareCard, focus: 'life' | 'type' = 'life'): string {
  if (focus === 'type' && card.investorTypeName) {
    return `나는 '${card.investorTypeName}' 투자자. ${card.investorTypeDescription ?? ''} 너는 어떤 투자자야?`.trim()
  }
  const rank = card.rank ? ` (순위표 ${card.rank}위)` : ''
  const type = card.investorTypeName ? ` '${card.investorTypeName}' 투자자로 살았다.` : ''
  return `${displayName(card)}의 인생: ${headline(card)}${rank}.${type} 나도 한 번 살아 보기`
}

/** "시작 0원 → 최종 12억 3,400만원 · 수익률 +12.3%". 시작 자산이 0이면 수익률은 뺀다. */
export function moneyLine(card: ShareCard): string {
  const base = `시작 ${shortWon(card.initialAsset)} → 최종 ${shortWon(card.finalAsset)}`
  return card.initialAsset > 0
    ? `${base} · 수익률 ${card.returnBp > 0 ? '+' : ''}${percent(card.returnBp)}`
    : base
}

/** 요약 그림 주소. 올리지 못했으면 공통 그림. */
export function shareImageUrl(shareId: string, uploaded: boolean, origin = window.location.origin) {
  return uploaded ? `${origin}/api/shares/${shareId}/card.png` : `${origin}/og-card.png`
}

/** 카카오톡 피드 카드 (#275). 그림을 누르거나 "결과 보기"는 공유 페이지로, "나도 해 보기"는 첫 화면으로. */
export function kakaoFeed(
  card: ShareCard,
  shareId: string,
  focus: 'life' | 'type',
  uploaded: boolean,
  origin = window.location.origin,
) {
  const page = `${origin}/share/${shareId}`
  const title =
    focus === 'type' && card.investorTypeName
      ? `나는 '${card.investorTypeName}' 투자자`
      : `${displayName(card)}의 인생 · ${headline(card)}`
  const parts = [
    card.investorTypeName && focus === 'life' ? `'${card.investorTypeName}' 투자자` : null,
    focus === 'type' ? (card.investorTypeDescription ?? null) : lifeLine(card),
  ].filter((p): p is string => !!p)
  return {
    objectType: 'feed' as const,
    content: {
      title,
      description: parts.join(' · '),
      imageUrl: shareImageUrl(shareId, uploaded, origin),
      imageWidth: 1080,
      imageHeight: 1080,
      link: { mobileWebUrl: page, webUrl: page },
    },
    buttons: [
      { title: '결과 보기', link: { mobileWebUrl: page, webUrl: page } },
      { title: '나도 해 보기', link: { mobileWebUrl: origin, webUrl: origin } },
    ],
  }
}

/** 캔버스를 PNG 바이트로. */
export function canvasPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** 이미지 비율: 인스타 스토리(9:16)와 정사각형(1:1) */
export type ImageShape = 'story' | 'square'

export const IMAGE_SIZE: Record<ImageShape, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

/** 캐릭터 도트 그림의 칸 목록(끝날 때 나이·능력치로). 캔버스·테스트가 같이 쓴다. */
export function characterGrid(card: ShareCard): string[][] {
  const spec = layersFor(card.initialStats, card.finalStats, card.finalAge, card.sex)
  const layers: Layer[] = []
  if (spec.adornment) {
    layers.push(ADORNMENTS[spec.adornment])
  }
  if (spec.mark) {
    layers.push(MARKS[spec.mark])
  }
  return compose(bodyFor(spec.sex, spec.stage), layers)
}

const COLORS = {
  paper: '#fdfdfb',
  ink: '#1f2226',
  muted: '#5f6670',
  faint: '#9aa1aa',
  wine: '#8b2342',
  wineSoft: '#f7e6ea',
  line: '#d9dcdf',
}

const SANS = '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif'
const SERIF = '"Noto Serif KR", "Apple SD Gothic Neo", serif'

/** 결과 카드를 캔버스에 그린다. 글꼴은 화면에 이미 올라온 것을 쓴다. */
export function drawShareImage(
  canvas: HTMLCanvasElement,
  card: ShareCard,
  shape: ImageShape,
  link: string,
) {
  const { width, height } = IMAGE_SIZE[shape]
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  const story = shape === 'story'
  ctx.fillStyle = COLORS.paper
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = COLORS.wine
  ctx.fillRect(0, 0, width, 16)
  ctx.fillRect(0, height - 16, width, 16)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  let y = story ? 170 : 110
  ctx.fillStyle = COLORS.faint
  ctx.font = `600 34px ${SANS}`
  ctx.fillText('투자자 시뮬레이터 · 인생 결과', width / 2, y)

  // 캐릭터: 32×40 칸을 정수 배율로 크게
  const scale = story ? 16 : 9
  const grid = characterGrid(card)
  const left = Math.round((width - CHAR_WIDTH * scale) / 2)
  const top = y + (story ? 60 : 30)
  grid.forEach((row, gy) => {
    row.forEach((ch, gx) => {
      const color = CHARACTER_PALETTE[ch]
      if (color) {
        ctx.fillStyle = color
        ctx.fillRect(left + gx * scale, top + gy * scale, scale, scale)
      }
    })
  })
  y = top + CHAR_HEIGHT * scale + (story ? 110 : 70)

  ctx.fillStyle = COLORS.ink
  ctx.font = `900 ${story ? 96 : 72}px ${SERIF}`
  ctx.fillText(displayName(card), width / 2, y)
  y += story ? 90 : 70
  ctx.fillStyle = card.finalAsset < 0 ? COLORS.wine : COLORS.ink
  ctx.font = `700 ${story ? 52 : 44}px ${SANS}`
  ctx.fillText(headline(card), width / 2, y)
  if (card.rank) {
    y += story ? 70 : 56
    ctx.fillStyle = COLORS.wine
    ctx.font = `700 40px ${SANS}`
    ctx.fillText(`순위표 ${card.rank}위`, width / 2, y)
  }

  if (card.investorTypeName) {
    y += story ? 130 : 80
    const boxHeight = story ? 260 : 150
    ctx.fillStyle = COLORS.wineSoft
    ctx.fillRect(80, y - (story ? 80 : 60), width - 160, boxHeight)
    ctx.fillStyle = COLORS.wine
    ctx.font = `900 ${story ? 64 : 52}px ${SERIF}`
    ctx.fillText(`'${card.investorTypeName}' 투자자`, width / 2, y)
    if (story && card.investorTypeDescription) {
      ctx.fillStyle = COLORS.muted
      ctx.font = `400 36px ${SANS}`
      wrap(ctx, card.investorTypeDescription, width / 2, y + 70, width - 220, 50, 2)
    }
    y += boxHeight - (story ? 40 : 30)
  }

  y += story ? 90 : 40
  ctx.fillStyle = COLORS.muted
  ctx.font = `400 ${story ? 40 : 34}px ${SANS}`
  ctx.fillText(lifeLine(card), width / 2, y)

  ctx.fillStyle = COLORS.wine
  ctx.font = `700 ${story ? 44 : 36}px ${SANS}`
  ctx.fillText('나도 한 번 살아 보기', width / 2, height - (story ? 170 : 100))
  ctx.fillStyle = COLORS.faint
  ctx.font = `400 30px ${SANS}`
  ctx.fillText(link.replace(/^https?:\/\//, ''), width / 2, height - (story ? 115 : 55))
}

/** 가운데 정렬로 줄을 나눠 쓴다(글자 단위, 한국어). */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  let line = ''
  let lines = 0
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight)
      lines++
      line = ''
      if (lines >= maxLines) {
        return
      }
    }
    line += ch
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y + lines * lineHeight)
  }
}

/** 캔버스를 PNG 파일로 내려받는다. */
export function downloadCanvas(canvas: HTMLCanvasElement, fileName: string) {
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = fileName
  a.click()
}
