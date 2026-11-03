-- 한 판은 한 창만 (#189): 이 판을 진행하는 창(브라우저 탭)의 ID. 다른 창의 보고·선택은 409로 거절한다.
ALTER TABLE progress_game ADD COLUMN client_id VARCHAR(64);
