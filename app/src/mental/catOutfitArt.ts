import type { CatCode } from '@web/features/raising/store'

type Outfit = { cloth: string; trim: string; emblem: string }

// 등 쪽에서 보이는 망토와 문장. SS 극광냥의 제복은 아홉 자세 원본에 포함돼 있다.
const outfits: Partial<Record<CatCode, Outfit>> = {
  star: {
    cloth: '#243773',
    trim: '#f9cd67',
    emblem: 'M0 -5 Q1 -1 5 0 Q1 1 0 5 Q-1 1 -5 0 Q-1 -1 0 -5Z',
  },
  silver: { cloth: '#414454', trim: '#e0c188', emblem: 'M-5 -4 L5 -4 L4 1 L0 5 L-4 1Z' },
  wisteria: {
    cloth: '#735392',
    trim: '#f2c0ef',
    emblem: 'M0 4 Q-8 1 -4 -3 Q-2 -5 0 -1 Q3 -6 5 -3 Q8 0 0 4Z',
  },
  frost: { cloth: '#38536f', trim: '#d4f4ff', emblem: 'M0 -6 L3 0 L0 6 L-3 0Z' },
  ruby: {
    cloth: '#872f32',
    trim: '#ffc76e',
    emblem: 'M-4 2 Q-6 -1 -1 -5 Q-2 -1 1 -2 L3 -5 Q8 2 2 5 Q-2 6 -4 2Z',
  },
  abyss: { cloth: '#19446e', trim: '#97e8fc', emblem: 'M0 -6 Q7 1 3 4 Q0 7 -3 4 Q-7 1 0 -6Z' },
  dune: { cloth: '#286164', trim: '#f3ce80', emblem: 'M-5 -4 L5 -4 L1 0 L5 4 L-5 4 L-1 0Z' },
  veil: {
    cloth: '#49315e',
    trim: '#d3a4ec',
    emblem: 'M2 -5 Q-3 -2 0 2 Q2 4 5 2 Q1 8 -4 3 Q-8 -3 2 -5Z',
  },
  flora: { cloth: '#778a49', trim: '#fff0bd', emblem: 'M-4 4 Q-6 -4 5 -5 Q6 3 -4 4Z' },
}

export function drawCatOutfit(c: CanvasRenderingContext2D, code: CatCode, pose: number) {
  const outfit = outfits[code]
  if (!outfit) return
  c.save()
  c.translate(51 + (4 - pose) * 0.7, 68)
  c.lineJoin = 'round'
  const fabric = c.createLinearGradient(-18, 0, 18, 22)
  fabric.addColorStop(0, outfit.cloth)
  fabric.addColorStop(0.55, outfit.cloth)
  fabric.addColorStop(1, '#232132')
  c.fillStyle = fabric
  c.strokeStyle = '#433340'
  c.lineWidth = 1.8
  c.beginPath()
  c.moveTo(-14, -2)
  c.quadraticCurveTo(0, 3, 14, -2)
  c.quadraticCurveTo(16, 10, 22, 21)
  c.quadraticCurveTo(2, 31, -22, 22)
  c.quadraticCurveTo(-17, 12, -14, -2)
  c.closePath()
  c.fill()
  c.stroke()
  c.strokeStyle = outfit.trim
  c.lineWidth = 1.5
  c.beginPath()
  c.moveTo(-14, 0)
  c.quadraticCurveTo(0, 6, 14, 0)
  c.moveTo(-20, 20)
  c.quadraticCurveTo(0, 28, 20, 20)
  c.stroke()
  c.translate(0, 13)
  c.fillStyle = outfit.trim
  c.fill(new Path2D(outfit.emblem))
  c.restore()
}
