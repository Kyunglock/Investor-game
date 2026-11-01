-- 사용자가 정한 캐릭터 이름 (#176, decisions.md 135번). 아직 정하지 않았으면 NULL. 능력치로 짓던 별명 대신 이름 자리에 쓴다.
ALTER TABLE character_profile ADD COLUMN name VARCHAR(16);
