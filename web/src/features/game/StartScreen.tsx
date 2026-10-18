import { Document } from './Document'
import { STAT_KEYS } from './labels'
import { Sprite } from './pixel/SpriteView'

/** 시작 전 화면 (설계 5.8절). 강점 5종 캐릭터를 미리 보여 준다. */
export function StartScreen({ onBorn }: { onBorn: () => void }) {
  return (
    <Document title="투자자 시뮬레이터">
      <h2 className="font-serif-kr text-[32px] font-black leading-tight">새로운 인생</h2>
      <p className="mt-2 text-[13px] text-muted">
        능력치와 초기 자산은 태어날 때 정해집니다.
        <br />
        선택은 당신이 하지만, 실행은 당신의 성격이 합니다.
      </p>
      <div className="mt-5 flex justify-center gap-2 border-y border-line-soft py-4">
        {STAT_KEYS.map((key) => (
          <Sprite key={key} spec={{ stage: 'adult', adornment: key, mark: null }} size={48} />
        ))}
      </div>
      <button
        type="button"
        className="mt-5 min-h-12 w-full rounded bg-wine font-semibold text-white hover:opacity-90"
        onClick={onBorn}
      >
        태어나기
      </button>
    </Document>
  )
}
