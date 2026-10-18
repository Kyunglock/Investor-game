-- 투자 시작을 수락한 게임 일수. 투자 단계의 첫 뉴스 간격을 여기서부터 잰다.
ALTER TABLE progress_game ADD COLUMN investing_start_day INTEGER;
