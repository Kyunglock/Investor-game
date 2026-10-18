-- 가계 도메인: 결혼·은퇴 상태와 자녀 (경제 개편 설계 7.1절). 지출 금액은 저장하지 않고 설정으로 계산한다.
CREATE TABLE household_state (
    game_id     UUID        PRIMARY KEY,
    married_day INTEGER,
    retired_day INTEGER,
    updated_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE household_child (
    game_id   UUID     NOT NULL,
    seq       SMALLINT NOT NULL,
    birth_day INTEGER  NOT NULL,
    PRIMARY KEY (game_id, seq)
);
