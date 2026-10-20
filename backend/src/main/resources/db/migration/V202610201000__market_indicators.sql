-- 거시 지표(환율·가계부채 증가율·투자 심리·거래대금)의 월별 이력 (매매창 설계 3.1절). 표시만 하고 가격에는 영향이 없다.
-- (game_id, month, code) PK로 같은 달을 두 번 처리하지 않는다.
CREATE TABLE market_indicator_history (
    game_id UUID    NOT NULL,
    month   INTEGER NOT NULL,
    code    TEXT    NOT NULL,
    value   BIGINT  NOT NULL,
    PRIMARY KEY (game_id, month, code)
);
