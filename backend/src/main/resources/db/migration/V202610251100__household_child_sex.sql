-- 자녀 성별 (decisions.md 69번). 태어날 때 굴린다. 이미 있던 아이는 홀수째 아들, 짝수째 딸로 채운다.
ALTER TABLE household_child ADD COLUMN sex TEXT NOT NULL DEFAULT 'M' CHECK (sex IN ('M', 'F'));
UPDATE household_child SET sex = 'F' WHERE seq % 2 = 0;
ALTER TABLE household_child ALTER COLUMN sex DROP DEFAULT;
