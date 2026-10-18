-- 뉴스의 매매 대상 종목과 충격 범위 (경제 개편 설계 5.4절). 알림(NOTICE)은 만들어질 때 RESOLVED로 들어간다.
ALTER TABLE event_instance
    ADD COLUMN stock_code  TEXT,
    ADD COLUMN sector_wide BOOLEAN NOT NULL DEFAULT FALSE;
