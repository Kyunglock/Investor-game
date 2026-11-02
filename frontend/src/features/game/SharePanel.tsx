import { useRef, useState } from 'react'
import { api, type Game } from '../../api/client'
import { Card } from './Card'
import {
  downloadCanvas,
  drawShareImage,
  facebookShareUrl,
  type ImageShape,
  type ShareCard,
  shareLink,
  shareText,
  xShareUrl,
} from './share'

interface Shared {
  shareId: string
  card: ShareCard
}

const BUTTON =
  'min-h-10 rounded border border-line bg-card px-3 text-[13px] font-semibold text-ink hover:border-wine hover:text-wine disabled:opacity-50'

/**
 * 결과 공유 (#197). 처음 누를 때 서버에 공유 ID를 만든다(공유를 누른 판만 공개된다). 모바일은 시스템 공유 시트로, 데스크톱은 X·페이스북·링크 복사로
 * 보낸다. 결과 카드는 9:16·1:1 그림으로 저장할 수 있다. focus가 type이면 투자 성향만 공유한다("나는 ○○형 투자자").
 */
export function SharePanel({ game, focus = 'life' }: { game: Game; focus?: 'life' | 'type' }) {
  const [shared, setShared] = useState<Shared | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  const ensure = async (): Promise<Shared | null> => {
    if (shared) {
      return shared
    }
    setBusy(true)
    const { data } = await api.POST('/api/games/{gameId}/share', {
      params: { path: { gameId: game.gameId } },
    })
    setBusy(false)
    if (!data) {
      setMessage('공유 링크를 만들지 못했습니다.')
      return null
    }
    setShared(data)
    return data
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage('링크를 복사했습니다.')
    } catch {
      setMessage(text)
    }
  }

  const native = async () => {
    const s = await ensure()
    if (!s) {
      return
    }
    const url = shareLink(s.shareId)
    const text = shareText(s.card, focus)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '투자자 시뮬레이터', text, url })
      } catch {
        // 공유 시트를 닫으면 아무것도 하지 않는다.
      }
      return
    }
    await copy(`${text} ${url}`)
  }

  const open = async (to: 'x' | 'facebook') => {
    // 팝업 차단을 피하려고 창을 먼저 열고, 링크가 생기면 주소를 넣는다.
    const win = window.open('', '_blank', 'noopener=no')
    const s = await ensure()
    if (!s || !win) {
      win?.close()
      return
    }
    const url = shareLink(s.shareId)
    win.location.href =
      to === 'x' ? xShareUrl(shareText(s.card, focus), url) : facebookShareUrl(url)
  }

  const save = async (shape: ImageShape) => {
    const s = await ensure()
    if (!s || !canvas.current) {
      return
    }
    await document.fonts?.ready
    drawShareImage(canvas.current, s.card, shape, shareLink(s.shareId))
    downloadCanvas(canvas.current, `investor-life-${shape === 'story' ? '9x16' : '1x1'}.png`)
  }

  return (
    <Card
      title={focus === 'type' ? '내 투자 성향 공유' : '결과 공유하기'}
      testId={`share-${focus}`}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${BUTTON} border-wine bg-wine text-white hover:text-white`}
          disabled={busy}
          onClick={() => void native()}
          data-testid="share-native"
        >
          공유하기
        </button>
        <button type="button" className={BUTTON} disabled={busy} onClick={() => void open('x')}>
          X
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={busy}
          onClick={() => void open('facebook')}
        >
          페이스북
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={busy}
          onClick={() => void ensure().then((s) => (s ? copy(shareLink(s.shareId)) : undefined))}
          data-testid="share-copy"
        >
          링크 복사
        </button>
        {focus === 'life' && (
          <>
            <button
              type="button"
              className={BUTTON}
              disabled={busy}
              onClick={() => void save('story')}
            >
              이미지 저장 9:16
            </button>
            <button
              type="button"
              className={BUTTON}
              disabled={busy}
              onClick={() => void save('square')}
            >
              1:1
            </button>
          </>
        )}
      </div>
      {message && (
        <p
          className="mt-2 break-all text-[12px] text-muted"
          role="status"
          data-testid="share-message"
        >
          {message}
        </p>
      )}
      <canvas ref={canvas} className="hidden" />
    </Card>
  )
}
