# 캐주얼 멘탈 디펜스 자산

내장 image_gen 도구로 승인한 캐주얼 시안을 참조하여 제작했습니다. PNG 원본을 보관하며 hero/enemies는 투명 배경입니다. 게임에서 독립적으로 조준·충돌·피격하도록 장면 전체가 아닌 각 요소를 분리했습니다.

참조: [승인 시안](../../../../docs/mockups/2026-11-08-mental-wall-concept/mental-wall-v2-casual.png).

- street.png: 전장 배경
- hero.png: 몸·머리·꼬리. 총과 두 앞발은 drawStageGun.ts에서 회전 렌더링
- enemies.png: 2×2 아틀라스. 좌상 패닉, 우상 투매, 좌하 투기, 우하 손절

원본의 여백은 런타임에서 알파값으로 측정하고 한 번만 캐시합니다. 충돌 반지름·총구 좌표는 코드에서 관리합니다.

## 최종 생성 프롬프트

### street.png

transparent_background: false

Edit this approved casual game reference into ONLY its empty playable background environment, a production mobile game background. Preserve the cute flat/cel-shaded mint toy city visual style and 9:16 portrait framing, clean warm outlines, cream walls, blue roofs. REMOVE ALL HUD, all text, all characters/enemies/cat, all projectiles/effects, the whole mental wall and pillars, all icons and bottom buttons. Fill their former areas with uninterrupted clean pale mint ground. The playable central 78% width must be open uniform mint space from top to bottom. Decorative building façades, tiny trees, shop awnings and bushes hug ONLY the outermost 11% on each side, gracefully clipped by screen edges. Top-down elevated orthographic view, no horizon, no sky, no vanishing point. Much simpler than painterly illustration: flat fields of color, one restrained cel-shade, small contact shadows, few sparse short grass marks. Keep decorations low contrast against clear central lane. No objects in the central lane. No UI or border. This must be a reusable entire arena background behind independently animated sprites, not a screenshot.

### hero.png

transparent_background: true

Create a production game character sprite based on ONLY the small cream boss cat in the approved reference. One character centered on a truly transparent canvas, square composition, entirely visible with generous 15% transparent margins. Preserve the reference's slim cream cat body, pointed ears, small eyes, tiny mouth, curved tail, warm brown clean outlines, flat warm cream fur and one subtle cel shade. Friendly determined face, NOT obese or oversized head, no clothing or accessories. Elevated three-quarter/front view exactly like the reference bottom cat. The little body stands facing forward with its head slightly turned toward screen-upper-right, tiny feet apart. Crucially OMIT THE ENTIRE GUN and BOTH FRONT ARMS/PAWS: the game draws a separate rotating weapon with both paws on top of the torso. The torso must be clean and unobstructed, with no hands, no stumps, no floating limb fragments. Draw only head, ears, neck, body, legs, feet, tail. It should be a coherent cute resting cat sprite base. No background, ground, shadow, platform, effects, text, frame or extra characters. Simple premium casual 2D mobile sprite, same style as reference, crisp medium brown outline.

### enemies.png

transparent_background: true

Create a production game enemy sprite atlas based on the approved casual defense reference. A square image with a precise 2 by 2 grid of FOUR separate characters on a truly TRANSPARENT background. No grid lines, no labels or text, no UI, no scenery. Each character is centered within its own quadrant, contained inside the central 65% of that quadrant with generous empty margin. Each quadrant's center must be exactly 25%/75% image width and height, ensuring independent cropping into four equal squares. All feet align at same relative height within quadrants. Match the reference's clean moderately dark colored outlines, pastel flat/cel fills, tiny feet and expressive simple brows.
TOP LEFT: small blue teardrop panic enemy, pointed top, worried tiny eyes and downturned mouth, little hands/feet. TOP RIGHT: lavender rounded selloff creature with two rounded ear bumps, frowning brows, short arms, downward cream zigzag arrow on tummy. BOTTOM LEFT: coral round speculation creature with subtle scalloped head bumps, angry confident brows, short arms/feet, upward cream zigzag arrow on belly. BOTTOM RIGHT: pale slate gray worried rounded creature with tiny ears, tired frown and small scribble above forehead, hands held near cheeks, no shield or barrier. Each is ONE coherent sprite and fully separate. The coral sprite is slightly larger but fits same cell margins. No drop shadows, particles, disconnected decoration beyond cell, weapons, hearts or backdrop. Not glossy 3D, not painterly. Four distinctive readable animateable sprite silhouettes.
