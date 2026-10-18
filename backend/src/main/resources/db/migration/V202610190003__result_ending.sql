-- 엔딩 종류 (decisions.md 27번). NORMAL은 종료 나이 도달, BANKRUPT는 총자산이 0 아래로 떨어진 달의 파산.
ALTER TABLE result_game ADD COLUMN ending TEXT NOT NULL DEFAULT 'NORMAL';
