# 캐주얼 멘탈 디펜스 자산

내장 image_gen 도구로 승인한 캐주얼 시안을 참조하여 제작했습니다. PNG 원본을 보관하며 hero/enemies는 투명 배경입니다. 게임에서 독립적으로 조준·충돌·피격하도록 장면 전체가 아닌 각 요소를 분리했습니다.

참조: [승인 시안](../../../../docs/mockups/2026-11-08-mental-wall-concept/mental-wall-v2-casual.png).

- toy-arena.png: 현재 전장 배경. 2026-11-10 승인한 B안의 크림색 장난감 보드로 교체했다. 벽·몹·HUD를 제외한 배경만 image_gen으로 제작했다.
- street.png: 이전 민트 거리 배경 원본 (현재 미사용)
- hero-toy.png: B안의 둥근 크림색 장난감 고양이 뒷모습. 총과 두 앞발은 drawStageGun.ts에서 회전 렌더링하며 준비 화면도 같은 결합점을 사용한다.
- hero.png: 이전 고양이 원본 (현재 미사용)
- enemies.png: 2×2 아틀라스. 좌상 패닉, 우상 투매, 좌하 투기, 우하 손절
- wall-blocks-toy.png: B안의 표면 입자·둥근 모서리·양각 그래프를 유지한 블록 아틀라스. 위쪽 매수 / 아래쪽 매도, 왼쪽 정상 / 오른쪽 균열. 벽은 여섯 블록으로 조합한다.

원본의 여백은 런타임에서 알파값으로 측정하고 한 번만 캐시합니다. 충돌 반지름·총구 좌표는 코드에서 관리합니다.

## 최종 생성 프롬프트

### wall-blocks-toy.png

내장 image_gen 사용, transparent_background: true. 참조: `docs/mockups/2026-11-10-toy-arena/concept-b.png`.

Create ONE production transparent game sprite atlas, square canvas divided into EXACT equal 2x2 invisible cells. Source reference is the approved B concept: faithfully match the chunky coral SELL wall and aqua BUY wall block material, not a reinterpretation. Four isolated SINGLE wall blocks, one per quadrant, each centered at 25%/75% canvas coordinates and fitting central 78% of its cell, no overlap. Top left: intact aqua/teal buy block with ONE short ivory cylindrical peg on the top, three ascending raised teal volume bars embossed on its front. Top right: same aqua block, same peg, same size/camera/lighting, with a substantial branching crack and one tiny chipped corner but no detached debris. Bottom left: intact coral salmon sell block, no peg, three small ascending raised coral volume bars on front. Bottom right: same coral block, same size/camera/lighting with a branching fracture and a chipped corner, no detached debris. Material and shape CRITICAL: thick squishy-looking matte molded toy blocks like the reference, broad strongly rounded bevels, softly illuminated top face, visible chunky right side and lower edge, fine subtle foam/clay grain, soft ambient occlusion at edges and relief marks. Orthographic elevated near-front view, front face dominant, top face clearly visible, small right side visible. No bright white outlines, no flat vector style, no thin luminous stroke, no glossy glass, no flat UI button look. Warm soft studio lighting upper left. Consistent scale between cells, approximately square blocks (buy peg adds a little height). Truly transparent alpha background. No ground plane, no cast shadow outside block, no text, labels, numbers, characters, coins, dividers, borders or additional objects. All four blocks are SEPARATE reusable game sprites, not assembled into a wall.

### hero-toy.png

내장 image_gen 사용, transparent_background: true. 참조: `docs/mockups/2026-11-10-toy-arena/concept-b.png`.

Create a production transparent sprite of EXACTLY the little cream tabby CAT at the bottom of the supplied approved B concept. Reference is the identity, pose and material target. Isolate and faithfully recreate only its BODY, at much higher resolution. ONE single centered character, square transparent canvas with 15% margin. Rear view, facing screen UP away from viewer, slightly elevated three-quarter overhead camera as in reference. Broad rounded cream head, two small triangular ears with warm inner ears, THREE short orange tabby stripes on the BACK of the head, plump tiny pear-shaped torso, two stubby planted back feet, thick short curved striped tail curled toward lower left. Soft clay/plastic toy 2.5D rendering with warm brown outlines, cream ivory highlights, golden beige shading, round smooth cheeks silhouette, charming little proportions. No face visible because BACK faces camera. MATCH reference closely, not a slim standing cat, not an anime face portrait. Crucial modular sprite constraint: OMIT THE GUN and BOTH FRONT PAWS/ARMS entirely (the game renders them as a rotating separate part at right shoulder). Keep the body and head intact and natural, no visible stumps, no floating parts. No clothing, scarf, backpack or extra accessories. No scene, ground, cast shadow, coins, UI, text, numbers, effects, or other sprites. Truly transparent alpha background, not a checkerboard painted behind the character.

### toy-arena.png

B안의 따뜻한 크림색 바닥과 양쪽 가장자리의 코인·거래량 블록을 유지한다. 중앙은 전투용 빈 공간이며 캐릭터, 글자, 벽, 탄환, HUD는 포함하지 않는다. 승인 시안은 `docs/mockups/2026-11-10-toy-arena/concept-b.png`에 보관한다.

매수벽은 `stageArt.ts`의 청록색 블록을 기존 방어벽 충돌 영역에 그린다. 매도벽은 산호색 블록 질감으로 표현하며 최신 전투의 물량·탄환 충돌·균열 단계를 그대로 따른다. 매수벽도 기존 단일 체력과 재건·지원 사격을 유지한다. 방패병은 협의 보류로 포함하지 않는다.

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
