-- 가족 점수 (decisions.md 88번). 0~100, 처음 50. 가족을 챙기는 선택은 올리고 거절·방치는 내린다. 행복도와 달리 저절로 돌아오지 않는다.
ALTER TABLE household_state ADD COLUMN family SMALLINT NOT NULL DEFAULT 50;
