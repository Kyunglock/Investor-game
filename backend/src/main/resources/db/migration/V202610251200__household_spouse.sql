-- 배우자 소개 (decisions.md 77번). 결혼 카드에서 뽑힌 사람의 이름·직업·월 소득(25세 기준)·소개 문장. 옛 판은 비어 있고 소득은 설정값을 쓴다.
ALTER TABLE household_state ADD COLUMN spouse_name   TEXT;
ALTER TABLE household_state ADD COLUMN spouse_job    TEXT;
ALTER TABLE household_state ADD COLUMN spouse_income BIGINT;
ALTER TABLE household_state ADD COLUMN spouse_intro  TEXT;
