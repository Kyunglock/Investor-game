-- 행복도 (decisions.md 82번). 0~100, 처음 50. 결혼·아이·여행·내 집은 올리고 실직·전세사기·긴축·큰 손실은 내린다. 달마다 50 쪽으로 1점 돌아온다.
ALTER TABLE household_state ADD COLUMN happiness SMALLINT NOT NULL DEFAULT 50;
