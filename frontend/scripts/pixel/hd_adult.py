# 32x40 청년 도트 생성기: 왼쪽 절반 평면 모양 → 거울 → 명암 → 부위별 윤곽 → 얼굴 손질
# 실행: python frontend/scripts/pixel/hd_adult.py → 출력된 줄을 pixel/hd/adult.ts의 map에 붙인다
import sys

W, H = 32, 40
# 평면 모양 (왼쪽 16칸). h 머리, s 피부, c 셔츠, w 옷깃, b 허리띠, y 버클, p 바지, n 신발
HALF = [
    '................',  # 0
    '..........hhhhhh',  # 1
    '.......hhhhhhhhh',  # 2
    '.....hhhhhhhhhhh',  # 3
    '....hhhhhhhhhhhh',  # 4
    '...hhhhhhhhhhhhh',  # 5
    '...hhhhhhhhhhhhh',  # 6
    '..hhhhhhhhhhhhhh',  # 7
    '..hhhhhhhhhhhhhh',  # 8
    '..hhhhhhhhhhhhhs',  # 9
    '..hhhhhhhshhhhss',  # 10
    '..hhhhhsssshhsss',  # 11
    '...hhsssssssssss',  # 12
    '...sssssssssssss',  # 13
    '...sssssssssssss',  # 14
    '...sssssssssssss',  # 15
    '....ssssssssssss',  # 16
    '.....sssssssssss',  # 17
    '......ssssssssss',  # 18
    '........ssssssss',  # 19
    '............ssss',  # 20
    '.......cccccwsss',  # 21
    '.....ccccccccwss',  # 22
    '....ccccccccccws',  # 23
    '....cccccccccccw',  # 24
    '...ccccccccccccc',  # 25
    '...ccccccccccccc',  # 26
    '...ccccccccccccc',  # 27
    '...sss.ccccccccc',  # 28
    '...sss.bbbbbbbby',  # 29
    '.......ppppppppp',  # 30
    '.......ppppppppp',  # 31
    '.......pppppppp.',  # 32
    '.......pppppppp.',  # 33
    '.......pppppppp.',  # 34
    '.......pppppppp.',  # 35
    '.......pppppppp.',  # 36
    '......nnnnnnnnn.',  # 37
    '......nnnnnnnnn.',  # 38
    '................',  # 39
]
assert len(HALF) == H and all(len(r) == 16 for r in HALF), [len(r) for r in HALF]
HALF = [('.' + r[:-1]) if 1 <= i <= 19 else r for i, r in enumerate(HALF)]
g = [list(r + r[::-1]) for r in HALF]
region = [row[:] for row in g]  # 평면 부위 기억

LIGHT = {'h': 'H', 's': 'l', 'c': 'C', 'p': 'u', 'n': 'N'}
SHADE = {'h': 'j', 's': 'S', 'c': 'd', 'p': 'P', 'n': 'a', 'w': 'g', 'b': 'b', 'y': 'y'}
OUT = {'h': 'x', 's': 'v', 'c': 'q', 'w': 'q', 'b': 'o', 'y': 'o', 'p': 'z', 'n': 'o'}

def R(y, x):
    return region[y][x] if 0 <= y < H and 0 <= x < W else '.'

# 명암: 빛은 왼쪽 위. 가로 줄마다 오른쪽 끝 2칸 그림자, 왼쪽 끝 1칸 밝게, 아래 끝 그림자, 머리카락 아래 피부는 그늘
for y in range(H):
    x = 0
    while x < W:
        r = region[y][x]
        if r == '.':
            x += 1
            continue
        e = x
        while e < W and region[y][e] == r:
            e += 1
        n = e - x
        for i in range(x, e):
            out = r
            if r in LIGHT and n >= 4 and i == x:
                out = LIGHT[r]
            if r in SHADE and n >= 6 and i >= e - 2:
                out = SHADE[r]
            if R(y + 1, i) != r and r in ('c', 'p', 'h'):
                out = SHADE[r]
            if r == 's' and R(y - 1, i) == 'h':
                out = 'S'
            if r in LIGHT and R(y - 1, i) == '.' and i < W // 2 + 2 and out == r:
                out = LIGHT[r]
            g[y][i] = out
        x = e

# 부위별 색 윤곽: 빈 칸 중 상하좌우에 그림이 있으면 그 부위의 윤곽 색
order = [(0, -1), (0, 1), (-1, 0), (1, 0)]
for y in range(H):
    for x in range(W):
        if region[y][x] != '.':
            continue
        for dy, dx in order:
            r = R(y + dy, x + dx)
            if r != '.':
                g[y][x] = OUT[r]
                break

def put(y, x, ch):
    g[y][x] = ch

def fill(y, xs, ch):
    for x in xs:
        put(y, x, ch)

# 머리카락: 결(짙은 선)과 윤기 띠
for y, x in [(4, 9), (5, 8), (6, 7), (7, 7), (5, 22), (6, 23), (7, 24), (8, 24), (3, 15), (4, 15), (4, 16)]:
    put(y, x, 'j')
fill(4, [11, 12, 13], 'i'); fill(5, [10, 11], 'i'); fill(4, [19, 20], 'i'); fill(3, [12, 13, 14], 'H')
# 앞머리 끝은 그림자
for y, x in [(10, 15), (10, 16), (11, 11), (11, 20), (11, 12), (11, 19)]:
    if region[y][x] == 'h':
        put(y, x, 'j')
# 귀 안쪽 그늘
fill(14, [5, 26], 'S')
# 눈: 3×3 까만 눈동자에 왼쪽 위 반짝임, 아래 한 줄은 갈색 반사
for ex in (10, 19):
    for yy in (13, 14, 15):
        fill(yy, [ex, ex + 1, ex + 2], 'k')
    put(14, ex, 'E')
    fill(16, [ex, ex + 1, ex + 2], 'f')
    put(16, ex + 1, 'e')
# 볼 홍조, 코, 입
fill(17, [8, 9], 'r'); fill(17, [22, 23], 'r')
put(17, 16, 'S')
fill(18, [15, 16], 'm')
# 목: 턱 그늘
fill(20, [12, 13, 14, 15, 16, 17, 18, 19], 'S'); fill(20, [12], 'S')
# 소매와 몸통 사이 주름, 소매 끝
for y in (25, 26, 27):
    put(y, 6, 'd'); put(y, 25, 'q')
fill(27, [3, 4, 5], 'd'); fill(27, [26, 27, 28], 'd')
# 손: 손가락 그늘
put(29, 5, 'S'); put(29, 28, 'S'); put(28, 28, 'S')
# 신발 밑창

rows = [''.join(r) for r in g]
for r in rows:
    assert len(r) == W
used = sorted(set(''.join(rows)) - {'.'})
print('USED', used, file=sys.stderr)
print('\n'.join(f"    '{r}'," for r in rows))
