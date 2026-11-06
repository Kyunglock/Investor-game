/**
 * 안드로이드 앱의 아이콘·시작 화면 원본 그림을 만든다 (decisions.md 306번, docs/app.md). favicon.svg의 꺾은선 표지를 그대로 쓴다.
 * 결과는 `assets/`에 PNG로 남고, `pnpm app:assets`가 이어서 @capacitor/assets로 android/app/src/main/res의 크기별 그림을 만든다.
 * 그림은 Playwright의 크로미움으로 그린다: 글꼴은 웹과 같은 Noto Serif KR 900.
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const out = resolve(root, 'assets')
mkdirSync(out, { recursive: true })

const fontDir = resolve(root, 'node_modules/@fontsource/noto-serif-kr/files')
const fontFile = readdirSync(fontDir).find((f) => /korean-900-normal\.woff2$/.test(f))
if (!fontFile) {
  throw new Error('Noto Serif KR 900 글꼴 파일이 없다. pnpm install을 먼저 한다')
}
const fontUrl = `file://${resolve(fontDir, fontFile)}`

const INK = '#14161a'
const LINE = '#4f8cff'
const DOT = '#ff5c5c'

/** favicon.svg와 같은 꺾은선 표지. size 안에 꽉 차게 그린다(viewBox 64). */
function mark(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <polyline points="10,46 24,32 34,40 54,18" fill="none" stroke="${LINE}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="54" cy="18" r="5" fill="${DOT}"/></svg>`
}

function page(size: number, background: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Noto Serif KR'; font-weight: 900; src: url('${fontUrl}') format('woff2'); }
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${background}; overflow: hidden; }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${size * 0.05}px; }
    .title { font-family: 'Noto Serif KR', serif; font-weight: 900; color: #f3f4f3; letter-spacing: 0.08em; }
    .sub { font-family: 'Noto Serif KR', serif; font-weight: 900; color: #9aa3ad; letter-spacing: 0.3em; }
    .tile { border-radius: 22%; background: ${INK}; display: flex; align-items: center; justify-content: center; }
  </style></head><body>${body}</body></html>`
}

const images: Record<string, { size: number; background: string; body: string }> = {
  // 둥근 네모 안의 표지. 옛 런처(adaptive icon을 모르는 기기)와 스토어 그림용.
  'icon-only.png': {
    size: 1024,
    background: 'transparent',
    body: `<div class="center"><div class="tile" style="width:1024px;height:1024px">${mark(1024)}</div></div>`,
  },
  // adaptive icon의 앞면: 가운데 66%만 보이므로 표지를 그 안에 둔다. 배경은 투명.
  'icon-foreground.png': {
    size: 1024,
    background: 'transparent',
    body: `<div class="center">${mark(620)}</div>`,
  },
  'icon-background.png': { size: 1024, background: INK, body: '' },
  // 시작 화면: 어두운 바탕 가운데 표지와 제목.
  'splash.png': {
    size: 2732,
    background: INK,
    body: `<div class="center">${mark(560)}<div class="title" style="font-size:200px">증권사 사장</div><div class="sub" style="font-size:72px">증권사 육성 게임</div></div>`,
  },
}
images['splash-dark.png'] = images['splash.png']

// 크로미움이 다른 자리에 깔려 있으면(CI·컨테이너) CHROMIUM_PATH로 알려 준다.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  for (const [name, { size, background, body }] of Object.entries(images)) {
    const tab = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    })
    const html = resolve(out, `.${name}.html`)
    writeFileSync(html, page(size, background, body))
    await tab.goto(`file://${html}`)
    // 글꼴이 다 실릴 때까지 기다린다(문자열로 넘겨 node 쪽 타입 검사에 DOM이 필요 없게).
    await tab.evaluate('document.fonts.ready')
    const png = await tab.screenshot({ omitBackground: background === 'transparent', type: 'png' })
    writeFileSync(resolve(out, name), png)
    await tab.close()
    console.log(`${name} ${size}x${size}`)
  }
} finally {
  await browser.close()
}
