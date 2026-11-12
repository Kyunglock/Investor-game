/**
 * 안드로이드 앱의 아이콘·시작 화면 원본 그림을 만든다 (decisions.md 306번, docs/app.md). 승인한 매도벽 돌파 고양이 원본을 그대로 쓴다.
 * 결과는 `assets/`에 PNG로 남고, `pnpm assets`가 이어서 @capacitor/assets로 android/app/src/main/res의 크기별 그림을 만든다.
 * 그림은 Playwright의 크로미움으로 그린다: 글꼴은 웹과 같은 Noto Serif KR 900.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
const fontUrl = `data:font/woff2;base64,${readFileSync(resolve(fontDir, fontFile)).toString('base64')}`

const INK = '#ff571c'
const artwork = readFileSync(resolve(out, 'source/wall-breaker.png')).toString('base64')

/** 승인 원본의 비율과 구도를 그대로 유지한다. */
function mark(size: number): string {
  return `<img src="data:image/png;base64,${artwork}" width="${size}" height="${size}" alt="매도벽을 돌파하는 고양이" style="display:block;object-fit:contain"/>`
}

function page(size: number, background: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: 'Noto Serif KR'; font-weight: 900; src: url('${fontUrl}') format('woff2'); }
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: ${background}; overflow: hidden; }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${size * 0.05}px; }
    .title { font-family: 'Noto Serif KR', serif; font-weight: 900; color: #44230e; letter-spacing: 0.08em; }
    .sub { font-family: 'Noto Serif KR', serif; font-weight: 900; color: #825634; letter-spacing: 0.3em; }
    .tile { border-radius: 22%; background: ${INK}; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  </style></head><body>${body}</body></html>`
}

const images: Record<string, { size: number; background: string; body: string }> = {
  // 꽉 찬 정사각 원본. 런처별 둥근 모서리와 마스크는 안드로이드가 적용한다.
  'icon-only.png': {
    size: 1024,
    background: INK,
    body: `<div class="center">${mark(1024)}</div>`,
  },
  // adaptive icon 앞면. 리소스 생성기가 안전 영역 여백을 적용한다.
  'icon-foreground.png': {
    size: 1024,
    background: 'transparent',
    body: `<div class="center">${mark(1024)}</div>`,
  },
  'icon-background.png': { size: 1024, background: INK, body: '' },
  // 시작 화면: 따뜻한 크림색 바탕에 승인 아이콘과 제목.
  'splash.png': {
    size: 2732,
    background: '#fff3df',
    body: `<div class="center"><div class="tile" style="width:720px;height:720px">${mark(720)}</div><div class="title" style="font-size:120px">흔들리지 않는 고양이</div><div class="sub" style="font-size:58px">멘탈을 지키는 투자 게임</div></div>`,
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
    await tab.setContent(page(size, background, body))
    await tab.evaluate(() => Promise.all(Array.from(document.images, (img) => img.decode())))
    // 글꼴이 다 실릴 때까지 기다린다(문자열로 넘겨 node 쪽 타입 검사에 DOM이 필요 없게).
    await tab.evaluate('document.fonts.ready')
    const png = await tab.screenshot({ omitBackground: background === 'transparent', type: 'png' })
    writeFileSync(resolve(out, name), png)
    await tab.close()
    console.log(`${name} ${size}x${size}`)
  }
  const icon = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 1 })
  await icon.setContent(page(64, INK, mark(64)))
  await icon.evaluate(() => Promise.all(Array.from(document.images, (img) => img.decode())))
  await icon.screenshot({ path: resolve(root, 'public/favicon.png') })
  await icon.close()
} finally {
  await browser.close()
}
