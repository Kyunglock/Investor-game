# 고양이 총 40종

승인 시안은 `concepts-01-20.png`, `concepts-21-40.png`다. 01 사장냥과 기존 동료 02~07은 유지하고, 08~40을 신규 동료로 추가했다. 번호·코드·이름·체형·생성 설명은 `manifest.json`에 기록한다.

신규 이미지는 `app/src/mental/assets/roster/`의 투명 PNG 11장이다. 원본 한 장에 3종이 들어 있고, 각 고양이는 정면 초상화 1개와 좌60/45/30/15·중앙·우15/30/45/60의 9개 전투 자세를 가진다. 총은 기존 장착 무기를 런타임에서 합성한다. 생성 원본의 행 간격이 일정하지 않아 `catRosterFrames.json`의 실제 그림 좌표로 읽는다. 원본 이미지는 자르거나 색을 바꾸지 않고 보관했다.

내장 image_gen으로 승인 시안의 정체성과 기존 `cat-hero-poses.png`의 견착 자세를 참고했다. 08~10의 중앙 자세와 32~34의 눌린 체형은 image_gen 편집으로 보정했다. 생성 도구 외 외부 캐릭터 이미지는 사용하지 않았다. 별도 권리·유사성 검증을 의미하지 않는다.

기존 동료 6종의 코드, 순서, 능력치, 가중치(25/25/10/15/15/10), 보유 레벨과 장비는 유지한다. 신규 33종은 각각 가중치 10이고 기존 6개 능력치·스킬 유형을 순서대로 반복한다. 전체 가중치는 430으로, 기존 동료도 전체 뽑기 확률은 달라진다. 출전 슬롯 4개와 사장냥은 유지한다. 테스트판 전체 지급은 동료 39종을 대상으로 한다.

검증: 앱·웹 타입/단위 테스트/빌드, 서버 전체 테스트, `app/scripts/catRosterCheck.mjs`의 40개 초상화와 360개 무기 합성, `app/scripts/idleCheck.ts`의 전체 목록과 마지막 신규 동료 선택·출전. `in-game-*.png`는 실제 게임 렌더러의 합성 결과다.

## 공통 생성 프롬프트

```text
Produce a PRODUCTION transparent sprite atlas for Investor-game. Reference1 is approved identity selection sheet, reference2 is exact body/arm poses template. Exactly FIVE columns and SIX rows of equally sized cells, 30 total sprites. NO labels, grid, background, weapons, muzzle flash, shadows or effects. TRUE alpha transparency. Every sprite fully inside its cell with 10% margins. The 30 cells represent THREE cats, TEN consecutive cells per cat, reading left to right row by row. Each cat's first cell is a FRONT card portrait: big head + two little paws like reference1. Next NINE cells are full-body combat poses EXACTLY as reference2 reading its 3x3 sequence: aim -60,-45,-30,-15,0,+15,+30,+45,+60 degrees from screen up. Camera always elevated behind, feet planted, rear of head visible, body never turns front. Only extreme poses reveal one eye. Short arms positioned as if gripping/supporting a blaster, but DO NOT DRAW ANY GUN; game adds it behind the hands. Use same hand positions and body/head proportions as reference2. First four aim poses arms to left, last five to right. Full-body cats occupy same relative height and foot baseline. Thick warm dark brown outlines, soft rounded clay toy shading, tiny chunky body, short legs, no realistic fur. Match each identity's portrait and body. All three cats must be visibly distinct in ears, cheeks and tail. TWO full grid rows per cat: first row portrait + poses -60,-45,-30,-15; second row poses 0,15,30,45,60.
```
