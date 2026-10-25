-- 자녀가 독립해 집을 나가는 날 (decisions.md 68번). 태어날 때 정해진다. 그 뒤로는 양육비가 들지 않는다.
ALTER TABLE household_child ADD COLUMN leave_day INTEGER NOT NULL DEFAULT 0;
