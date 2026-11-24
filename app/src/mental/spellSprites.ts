import { type ArrowSpell, type FallSpell, type FlowSpell, SPELLBOOK } from './spellbook'

type Paint = CanvasRenderingContext2D
type Painter = (c: Paint) => void

// All drawings use a 64-unit square. Moving sprites face right before battle rotation.
function ink(c: Paint, d: string, fill: string, edge?: string, width = 2) {
  const path = new Path2D(d)
  c.lineJoin = 'round'
  c.fillStyle = fill
  c.fill(path)
  if (edge) {
    c.strokeStyle = edge
    c.lineWidth = width
    c.stroke(path)
  }
}

function oval(c: Paint, x: number, y: number, rx: number, ry: number, fill: string, tilt = 0) {
  c.beginPath()
  c.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2)
  c.fillStyle = fill
  c.fill()
}

export function fish(c: Paint) {
  ink(
    c,
    'M4 14 Q14 18 20 26 Q32 6 48 19 Q59 23 62 32 Q52 52 32 47 Q24 44 20 38 L4 51 Q9 32 4 14Z',
    '#44c7f2',
    '#245488',
  )
  ink(c, 'M20 34 Q30 40 36 37 Q49 43 60 31 Q52 49 36 45 Q25 43 20 34Z', '#ddffff')
  ink(c, 'M19 25 Q27 14 35 18 L30 12 Q20 12 17 21Z', '#e8ffff')
  oval(c, 48, 26, 3, 3.5, '#233657')
}

export function fishWave(c: Paint) {
  ink(
    c,
    'M4 3 Q35 2 50 18 Q61 32 54 43 Q47 38 44 33 Q48 51 29 59 Q18 64 4 60 Q28 47 26 34 Q19 41 10 39 Q27 20 4 3Z',
    '#218cda',
    '#244e89',
  )
  ink(c, 'M9 6 Q42 5 51 26 Q40 17 36 21 Q30 13 21 16Z M8 58 Q30 51 34 39 Q36 51 26 56Z', '#98edff')
  c.save()
  c.translate(12, 7)
  c.scale(0.77, 0.45)
  fish(c)
  c.restore()
}

export function paw(c: Paint, color: string) {
  ink(
    c,
    'M14 47 Q12 40 22 32 Q32 19 40 32 Q55 40 50 49 Q47 55 37 52 Q32 49 26 52 Q17 55 14 47Z',
    color,
  )
  for (const [x, y, tilt] of [
    [11, 30, -0.5],
    [23, 19, -0.22],
    [39, 18, 0.2],
    [52, 28, 0.5],
  ])
    oval(c, x, y, 5.5, 8, color, tilt)
}

export function pawComet(c: Paint) {
  ink(
    c,
    'M10 51 Q4 37 15 17 L17 28 Q27 15 28 2 Q42 17 40 24 L48 13 Q47 24 55 37 Q65 58 42 62 Q18 66 10 51Z',
    '#ff8f29',
    '#86372c',
  )
  oval(c, 33, 46, 21, 16, '#803f45')
  c.save()
  c.translate(11, 30)
  c.scale(0.68, 0.52)
  paw(c, '#ffcf5b')
  c.restore()
}

export function fireBloom(c: Paint) {
  c.save()
  c.translate(32, 32)
  for (let i = 0; i < 4; i++) {
    ink(c, 'M0 4 Q-16 -7 -5 -20 Q0 -25 -2 -31 Q17 -20 10 -9 Q7 0 0 4Z', '#ff8731', '#aa4331')
    ink(c, 'M0 2 Q-6 -6 2 -17 Q8 -9 4 -4Z', '#fff3a0')
    c.rotate(Math.PI / 2)
  }
  c.restore()
}

const arrowheads: Record<ArrowSpell, string> = {
  starArrow: 'M38 32 L44 27 L44 15 L51 23 L61 19 L58 29 L63 33 L55 37 L53 48 L46 40 L37 41Z',
  lightArrow: 'M38 12 L63 32 L38 52 L42 36 L42 28Z',
  poisonArrow: 'M36 42 L42 31 L37 20 L48 25 L46 14 L63 30 L52 42 L52 36Z',
  iceArrow: 'M35 32 L42 19 L51 17 L63 32 L49 46 L40 43Z',
  fireArrow: 'M32 43 Q46 33 34 17 Q47 20 49 27 L48 13 Q59 19 63 32 Q56 46 38 48 Q44 41 43 35Z',
  waterArrow: 'M33 35 Q46 28 36 16 Q48 16 53 26 Q58 26 63 32 Q56 45 39 46 Q47 39 45 34Z',
  sandArrow: 'M34 40 L40 29 L38 19 L48 23 L46 17 L56 24 L63 32 L49 44 L40 47 L44 38Z',
  shadowArrow: 'M33 47 Q48 33 35 14 Q53 16 63 32 Q53 45 33 47Z',
  petalArrow: 'M36 32 Q33 19 44 17 Q52 16 53 25 Q63 22 62 32 Q57 44 43 45 Q37 44 36 32Z',
}

export function drawElementArrow(c: Paint, spell: ArrowSpell) {
  const { light, mid, dark, line } = SPELLBOOK[spell].colors
  ink(c, 'M2 12 L13 17 L21 28 L47 28 L47 36 L21 36 L12 48 L2 52 L10 33Z', mid, line)
  ink(c, 'M8 19 L16 24 L22 31 L47 31 L47 33 L16 33Z', light)
  ink(c, arrowheads[spell], mid, line)
  ink(c, 'M43 26 L59 31 L46 33Z', light)
  ink(c, 'M44 39 L49 34 L57 33Z', dark)
}

export const spellSprites = {
  fire(c) {
    ink(
      c,
      'M59 38 Q52 58 32 54 Q18 51 15 38 Q0 31 4 16 Q9 3 22 12 Q29 21 19 23 Q11 24 13 17 Q8 24 18 29 Q33 34 39 24 L37 31 Q45 29 46 18 Q59 25 59 38Z',
      '#ff862f',
      '#98432c',
    )
    ink(c, 'M22 36 Q33 45 42 36 L46 30 Q45 37 53 32 Q58 46 43 49 Q32 51 22 36Z', '#fff1a0')
  },
  poison(c) {
    ink(
      c,
      'M2 39 L20 29 L17 13 L28 25 L39 23 L38 9 L47 21 L62 18 L48 35 L48 45 L40 37 L28 40 L22 54 L21 41Z',
      '#af65dd',
      '#422357',
    )
    ink(c, 'M10 37 L51 25 L33 33Z', '#efd2ff')
    oval(c, 43, 51, 3, 5, '#ab65d7')
  },
  light(c) {
    ink(c, 'M1 27 L41 23 L46 7 L49 23 L63 31 L50 39 L46 57 L42 40 L1 36Z', '#ffcd4e', '#a66924')
    ink(c, 'M2 31 L44 28 L47 19 L49 28 L60 31 L48 34 L46 44 L43 34Z', '#fffdeb')
  },
  dark(c) {
    ink(
      c,
      'M3 2 Q52 3 59 35 L54 30 Q57 52 25 62 Q40 49 32 38 Q27 43 17 44 Q30 34 22 28 Q42 25 3 2Z',
      '#49346e',
      '#2d2149',
    )
    ink(c, 'M9 5 Q40 9 47 27 Q34 15 26 18Z', '#9876cd')
    oval(c, 24, 51, 4, 2, '#745896', -0.6)
  },
  sand(c) {
    ink(
      c,
      'M2 59 Q15 41 24 39 Q13 41 9 39 Q22 33 30 21 Q40 9 24 7 Q45 1 56 17 Q64 29 50 35 Q56 52 30 58Z',
      '#d9a04c',
      '#916437',
    )
    ink(c, 'M5 56 Q40 42 46 23 Q50 14 42 9 Q59 18 52 30 Q43 49 20 57Z', '#ffe3a0')
    for (const [x, y] of [
      [13, 21],
      [7, 30],
      [18, 15],
      [20, 30],
    ])
      oval(c, x, y, 1.7, 1.4, '#c28a44')
  },
  star(c) {
    ink(c, 'M1 46 Q14 31 30 27 L27 37Z', '#ffad83')
    ink(c, 'M4 52 L31 34 L33 43Z', '#ffccee')
    ink(
      c,
      'M42 7 L48 22 L62 25 L52 36 L53 52 L39 45 L25 51 L28 36 L18 25 L34 23Z',
      '#ffdb58',
      '#aa672e',
    )
    ink(c, 'M42 14 L45 27 L56 28 L44 32 L36 40 L38 29 L28 27 L38 26Z', '#fff8bf')
  },
  hail(c) {
    ink(c, 'M8 29 L22 13 L43 10 L57 26 L55 45 L40 56 L20 53 L8 43Z', '#8ec7ef', '#386b9d')
    ink(c, 'M12 29 L24 16 L42 13 L35 28 L18 35Z', '#ecfcff')
    ink(c, 'M36 31 L54 28 L51 43 L39 51Z', '#559ace')
  },
  blossom(c) {
    c.save()
    c.translate(32, 32)
    for (let i = 0; i < 5; i++) {
      ink(
        c,
        'M0 4 Q-17 -5 -12 -20 Q-10 -29 -4 -25 L0 -21 L4 -26 Q12 -28 13 -17 Q14 -6 0 4Z',
        '#ffadc6',
        '#ac537b',
      )
      c.rotate((Math.PI * 2) / 5)
    }
    oval(c, 0, 0, 5, 5, '#ffe797')
    c.restore()
  },
  bomb(c) {
    ink(c, 'M34 16 Q37 4 47 9 Q51 11 54 6 L57 9 Q51 17 45 13 Q41 10 39 18Z', '#dca657', '#563945')
    oval(c, 30, 37, 24, 23, '#302c44')
    oval(c, 27, 32, 17, 13, '#56566d')
    ink(c, 'M14 34 L16 23 L24 29 Q30 26 36 29 L43 23 L44 36 Q31 51 14 34Z', '#edc992')
    oval(c, 24, 34, 2, 2, '#42374f')
    oval(c, 35, 34, 2, 2, '#42374f')
    ink(c, 'M53 5 L55 1 L57 5 L62 4 L59 9 L61 13 L55 11 L51 14 L52 9 L48 7Z', '#ffd563')
  },
} satisfies Record<Exclude<FlowSpell, ArrowSpell> | FallSpell, Painter>

export function stoneRam(c: Paint) {
  ink(
    c,
    'M2 35 L7 14 L17 9 L42 8 L52 13 L57 7 L58 19 L63 30 L57 42 L43 48 L14 47Z',
    '#b39785',
    '#574955',
  )
  ink(c, 'M8 30 L12 14 L26 11 L18 26Z M31 20 L38 12 L48 14 L40 22Z', '#e8cbb0')
  ink(c, 'M4 36 L22 33 L26 43 L14 46Z M29 45 L40 32 L54 33 L48 43Z', '#82737a')
  ink(
    c,
    'M37 34 Q22 33 26 21 Q29 11 40 15 Q50 19 44 26 Q40 32 35 26 Q32 22 37 20 Q31 19 31 24 Q31 31 38 30Z',
    '#edc496',
    '#715749',
  )
  ink(c, 'M50 24 L58 22 L55 28Z', '#453647')
}
