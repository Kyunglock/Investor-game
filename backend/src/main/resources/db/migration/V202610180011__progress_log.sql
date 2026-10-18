-- 인생 기록. 진행이 사건을 조율하는 자리에서 자기 테이블에 쓴다. 숨은 값(방향·변동 폭)은 넣지 않는다.
-- (docs/superpowers/specs/2026-10-18-ui-redesign-design.md 6절)
CREATE TABLE progress_log (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_id    UUID        NOT NULL,
    game_day   INTEGER     NOT NULL,
    kind       TEXT        NOT NULL,
    payload    JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX progress_log_game_idx ON progress_log (game_id, id);

-- 한 해를 마친 시점의 자산. 인생 지도와 자산 곡선용.
CREATE TABLE progress_year (
    game_id     UUID     NOT NULL,
    age         SMALLINT NOT NULL,
    total_asset BIGINT   NOT NULL,
    cash        BIGINT   NOT NULL,
    PRIMARY KEY (game_id, age)
);
