# 캐릭터 몸통 생성기 (32×40, 나이 5단계 × 성별 2). decisions.md 142번.
# 평면 모양(왼쪽 절반) → 거울 → 머리 모양 → 명암(빛은 왼쪽 위) → 부위별 색 윤곽 → 얼굴·주름 손질.
# 실행: python -X utf8 frontend/scripts/pixel/bodies.py  → frontend/src/features/game/pixel/bodyMaps.ts 를 새로 쓴다.
import os
import sys

W, H = 32, 40

# 머리(왼쪽 절반, 0~18줄)와 목(19줄). 아기를 뺀 모든 나이가 같은 머리라 얼굴 겹(표정·장식)의 좌표가 같다. 아기는 BABY_HEAD이고 겹을 받지 않는다.
HEAD = [
    '...........hhhhh',  # 0
    '........hhhhhhhh',  # 1
    '......hhhhhhhhhh',  # 2
    '.....hhhhhhhhhhh',  # 3
    '....hhhhhhhhhhhh',  # 4
    '....hhhhhhhhhhhh',  # 5
    '...hhhhhhhhhhhhh',  # 6
    '...hhhhhhhhhhhhh',  # 7
    '...hhhhhhhhhhhhs',  # 8
    '...hhhhhhhshhhhs',  # 9
    '...hhhhhsssshhss',  # 10
    '....hhssssssssss',  # 11
    '....ssssssssssss',  # 12
    '....ssssssssssss',  # 13
    '....ssssssssssss',  # 14
    '.....sssssssssss',  # 15
    '......ssssssssss',  # 16
    '.......sssssssss',  # 17
    '.........sssssss',  # 18
    '............ssss',  # 19 목
]

# 몸(왼쪽 절반). c 옷, w 옷깃, s 손·다리, b 허리띠, y 버클, p 바지, n 신발, B 아기 옷, t 넥타이
ADULT_M = [
    '.......cccccwsss',
    '.....ccccccccwss',
    '....ccccccccccws',
    '....cccccccccccw',
    '...ccccccccccccc',
    '...ccccccccccccc',
    '...ccccccccccccc',
    '...sss.ccccccccc',
    '...sss.bbbbbbbby',
    '.......ppppppppp',
    '.......ppppppppp',
    '.......pppppppp.',
    '.......pppppppp.',
    '.......pppppppp.',
    '.......pppppppp.',
    '.......pppppppp.',
    '......nnnnnnnnn.',
    '......nnnnnnnnn.',
]
ADULT_F = ADULT_M[:7] + [
    '...sss.ccccccccc',
    '...sss.ccccccccc',
    '......cccccccccc',
    '.....ccccccccccc',
    '.....ccccccccccc',
    '....cccccccccccc',
    '.........sss....',
    '.........sss....',
    '.........sss....',
    '........nnnnn...',
    '........nnnnn...',
]
MIDDLE_M = [
    '.......cccccwstt',
    '.....ccccccccwtt',
    '....ccccccccccwt',
    '....cccccccccccw',
    '...cccccccccccct',
] + ADULT_M[5:]
MIDDLE_M[3] = '....ccccccccccwt'
MIDDLE_M[5] = '...cccccccccccct'
MIDDLE_M[6] = '...cccccccccccct'
MIDDLE_F = ADULT_F
CHILD_M = [
    '........cccccwss',
    '......cccccccwss',
    '.....ccccccccccw',
    '.....ccccccccccc',
    '.....ccccccccccc',
    '.....sss.ccccccc',
    '.....sss.ppppppp',
    '.........ppppppp',
    '.........pppppp.',
    '...........ssss.',
    '...........ssss.',
    '..........nnnnn.',
    '..........nnnnn.',
]
CHILD_F = CHILD_M[:5] + [
    '.....sss.ccccccc',
    '........cccccccc',
    '.......ccccccccc',
    '.......ccccccccc',
    '...........ssss.',
    '...........ssss.',
    '..........nnnnn.',
    '..........nnnnn.',
]
# 아기는 어른 머리를 쓰면 머리가 몸의 세 배라 징그럽다. 작은 머리(폭 14칸, 11줄)와 우주복 몸(9줄)을 따로 둔다 (decisions.md 163번).
# 줄인 뒤 좌표: 옛 8·9열은 빠지고 0~7열은 2칸 오른쪽으로 간다(shrink).
BABY_HEAD = [
    '............ssss',  # 0 정수리(둥글게)
    '..........ssssss',  # 1
    '.......sssssssss',  # 2
    '.......sssssssss',  # 3
    '.......sssssssss',  # 4 눈
    '.......sssssssss',  # 5 눈
    '.......sssssssss',  # 6 볼
    '.......sssssssss',  # 7 입
    '..........ssssss',  # 8
    '...........sssss',  # 9 턱
    '.............sss',  # 10 목
]
BABY = [
    '...........BBBBB',
    '.........BBBBBBB',
    '......ssBBBBBBBB',
    '......ssBBBBBBBB',
    '.........BBBBBBB',
    '.........BBBBBBB',
    '..........BBBB..',
    '..........BBBB..',
    '..........ssss..',
]
OLD_M = ADULT_M[:9] + [
    '.......ppppppppp',
    '.......pppppppp.',
    '.......pppppppp.',
    '.......pppppppp.',
    '......nnnnnnnnn.',
    '......nnnnnnnnn.',
]
OLD_F = ADULT_F[:9] + [
    '.....ccccccccccc',
    '.....ccccccccccc',
    '....cccccccccccc',
    '....cccccccccccc',
    '.......nnnnnnn..',
    '.......nnnnnnn..',
]

# 부위 → (윤곽, 그림자, 기본, 밝은 쪽)
RAMP = {
    'h': ('x', 'j', 'h', 'H'),  # 갈색 머리
    'G': ('x', 'J', 'G', 'I'),  # 흰머리 섞임
    'A': ('V', 'U', 'O', 'Q'),  # 흰머리
    's': ('v', 'S', 's', 'l'),  # 피부
    'c': ('q', 'd', 'c', 'C'),  # 옷
    'w': ('q', 'g', 'w', 'w'),  # 옷깃
    't': ('q', '6', 't', 't'),  # 넥타이
    'B': ('5', '3', '1', '2'),  # 아기 옷
    'b': ('o', 'b', 'b', 'b'),  # 허리띠
    'y': ('o', 'y', 'y', 'y'),  # 버클
    'p': ('z', 'P', 'p', 'u'),  # 바지
    'n': ('o', 'a', 'n', 'N'),  # 신발
    'R': ('7', '7', 'R', '8'),  # 리본
    'Z': ('o', '9', 'Z', 'Z'),  # 지팡이
    'e': ('q', 'd', 'd', 'c'),  # 옆모습의 앞팔 소매 (몸통보다 어둡게)
}
HAIRS = ('h', 'G', 'A')


def shrink(r):
    # 폭 줄이기: 왼쪽 절반의 8·9열을 빼고 바깥에 빈 칸 둘. 장면에서 12칸 간격으로 서도 닿지 않게 몸 폭을 24칸 안에 둔다.
    return '..' + r[:8] + r[10:]


def sx(x):
    # 줄이기 전 좌표 → 줄인 뒤 좌표 (왼쪽 절반 기준, 오른쪽은 거울)
    if x >= W // 2:
        return W - 1 - sx(W - 1 - x)
    return x + 2 if x < 10 else x


def mirror(rows):
    return [list(r + r[::-1]) for r in rows]



# ---- 뒷모습 (decisions.md 196·197·199번) ----
# 옆모습(옆얼굴·3/4 얼굴)은 징그러워 뺐다. 뒷모습만 만든다.


# 두 팔 만세(cheer)는 기괴해 보여 뺐다 (decisions.md 196번).
POSES = ('stand', 'clap', 'hold', 'reach-left', 'reach-right', 'wave')


def apply_pose(region, ht, pose):
    """늘어뜨린 팔(손과 그 위 소매 세 칸 폭)을 지우고 자세의 팔을 그린다. 가슴 앞으로 모은 팔의 윤곽 칸 목록을 돌려준다."""
    bt = ht + 20  # 옷이 시작하는 줄
    hand = [(y, x) for y in range(bt, H) for x in range(W // 2) if region[y][x] == 's' and x < 10]
    hy0 = min(y for y, _ in hand)
    hx = min(x for _, x in hand)  # 왼손의 왼쪽 끝
    # 팔: 손 줄들과, 손 바로 위로 이어지는 소매(손과 같은 세 칸)
    top = hy0
    while top - 1 > bt + 2 and all(region[top - 1][x] == 'c' for x in range(hx, hx + 3)):
        top -= 1
    sides = {'clap': 'LR', 'hold': 'LR', 'reach-left': 'L', 'reach-right': 'R', 'wave': 'R'}[pose]
    cells = []  # (y, x, ch) 왼쪽 기준. 오른쪽은 거울

    def arm(y, x, ch='c'):
        cells.append((y, x, ch))

    if pose == 'wave':
        # 한 팔 들기: 어깨에서 머리 옆으로 곧게 올린 오른팔, 손은 머리 위 높이
        for y in range(ht + 9, bt + 4):
            for x in (3, 4, 5):
                arm(y, x, 's' if y < ht + 12 else 'c')
        for y in range(bt, bt + 4):
            for x in range(5, hx + 3):
                arm(y, x)
    elif pose in ('reach-left', 'reach-right'):
        # 옆 사람에게 뻗은 팔: 어깨에서 비스듬히 내려가 손이 몸 칸 바깥 끝에 닿는다
        steps = [(top, hx - 1), (top + 1, hx - 2), (top + 2, hx - 3), (top + 3, hx - 4)]
        for y, x0 in steps:
            for x in range(max(0, x0), x0 + 4):
                arm(y, x)
        last = steps[-1]
        for y in (last[0] + 1, last[0] + 2):
            for x in range(max(0, last[1] - 1), last[1] + 2):
                arm(y, x, 's')
    else:
        # 손뼉·안기: 위팔은 그대로 내려오고 팔뚝을 가슴 앞으로 모은다
        fy = top + (1 if pose == 'clap' else 2)
        for y in range(top, fy + 1):
            for x in range(hx, hx + 3):
                arm(y, x)
        for x in range(hx + 3, W // 2 - (1 if pose == 'clap' else 4)):
            arm(fy, x)
        if pose == 'clap':
            for y in (fy - 1, fy):
                for x in (W // 2 - 2, W // 2 - 1):
                    arm(y, x, 's')
        else:
            for y in (fy, fy + 1):
                for x in range(W // 2 - 6, W // 2 - 3):
                    arm(y, x, 's')

    def mirror_x(x, side):
        return x if side == 'L' else W - 1 - x

    for side in sides:
        for y in range(top, hy0 + 2):
            for x in range(hx, hx + 3):
                xx = mirror_x(x, side)
                if region[y][xx] in ('c', 's'):
                    region[y][xx] = '.'
        for y, x, ch in cells:
            if 0 <= y < H:
                region[y][mirror_x(x, side)] = ch
    # 가슴 앞 팔뚝 윤곽: 모은 팔의 바로 윗줄
    cross = []
    if pose in ('clap', 'hold'):
        fy = top + (1 if pose == 'clap' else 2)
        for side in sides:
            for x in range(hx + 3, W // 2 - (1 if pose == 'clap' else 4)):
                cross.append((fy - 1, mirror_x(x, side)))
    return cross


def build(stage, sex, pose='stand', view='front'):
    body = {
        ('baby', 'M'): BABY, ('baby', 'F'): BABY,
        ('child', 'M'): CHILD_M, ('child', 'F'): CHILD_F,
        ('adult', 'M'): ADULT_M, ('adult', 'F'): ADULT_F,
        ('middle', 'M'): MIDDLE_M, ('middle', 'F'): MIDDLE_F,
        ('old', 'M'): OLD_M, ('old', 'F'): OLD_F,
    }[(stage, sex)]
    head = BABY_HEAD if stage == 'baby' else HEAD
    ht = H - 1 - len(body) - len(head)
    region = [['.'] * W for _ in range(H)]
    for i, row in enumerate(mirror([shrink(r) for r in head + body])):
        region[ht + i] = row
    if view == 'back':
        # 뒷모습: 얼굴 자리는 뒤통수 머리카락, 귀만 양옆에 남는다. 옷깃·넥타이는 등판 옷이다.
        for y in range(ht, ht + 19):
            for x in range(W):
                if region[y][x] == 's' and not (ht + 12 <= y <= ht + 14 and (x <= 6 or x >= W - 7)):
                    region[y][x] = 'h'
        for y in range(ht + 19, H):
            for x in range(W):
                if region[y][x] in ('w', 't'):
                    region[y][x] = 'c'

    def R(y, x):
        return region[y][x] if 0 <= y < H and 0 <= x < W else '.'

    def setr(y, x, r):
        if 0 <= y < H and 0 <= x < W:
            region[y][x] = r

    # 머리 모양
    hair = 'A' if stage == 'old' else 'h'
    for y in range(ht, ht + 19):
        for x in range(W):
            if region[y][x] != 'h':
                continue
            rel = y - ht
            side = min(x, W - 1 - x)
            if stage == 'old' and sex == 'M':
                # 할아버지: 이마가 넓어지고 옆머리만 희다
                region[y][x] = 'A' if side <= 7 and rel >= 4 else 's'
            elif stage == 'middle':
                # 뒷모습은 귀 위 관자놀이만 희끗하다(옆머리 전체가 희면 헤드폰처럼 보인다, decisions.md 196번)
                if view == 'back':
                    region[y][x] = 'G' if side <= 6 and 8 <= rel <= 11 else 'h'
                else:
                    region[y][x] = 'G' if side <= 6 and rel >= 4 else 'h'
            else:
                region[y][x] = hair
    if sex == 'F':
        long_to = {'baby': -1, 'child': 17, 'adult': 23, 'middle': 23, 'old': 15}[stage]
        if view == 'back':
            # 뒷모습의 긴 머리는 어깨를 조금 넘는 데서 끝난다 (decisions.md 197번)
            long_to = min(long_to, 20)
        side_hair = 'A' if stage == 'old' else 'h'
        for rel in range(6, long_to + 1):
            for x in (3, 4, 5, 6):
                if rel <= 18 and region[ht + rel][x] not in ('.', 'h', 'G', 'A') and x >= 6:
                    continue
                if rel > 18 and x == 3:
                    continue
                setr(ht + rel, x, side_hair)
                setr(ht + rel, W - 1 - x, side_hair)
        if stage == 'middle':
            for rel in range(8, 22):
                setr(ht + rel, 4, 'G')
                setr(ht + rel, W - 5, 'G')
        if stage == 'old':
            # 쪽 찐 머리
            for dy, xs in ((-3, range(14, 18)), (-2, range(13, 19))):
                for x in xs:
                    setr(ht + dy, x, 'A')
    # 지팡이: 오른손에서 바닥까지. 팔을 쓰는 자세에서는 내려놓는다
    if sex == 'F' and view == 'back' and stage in ('child', 'adult', 'middle'):
        # 뒷모습의 긴 머리: 목덜미를 덮고 어깨 아래에서 둥글게 끝난다 (decisions.md 197번)
        to = 20 if stage == 'child' else 21
        for y in range(ht + 18, ht + to + 1):
            inset = 1 if y == ht + to else 0
            for x in range(9 + inset, W - 9 - inset):
                setr(y, x, 'h')
    if stage == 'old' and pose == 'stand' and view == 'front':
        hand = next(y for y in range(ht + 20, H) if R(y, sx(W - 4)) == 's')
        cane = sx(W - 4) + 2
        for y in range(hand - 2, H - 1):
            setr(y, cane, 'Z')
        setr(hand - 3, cane - 1, 'Z')
        setr(hand - 3, cane, 'Z')

    # 자세 (decisions.md 192번): 늘어뜨린 팔을 지우고 자세에 맞는 팔을 다시 그린다. 명암·윤곽은 아래에서 함께 입힌다.
    cross = []
    if stage != 'baby' and pose != 'stand' and view == 'front':
        cross = apply_pose(region, ht, pose)

    # 명암
    g = [row[:] for row in region]
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
            out_, shade, base, light = RAMP[r]
            for i in range(x, e):
                c = base
                if n >= 4 and i == x:
                    c = light
                if n >= 6 and i >= e - 2:
                    c = shade
                if R(y + 1, i) != r and r in ('c', 'p', 'B') + HAIRS:
                    c = shade
                if r == 's' and R(y - 1, i) in HAIRS:
                    c = shade
                if R(y - 1, i) == '.' and i < W // 2 + 2 and c == base:
                    c = light
                g[y][i] = c
            x = e

    # 부위별 색 윤곽
    for y in range(H):
        for x in range(W):
            if region[y][x] != '.':
                continue
            for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                r = R(y + dy, x + dx)
                if r != '.':
                    g[y][x] = RAMP[r][0]
                    break

    def put(y, x, ch, only=None):
        if 0 <= y < H and 0 <= x < W and (only is None or region[y][x] in only):
            g[y][x] = ch

    def fill(y, xs, ch, only=None):
        for x in xs:
            put(y, x, ch, only)

    # 가슴 앞으로 모은 팔: 옷 위에 팔뚝 윤곽을 한 줄 그어 몸통과 갈라 보이게 한다
    for y, x in cross:
        put(y, x, 'q', ('c', 'w', 't'))

    # 머리카락 결과 윤기
    dark = {'h': 'j', 'G': 'J', 'A': 'U'}
    shine = {'h': 'i', 'G': 'I', 'A': 'Q'}
    for rel, x0 in ((3, 9), (4, 8), (5, 7), (6, 7), (4, 22), (5, 23), (6, 24), (7, 24), (2, 15), (3, 15), (3, 16)):
        x = sx(x0)
        r = R(ht + rel, x)
        if r in HAIRS:
            put(ht + rel, x, dark[r])
    for rel, xs in ((3, (11, 12, 13)), (4, (10, 11)), (3, (19, 20))):
        for x in xs:
            r = R(ht + rel, x)
            if r in HAIRS:
                put(ht + rel, x, shine[r])
    # 앞머리 결. 뒷모습에서는 이 점들이 얼굴처럼 보여 찍지 않는다 (decisions.md 197번).
    for rel, x in ((9, 15), (9, 16), (10, 11), (10, 20), (10, 12), (10, 19)) if view != 'back' else ():
        r = R(ht + rel, x)
        if r in HAIRS:
            put(ht + rel, x, dark[r])
    if view == 'back':
        # 뒷모습: 목덜미 그늘만
        fill(ht + 19, range(13, 19), 'S', 's')
        return ht, [''.join(r) for r in g]
    if stage == 'baby':
        # 아기 얼굴: 작은 머리에 맞춘 2×2 눈(왼쪽 위 반짝임), 볼, 입, 목 그늘
        for ex in (11, 19):
            for rel in (4, 5):
                fill(ht + rel, [ex, ex + 1], 'k')
            put(ht + 4, ex, 'E')
        fill(ht + 6, [10, 21], 'r')
        fill(ht + 7, [15, 16], 'm')
        fill(ht + 10, range(13, 19), 'S', 's')
        # 배냇머리는 몸통에 그리지 않는다. 아이마다 다른 모양을 겹으로 얹는다(pixel/babyHair.ts, decisions.md 178번).
        if sex == 'F':
            # 딸: 옆머리에 작은 리본 하나(나비 두 날개와 매듭)
            for y, x, ch in ((0, 20, '7'), (0, 21, '8'), (0, 23, '8'), (0, 24, '7'), (1, 20, '7'), (1, 21, 'R'), (1, 22, '7'), (1, 23, 'R'), (1, 24, '7'), (2, 21, '7'), (2, 23, '7')):
                put(ht + y, x, ch)
        return ht, [''.join(r) for r in g]
    # 귀 안쪽 그늘
    fill(ht + 13, [7, 24], 'S', 's')
    # 눈: 3×3 까만 눈동자, 왼쪽 위 반짝임, 아래 한 줄은 갈색 반사
    for ex in (10, 19):
        for rel in (12, 13, 14):
            fill(ht + rel, [ex, ex + 1, ex + 2], 'k')
        put(ht + 13, ex, 'E')
        fill(ht + 15, [ex, ex + 2], 'f')
        put(ht + 15, ex + 1, 'e')
    # 볼 홍조, 코, 입
    fill(ht + 16, [8, 9, 22, 23], 'r')
    put(ht + 16, 16, 'S')
    fill(ht + 17, [15, 16], 'm')
    # 턱 아래 목 그늘
    fill(ht + 19, range(12, 20), 'S', 's')
    # 나이 주름: 중년은 눈가, 노년은 눈가와 팔자
    if stage in ('middle', 'old'):
        put(ht + 12, 8, 'S')
        put(ht + 12, 23, 'S')
    if stage == 'old':
        put(ht + 17, 12, 'S')
        put(ht + 17, 19, 'S')
        put(ht + 11, 9, 'S')
        put(ht + 11, 22, 'S')
    # 소매 주름과 소매 끝: 손 줄 바로 위까지 옷이면 소매다
    if pose != 'stand':
        return ht, [''.join(r) for r in g]
    hand_rows = [y for y in range(ht + 20, H) if R(y, W // 2 - 1) != '.' and region[y][next(x for x in range(W) if region[y][x] != '.')] == 's']
    if hand_rows:
        hy = hand_rows[0]
        left = next(x for x in range(W) if region[hy][x] != '.')
        right = left
        while region[hy][right + 1] == 's':
            right += 1
        fold = right + 1
        for y in range(ht + 20, hy):
            if region[y][left] == 'c' and region[y][fold] == 'c':
                put(y, fold, 'd')
                put(y, W - 1 - fold, 'q')
        fill(hy - 1, range(left, right + 1), 'd', 'c')
        fill(hy - 1, range(W - 1 - right, W - left), 'd', 'c')
        put(hy + 1, right, 'S', 's')
        put(hy + 1, W - 1 - right, 'S', 's')
    return ht, [''.join(r) for r in g]


def main():
    out = [
        "import type { Sex } from '../../../api/client'",
        "import type { AgeStage, Pose } from './bodies'",
        "import type { Body } from './sprite'",
        '',
        '/** 생성된 파일: frontend/scripts/pixel/bodies.py가 쓴다. 손으로 고치지 말고 스크립트를 고쳐 다시 만든다 (decisions.md 142번). */',
        'export const BODY_MAPS: Record<Sex, Record<AgeStage, Body>> = {',
    ]
    used = set()
    for sex in ('M', 'F'):
        out.append(f'  {sex}: {{')
        for stage in ('baby', 'child', 'adult', 'middle', 'old'):
            ht, rows = build(stage, sex)
            assert all(len(r) == W for r in rows) and len(rows) == H
            used |= set(''.join(rows))
            out.append(f'    {stage}: {{')
            out.append(f'      headTop: {ht},')
            out.append('      map: [')
            out += [f"        '{r}'," for r in rows]
            out.append('      ],')
            out.append('    },')
        out.append('  },')
    out.append('}')
    out.append('')
    out.append('/** 자세별 몸통 (decisions.md 192번). 서 있는 자세는 BODY_MAPS다. 아기는 자세가 없다. */')
    out.append("export const POSE_MAPS: Record<Exclude<Pose, 'stand'>, Record<Sex, Partial<Record<AgeStage, Body>>>> = {")
    for pose in POSES[1:]:
        out.append(f"  '{pose}': {{")
        for sex in ('M', 'F'):
            out.append(f'    {sex}: {{')
            for stage in ('child', 'adult', 'middle', 'old'):
                ht, rows = build(stage, sex, pose)
                assert all(len(r) == W for r in rows) and len(rows) == H
                used |= set(''.join(rows))
                out.append(f'      {stage}: {{')
                out.append(f'        headTop: {ht},')
                out.append('        map: [')
                out += [f"          '{r}'," for r in rows]
                out.append('        ],')
                out.append('      },')
            out.append('    },')
        out.append('  },')
    out.append('}')
    out.append('')
    out.append('/** 뒷모습 (decisions.md 196·199번). 아기는 없다. */')
    out.append("export const VIEW_MAPS: Record<'back', Record<Sex, Partial<Record<AgeStage, Body>>>> = {")
    for view in ('back',):
        out.append(f"  {view}: {{")
        for sex in ('M', 'F'):
            out.append(f'    {sex}: {{')
            for stage in ('child', 'adult', 'middle', 'old'):
                ht, rows = build(stage, sex, 'stand', view)
                assert all(len(r) == W for r in rows) and len(rows) == H
                used |= set(''.join(rows))
                out.append(f'      {stage}: {{')
                out.append(f'        headTop: {ht},')
                out.append('        map: [')
                out += [f"          '{r}'," for r in rows]
                out.append('        ],')
                out.append('      },')
            out.append('    },')
        out.append('  },')
    out.append('}')
    here = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(here, '..', '..', 'src', 'features', 'game', 'pixel', 'bodyMaps.ts')
    with open(target, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')
    print('codes', ''.join(sorted(used - {'.'})), file=sys.stderr)


if __name__ == '__main__':
    main()
