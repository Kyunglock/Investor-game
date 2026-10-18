-- 시장 도메인: 종목 현재가와 월별 이력 (경제 개편 설계 5.5절). 숨은 값은 없다. 다음 달 변동은 저장하지 않고 처리할 때 판 시드로 만든다.
CREATE TABLE market_price (
    game_id    UUID        NOT NULL,
    stock_code TEXT        NOT NULL,
    price      BIGINT      NOT NULL,
    month      INTEGER     NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (game_id, stock_code)
);

-- (game_id, stock_code, month)가 PK라서 같은 달을 두 번 처리하지 않는다 (멱등).
CREATE TABLE market_price_history (
    game_id    UUID    NOT NULL,
    stock_code TEXT    NOT NULL,
    month      INTEGER NOT NULL,
    price      BIGINT  NOT NULL,
    PRIMARY KEY (game_id, stock_code, month)
);
