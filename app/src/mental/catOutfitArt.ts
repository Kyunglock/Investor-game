import type { CatCode } from '@web/features/raising/store'

type Painter = ReturnType<typeof outfitPainter>
function outfitPainter(c: CanvasRenderingContext2D) {
  function shape(
    path: string,
    fill: string | CanvasGradient,
    stroke: string | null = '#453741',
    width = 1.45,
  ) {
    const outline = new Path2D(path)
    c.fillStyle = fill
    c.fill(outline)
    if (stroke) {
      c.strokeStyle = stroke
      c.lineWidth = width
      c.stroke(outline)
    }
  }
  function line(path: string, color: string, width: number) {
    c.strokeStyle = color
    c.lineWidth = width
    c.stroke(new Path2D(path))
  }
  function gradient(x: number, y: number, endX: number, endY: number, colors: string[]) {
    const paint = c.createLinearGradient(x, y, endX, endY)
    colors.forEach((color, i) => paint.addColorStop(i / (colors.length - 1), color))
    return paint
  }
  return { c, shape, line, gradient }
}

function silver({ c, shape, line, gradient }: Painter) {
  const metal = gradient(-9, -6, 8, 18, ['#404454', '#f2ece4', '#777d87', '#454957'])
  shape('M-16 -3 Q0 3 16 -3 L20 16 L13 22 L12 29 L0 25 L-13 30 L-15 20 L-21 18Z', '#743c45')
  shape('M-15 -4 Q0 3 15 -4 L15 13 Q9 20 0 23 Q-10 19 -16 13Z', metal)
  shape('M-17 9 Q0 20 17 9 L16 15 Q3 24 0 24 Q-12 20 -17 15Z', metal)
  for (const dir of [-1, 1]) {
    c.save()
    c.scale(dir, 1)
    shape('M11 -4 Q19 -9 25 -1 L27 8 Q18 11 10 4Z', metal)
    line('M12 2 Q20 7 26 4', '#ecd59f', 1.6)
    c.restore()
  }
  line('M-12 -2 Q0 8 12 -2 M0 4 L0 14', '#f0d49b', 1.8)
}
function frost({ shape, line, gradient }: Painter) {
  shape(
    'M-16 -3 Q-4 1 15 -4 Q16 7 21 17 L25 22 L11 25 L6 21 L3 29 L-12 26 L-20 24 L-16 12Z',
    gradient(-15, 0, 22, 20, ['#7294a9', '#3b5575', '#223550']),
  )
  line('M-15 23 L1 26 L6 19 M11 22 L22 20', '#99ccdc', 1.8)
  shape(
    'M-22 -4 L-13 -7 Q1 -1 15 -7 L22 -6 L20 -3 L26 -2 L22 1 L25 4 L17 4 L20 9 L12 7 L10 11 L4 8 L0 12 L-5 8 L-11 10 L-13 6 L-21 7 L-18 2 L-25 3 L-22 -1 L-26 -2Z',
    gradient(0, -6, 2, 11, ['#fffaf1', '#e6eff5', '#9cb1c5']),
  )
  shape('M-20 -3 L-20 -13 L-14 -8 L-10 -17 L-8 -5 L-4 -9 L-7 1Z', '#a2dcf1', '#617d98', 1)
}
function star({ c, shape, line, gradient }: Painter, pose: number) {
  shape(
    'M-14 -3 Q-1 2 16 -5 Q16 9 25 19 Q18 21 11 20 L14 25 Q-2 28 -14 23 L-21 20Z',
    gradient(-18, -2, 20, 22, ['#465690', '#223465', '#182341']),
  )
  line('M-19 19 Q-3 27 12 24 M14 18 L22 18', '#edc167', 1.7)
  // Hood drapes over the back of the head, with both ear tips and the turning cheek visible.
  c.save()
  c.translate((4 - pose) * 0.65, 0)
  c.rotate((pose - 4) * 0.023)
  shape(
    'M-27 -32 Q-23 -49 -6 -52 Q11 -55 25 -37 Q34 -25 27 -11 Q22 -3 13 2 Q7 7 5 13 Q-9 12 -20 3 Q-31 -7 -30 -20Z',
    gradient(-25, -42, 20, 5, ['#48568a', '#293760', '#19233f']),
  )
  line('M-25 -33 Q-19 -47 -5 -49 Q9 -52 22 -37', '#ecc570', 2.2)
  line('M-26 -7 Q-17 7 4 11 Q10 0 20 -4', '#cf9c51', 1.6)
  shape('M-3 -30 L-1 -25 L4 -23 L-1 -21 L-3 -16 L-5 -21 L-10 -23 L-5 -25Z', '#ffdd84', null)
  line('M6 -34 L12 -30 L17 -34', '#aeb9d6', 0.8)
  c.restore()
}

function ruby({ shape, line, gradient }: Painter) {
  const iron = gradient(-8, 0, 9, 14, ['#362935', '#ae8064', '#493443'])
  shape('M-16 -4 Q0 2 14 -4 L18 18 L11 25 L0 21 L-12 26 L-19 17Z', iron)
  line('M-15 9 Q0 17 15 8 M-15 15 Q0 23 15 14', '#ffc16a', 1.6)
  shape(
    'M-21 -4 Q-8 0 13 -6 Q18 -8 23 -4 L16 0 Q20 4 29 0 Q25 10 13 10 L25 17 Q11 19 1 8 Q-12 9 -21 2Z',
    gradient(-10, -2, 18, 12, ['#f1934e', '#b72e32', '#661f37']),
  )
  line('M-14 0 Q0 6 14 -2', '#ffd17d', 1.5)
}

function abyss({ shape, line, gradient }: Painter) {
  const water = gradient(-22, -3, 19, 22, ['#396e91', '#1a3b68', '#416991'])
  shape(
    'M-16 -5 Q0 2 16 -5 Q21 4 25 11 Q31 17 24 20 Q21 21 18 16 Q21 28 14 27 Q8 27 7 20 Q6 30 -1 29 Q-8 28 -7 20 Q-14 29 -18 25 Q-23 22 -19 14 Q-25 21 -28 15 Q-29 9 -22 4Z',
    water,
  )
  line(
    'M-21 8 Q-25 17 -22 16 M-13 10 Q-19 22 -16 22 M0 12 Q-4 25 0 25 M12 10 Q19 23 15 23 M18 5 Q26 16 24 16',
    '#8ebde6',
    1.6,
  )
  shape('M-20 -4 Q0 3 18 -5 L21 0 Q12 7 0 10 Q-12 9 -22 1Z', '#304d74')
  shape(
    'M-5 5 Q-5 -1 0 -2 Q6 -1 6 4 Q6 10 0 11 Q-5 10 -5 5Z',
    gradient(-3, 0, 4, 10, ['#fff8e6', '#b8edf9', '#749bbe']),
    '#debe80',
    1.7,
  )
}

function dune({ shape, line, gradient }: Painter) {
  shape(
    'M-17 -4 Q0 3 14 -5 L20 16 L14 27 L1 23 L-12 28 L-20 19Z',
    gradient(-12, 0, 15, 20, ['#f4e2b5', '#cfad78', '#95724b']),
  )
  shape(
    'M-19 -4 Q-7 1 13 -7 L19 -1 Q6 9 -6 12 Q-13 18 -14 28 L-22 24 Q-21 13 -14 8 L-21 3Z',
    '#266363',
  )
  line('M-17 2 Q-2 7 15 -3 M-17 22 L-15 17 M2 22 L13 25 L16 18', '#edc376', 1.7)
  shape('M-4 5 L0 0 L5 4 L1 10Z', '#d59a45', '#ffe19a')
}

function veil({ shape, line, gradient }: Painter) {
  shape(
    'M-17 -4 L12 -6 Q12 4 18 10 Q23 16 29 18 L18 19 L23 24 Q13 25 3 20 L5 28 Q-9 25 -15 17 L-22 19 Q-17 8 -17 -4Z',
    gradient(-15, -4, 20, 22, ['#49324f', '#302441', '#745183']),
  )
  line('M-16 14 Q-8 11 0 19 L3 24 M9 15 Q18 23 24 22', '#cfa3dd', 1.5)
  shape('M-23 -11 Q-14 -6 2 -7 L20 -13 L18 -3 Q11 3 -2 5 Q-14 5 -22 0Z', '#42304f')
  line('M-19 -6 Q-6 1 16 -7', '#ad81b9', 1.7)
  shape('M-9 1 L-5 -3 L-1 1 L-5 6Z', '#e6bc71')
}

function flora({ shape, line }: Painter) {
  shape(
    'M-14 -5 Q0 1 15 -4 Q23 2 26 13 Q16 13 10 8 Q19 15 18 25 Q6 24 1 14 Q2 23 -7 29 Q-14 23 -12 14 Q-17 21 -25 20 Q-24 6 -14 -5Z',
    '#829558',
  )
  shape('M-18 -5 Q-4 2 16 -6 L20 1 Q8 5 0 13 Q-7 20 -15 21 Q-13 10 -5 5 Q-14 7 -22 1Z', '#fff0d1')
  line('M-17 -1 Q-7 5 10 -2 M4 11 Q10 19 15 21 M-12 17 L-5 9', '#c4a767', 1.3)
  shape(
    'M8 -4 Q6 -11 12 -8 Q16 -15 19 -9 Q26 -10 23 -4 Q26 2 19 2 Q15 8 12 2 Q5 2 8 -4Z',
    '#edb1b5',
    '#945d68',
    1,
  )
  shape('M13 -4 Q16 -7 19 -4 Q20 0 16 0 Q13 0 13 -4Z', '#ffe49b', null)
}

function wisteria({ shape, line }: Painter) {
  shape(
    'M-16 -5 Q-1 1 14 -5 L18 13 L24 23 Q14 26 6 21 L-1 29 Q-11 26 -14 17 L-22 20 L-20 4Z',
    '#745188',
  )
  shape('M-20 -5 Q-6 0 14 -7 L19 -2 Q9 6 -5 11 L-17 18 L-19 11 L-8 5 L-22 2Z', '#cfacdb')
  line('M-16 14 Q-4 3 14 -2 M-10 18 Q-7 23 -1 25 L4 20', '#edc781', 1.4)
  line('M13 -3 Q17 4 15 15 M17 0 Q22 5 21 10', '#8b7661', 1.5)
  for (const [x, y] of [
    [12, 0],
    [17, 2],
    [13, 5],
    [18, 7],
    [15, 10],
    [15, 14],
    [21, 6],
    [21, 10],
  ]) {
    shape(`M${x} ${y} q-4 -3 -4 0 q0 3 3 4 q5 -2 3 -4 q0 -2 -2 0Z`, '#d7b5ed', '#79577c', 0.85)
  }
}

// 극광냥의 제복은 원본 전투 스프라이트에 들어 있다.
const outfits: Partial<Record<CatCode, (painter: Painter, pose: number) => void>> = {
  silver,
  frost,
  star,
  ruby,
  abyss,
  dune,
  veil,
  flora,
  wisteria,
}

export function drawCatOutfit(c: CanvasRenderingContext2D, code: CatCode, pose: number) {
  const paint = outfits[code]
  if (!paint) return
  c.save()
  c.translate(51 + (4 - pose) * 0.7, 68)
  c.lineJoin = 'round'
  c.lineCap = 'round'
  paint(outfitPainter(c), pose)
  c.restore()
}
