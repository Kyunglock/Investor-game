CREATE TABLE character_stat_log (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_id    UUID        NOT NULL,
    stat_code  TEXT        NOT NULL,
    delta      SMALLINT    NOT NULL,
    reason     TEXT        NOT NULL,
    event_id   UUID,
    game_day   INTEGER     NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX character_stat_log_game_idx ON character_stat_log (game_id, id);

-- 성향 이벤트의 선택을 점수로 누적한다 (specs/character.md 4.3절).
CREATE TABLE character_trait_score (
    game_id    UUID    NOT NULL,
    trait_code TEXT    NOT NULL,
    score      INTEGER NOT NULL,
    PRIMARY KEY (game_id, trait_code)
);
