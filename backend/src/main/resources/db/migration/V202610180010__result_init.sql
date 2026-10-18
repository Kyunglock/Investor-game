CREATE TABLE result_game (
    game_id         UUID        PRIMARY KEY,
    session_id      UUID        NOT NULL,
    content_version TEXT,
    initial_asset   BIGINT      NOT NULL,
    final_asset     BIGINT      NOT NULL,
    final_age       SMALLINT    NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ NOT NULL,
    stats_snapshot  JSONB       NOT NULL,
    summary         JSONB       NOT NULL
);

CREATE INDEX result_game_session_ended_idx ON result_game (session_id, ended_at DESC);
