"""고양이 카드 초상화만 모은 작은 아틀라스를 만든다.

카드·뽑기 화면이 얼굴 하나를 그리려고 1~2MB짜리 전투 원본(roster)을 통째로 받지 않게 한다.
원본(cat-portraits.png, roster/*.png, catRosterFrames.json)이 바뀌면 다시 돌린다.

    cd app && python3 scripts/catFaceAtlas.py
"""

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'src'
IDLE = ROOT / 'idle' / 'assets'
MENTAL = ROOT / 'mental'
CELL = 256  # 가장 크게 그리는 뽑기 결과(150px)를 고해상도 화면에서도 선명하게
COLS = 8

# 기존 초상화: cat-portraits.png의 4×2 칸 순서. 사장냥은 code가 없어 'boss'로 둔다.
OLD = ['boss', 'sky', 'mint', 'lilac', 'sunset', 'night', 'snow']
# catRoster.ts의 NEW_CATS 순서. atlas = i // 3, slot = i % 3.
NEW = [
    'caramel', 'mocha', 'peach', 'silver', 'panda', 'biscuit', 'ocean', 'lemon', 'cocoa',
    'rose', 'tiger', 'cloud', 'star', 'siam', 'tilt', 'russet', 'sage', 'apricot',
    'plum', 'patch', 'drowsy', 'coral', 'truffle', 'frost', 'butter', 'terra', 'wisteria',
    'odd', 'pistachio', 'sand', 'blush', 'petrol', 'oat',
]
ROSTER = [
    'cats-08-10', 'cats-11-13', 'cats-14-16', 'cats-17-19', 'cats-20-22', 'cats-23-25',
    'cats-26-28', 'cats-29-31', 'cats-32-34', 'cats-35-37', 'cats-38-40',
]

crops = []
old = Image.open(IDLE / 'cat-portraits.png').convert('RGBA')
side = old.width // 4
for i, code in enumerate(OLD):
    x, y = (i % 4) * side, (i // 4) * side
    crops.append((code, old.crop((x, y, x + side, y + side))))

frames = json.loads((MENTAL / 'catRosterFrames.json').read_text())
sheets = [Image.open(MENTAL / 'assets' / 'roster' / f'{name}.png').convert('RGBA') for name in ROSTER]
for i, code in enumerate(NEW):
    atlas, slot = divmod(i, 3)
    sheet, frame = sheets[atlas], frames[atlas]
    assert sheet.size == (frame['width'], frame['height']), ROSTER[atlas]
    cell = frame['cells'][slot * 10]
    crops.append((code, sheet.crop((cell['x'], cell['y'], cell['x'] + cell['w'], cell['y'] + cell['h']))))

rows = -(-len(crops) // COLS)
out = Image.new('RGBA', (COLS * CELL, rows * CELL))
rects = {}
for i, (code, crop) in enumerate(crops):
    scale = min(1, CELL / crop.width, CELL / crop.height)
    w, h = round(crop.width * scale), round(crop.height * scale)
    if scale < 1:
        crop = crop.resize((w, h), Image.LANCZOS)
    x, y = (i % COLS) * CELL + (CELL - w) // 2, (i // COLS) * CELL + (CELL - h) // 2
    out.alpha_composite(crop, (x, y))
    rects[code] = {'x': x, 'y': y, 'w': w, 'h': h}

out.save(IDLE / 'cat-faces.webp', 'WEBP', quality=88, method=6)
(IDLE / 'cat-face-rects.json').write_text(
    json.dumps({'width': out.width, 'height': out.height, 'faces': rects}, indent=2) + '\n'
)
print(out.size, (IDLE / 'cat-faces.webp').stat().st_size, 'bytes')
