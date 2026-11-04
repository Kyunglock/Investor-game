import { useRef, useState } from 'react'
import { api, type Game } from '../../api/client'
import { Card } from './Card'
import { kakao } from './kakao'
import {
  canvasPng,
  downloadCanvas,
  drawShareImage,
  type ImageShape,
  kakaoFeed,
  type ShareCard,
  shareLink,
  shareText,
} from './share'

interface Shared {
  shareId: string
  card: ShareCard
  /** 요약 그림을 서버에 올렸는가. 못 올렸으면 공통 그림을 쓴다. */
  uploaded: boolean
}

const BUTTON =
  'min-h-10 rounded border border-line bg-card px-3 text-[13px] font-semibold text-ink hover:border-wine hover:text-wine disabled:opacity-50'

/**
 * 결과 공유 (#197, 카카오톡만 #275). 처음 누를 때 서버에 공유 ID를 만들고(공유를 누른 판만 공개된다) 1:1 요약 그림을 그려 올린다.
 * 카카오 키가 있으면 카카오톡 카드로, 없으면 휴대폰 공유창(카카오톡 고르기)이나 링크 복사로 보낸다. 결과 카드는 9:16·1:1 그림으로도
 * 저장할 수 있다. focus가 type이면 투자 성향만 공유한다("나는 ○○형 투자자").
 */
export function SharePanel({ game, focus = 'life' }: { game: Game; focus?: 'life' | 'type' }) {
  const [shared, setShared] = useState<Shared | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  const upload = async (shareId: string, card: ShareCard): Promise<boolean> => {
    if (!canvas.current) {
      return false
    }
    try {
      await document.fonts?.ready
      drawShareImage(canvas.current, card, 'square', shareLink(shareId))
      const png = await canvasPng(canvas.current)
      if (!png) {
        return false
      }
      const { response } = await api.PUT('/api/games/{gameId}/share/image', {
        params: { path: { gameId: game.gameId } },
        body: png as unknown as string,
        bodySerializer: (body) => body as unknown as BodyInit,
        headers: { 'Content-Type': 'image/png' },
      })
      return response.ok
    } catch {
      return false
    }
  }

  const ensure = async (): Promise<Shared | null> => {
    if (shared) {
      return shared
    }
    setBusy(true)
    const { data } = await api.POST('/api/games/{gameId}/share', {
      params: { path: { gameId: game.gameId } },
    })
    if (!data) {
      setBusy(false)
      setMessage('공유 링크를 만들지 못했습니다.')
      return null
    }
    const uploaded = await upload(data.shareId, data.card)
    setBusy(false)
    const next = { ...data, uploaded }
    setShared(next)
    return next
  }

  const copy = async (text: string, done = '링크를 복사했습니다.') => {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(done)
    } catch {
      setMessage(text)
    }
  }

  const toKakao = async () => {
    const [s, sdk] = await Promise.all([ensure(), kakao()])
    if (!s) {
      return
    }
    if (sdk) {
      try {
        sdk.Share.sendDefault(kakaoFeed(s.card, s.shareId, focus, s.uploaded))
        return
      } catch {
        // SDK가 거절하면(도메인 미등록 등) 아래 방법으로 보낸다.
      }
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
    await copy(`${text} ${url}`, '링크를 복사했습니다. 카카오톡 대화창에 붙여 넣으세요.')
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
          className={`${BUTTON} border-[#FEE500] bg-[#FEE500] text-[#191919] hover:border-[#191919] hover:text-[#191919]`}
          disabled={busy}
          onClick={() => void toKakao()}
          data-testid="share-kakao"
        >
          카카오톡으로 공유
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
