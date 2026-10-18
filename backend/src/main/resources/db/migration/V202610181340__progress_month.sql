-- 달마다 마친 총자산. 포트폴리오 카드의 "이번 달 손익"(전월 말 대비)용 (경제 개편 설계 11.1절).
CREATE TABLE progress_month (
    game_id     UUID    NOT NULL,
    month       INTEGER NOT NULL,
    total_asset BIGINT  NOT NULL,
    PRIMARY KEY (game_id, month)
);
