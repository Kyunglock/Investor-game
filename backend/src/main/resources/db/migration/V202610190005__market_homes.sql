-- 아파트 시세 지수(지역별)와 주담대 금리의 월별 이력 (주거 설계 2절). 현재 값은 가장 최근 달의 행이다. (game_id, …, month) PK로 같은 달을 두 번 처리하지 않는다.
CREATE TABLE market_home_history (
    game_id UUID    NOT NULL,
    region  TEXT    NOT NULL,
    month   INTEGER NOT NULL,
    price   BIGINT  NOT NULL,
    PRIMARY KEY (game_id, region, month)
);

CREATE TABLE market_rate_history (
    game_id UUID    NOT NULL,
    month   INTEGER NOT NULL,
    rate_bp INTEGER NOT NULL,
    PRIMARY KEY (game_id, month)
);
