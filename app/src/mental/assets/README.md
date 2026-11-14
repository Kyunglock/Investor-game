# 캐주얼 멘탈 디펜스 자산

내장 image_gen 도구로 승인한 캐주얼 시안을 참조하여 제작했습니다. PNG 원본을 보관하며 hero/enemies는 투명 배경입니다. 게임에서 독립적으로 조준·충돌·피격하도록 장면 전체가 아닌 각 요소를 분리했습니다.

참조: [승인 시안](../../../../docs/mockups/2026-11-08-mental-wall-concept/mental-wall-v2-casual.png).

- toy-arena.png: 현재 전장 배경. 2026-11-10 승인한 B안의 크림색 장난감 보드로 교체했다. 벽·몹·HUD를 제외한 배경만 image_gen으로 제작했다.
- street.png: 이전 민트 거리 배경 원본 (현재 미사용)
- hero-upward.png: 승인한 옆으로 튼 고양이·상향 총·두 앞발 원본. 준비 화면과 전투 모두 분리·재작화 없이 그대로 쓴다. 포즈는 고정하고 탄환의 수동·자동 조준은 기존대로다. 장착 무기의 등급·종류별 피해·탄환 효과도 유지한다.
- cat-fold-gun-mask.png / cat-fluffy-gun-mask.png: 위 두 원본에서 총 자리만 뽑은 마스크(흰색 = 총). 굽는 때에 원본에서 이만큼 지우고 든 무기를 얹는다 (decisions.md 511번). 원본을 바꾸면 다시 만든다.
- cat-fold-upward.png / cat-fluffy-upward.png: 승인한 접힌 귀·장모 고양이. 기존 동료 카드와 최대 세 마리 규칙을 유지하며 접힌 귀 → 장모 → 접힌 귀 순서로 사용한다. 색상 합성은 하지 않는다.
- 세 모델은 같은 높이와 발 기준선으로 그린다. 장모의 넓은 꼬리 때문에 몸 전체를 축소하지 않는다.
- hero-toy.png: 이전 무기 없는 몸통 (현재 미사용).
- hero.png: 이전 고양이 원본 (현재 미사용)
- enemies.png: 2×2 아틀라스. 좌상 패닉, 우상 투매, 좌하 투기, 우하 손절
- wall-blocks-toy.png: B안의 표면 입자·둥근 모서리를 유지하고 앞면의 차트 그림을 제거한 블록 아틀라스. 위쪽 매수 / 아래쪽 매도, 왼쪽 정상 / 오른쪽 균열. 벽은 여섯 블록으로 조합한다.

원본의 여백은 런타임에서 알파값으로 측정하고 한 번만 캐시합니다. 충돌 반지름·총구 좌표는 코드에서 관리합니다.

## 최종 생성 프롬프트

상향 포즈 세 원본은 내장 image_gen으로 만든 승인 시안을 그대로 복사했다. 생성 프롬프트: [사장냥](../../../../docs/mockups/2026-11-12-approved-cat-models/hero-prompt.txt), [동료](../../../../docs/mockups/2026-11-12-approved-cat-models/companion-prompts.txt). 날씬한 고양이는 제외했다.

### wall-blocks-toy.png

내장 image_gen 편집 사용, transparent_background: true. 편집 대상은 기존 `wall-blocks-toy.png`이며, 정상·균열 네 블록 모두의 양각 차트를 제거했다. 투명 배경과 2×2 배치는 유지한다.

Edit target: the attached existing production game sprite atlas. Precise-object-edit. Remove ONLY the embossed three-bar chart symbols from the front faces of ALL FOUR blocks, replacing the symbols and their shadows with seamless matching plain textured material. Preserve everything else as closely as possible: the exact 2 by 2 grid, quadrant positions, transparent margins and background, the silhouettes and dimensions of each block, perspective, mint turquoise top two blocks with cream cylinder on top, coral orange bottom two blocks, rounded edges, highlights, fine plastic/clay grain texture, and especially the existing deep cracks on both RIGHT-hand blocks. The two left blocks stay intact, the two right blocks stay cracked. No charts, bars, arrows, pictograms, letters, numbers, new objects or decorations. This will replace the existing game texture and must retain the same 2x2 atlas layout with each sprite wholly within its quadrant. Truly transparent alpha background. Output one edited atlas.

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

## 공매도 웨이브 몬스터

`short-seller.png`는 내장 image_gen 도구로 생성한 투명 PNG다. 기존 `enemies.png`를 화풍 참조로 사용했다. 남색 후드와 하락 화살표 방패, 분리된 두 발을 가진 전용 몹이며, 기존 몹의 색만 바꾼 것이 아니다. `art.ts`에서 8프레임 걷기 동작을 굽는다. 생성 프롬프트는 `short-seller.prompt.txt`에 보관한다.

패닉셀 → 투매 → 공매도 웨이브는 방어전과 매도벽 돌파전에서 전투 시간 15초마다 반복한다. 공매도는 체력 9, 속도 43, 접촉 피해 11의 두 줄 대열이다. 일시정지·카드 선택·서킷브레이커 중에는 웨이브 시계가 멈춘다. `APP_URL=http://127.0.0.1:5307/app/ node scripts/waveCheck.mjs`로 두 모드의 등장 순서를 확인한다.

### C안 무기 장착 (2026-11-13)

`weapon-arcade-atlas.png`는 승인한 C ARCADE 시안의 4열 × 3행 투명 원본이다. 왼쪽부터 F, E, D, C / B, A, S, SS / SSS, SR, UR, LR 순서다. `weaponArt.ts`가 셀의 투명 여백만 제외해 목록과 전투에 같은 그림을 사용한다.

`hero-unarmed.png`는 `hero-upward.png`에서 고정 총만 제거한 원본이다. 팔과 자세를 유지하며, 장착 무기를 손 위치에 합성한다. 대기·공격·피격·걷기·준비 화면이 같은 합성 함수를 사용한다. 기존 원본은 보관한다. 무기 그림의 출처는 사용자 승인 시안을 바탕으로 한 이미지 생성이며, 원본 파일을 임의로 잘라 덮어쓰지 않는다.

## 분리형 사격 자세

`cat-rig-bodies.png`: 기존 사장냥·접힌 귀·장모 고양이를 참고해 만든 3열 몸통 아틀라스. 총과 올라간 앞발을 제거하고 배경을 투명하게 정리했다. 원본 자산은 보존한다.

전투에서는 `art.ts`가 몸과 총·두 앞발을 별도로 굽는다. `catGun.ts`의 어깨 축·총구 길이 계산을 조준, 반동, 총구 화염, 탄 생성이 공유한다. 몸 전체의 조준 회전·반동 확대축소는 하지 않는다. 무기 등급이 바뀌면 별도 무기 텍스처만 교체하고, 동료를 해제하면 무기 이미지도 제거한다.

## 전투 시점의 총 윗면

`weapon-battle-top-atlas.png`는 기존 무기 색상·등급을 참고해 생성한 4열 × 3행의 전투 전용 윗면 아틀라스다. F~LR 순서이며 총열은 오른쪽, 손잡이·방아쇠는 총몸 아래에 가려진 모습이다. `battleWeaponArt.ts`에서 앞발을 먼저 그리고 그 위에 총 윗면을 얹는다. 전투와 준비 화면이 같은 그림과 총구 좌표를 사용한다. 인벤토리·뽑기용 측면 무기 그림은 기존 자산을 사용한다.
