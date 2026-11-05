# 3단계: 회사 건물·객장 그림과 직원 차림새

> 설계: [증권사 육성 설계](../specs/2026-11-05-brokerage-raising-design.md) 8절
> 구현한 결정: [decisions.md](../../decisions.md) 213·214번
> 앞 단계: [2단계 아주 작은 회사](./2026-11-05-stage2-tiny-company.md)

- 화면만 바뀐다. 서버·계약은 그대로다.
- `features/raising/office.ts`: 등급 → 건물 단계·객장 소품·손님 수·차림새·빛·글 설명. 순수 함수라 단위 테스트로 본다.
- `features/raising/OfficeArt.tsx`: 간판 줄(5칸) + 사무실(26칸) + 객장(26칸) 단면. 기존 도트 체계(`Person`, `PALETTE`, `toRuns`)를 쓴다. 사람 그림에 `recolor`를 더해 차림새 색을 입힌다.
- 남은 것: 이사 장면과 축하 화환, 결산 전광판 (8.3절)
