CREATE TABLE progress_game (
    id                UUID        PRIMARY KEY,
    session_id        UUID        NOT NULL,
    status            TEXT        NOT NULL CHECK (status IN ('ACTIVE', 'ENDED', 'ABANDONED')),
    phase             TEXT        NOT NULL,
    last_reported_day INTEGER     NOT NULL,
    start_age         SMALLINT    NOT NULL,
    end_age           SMALLINT    NOT NULL,
    seed              BIGINT      NOT NULL,
    content_version   TEXT,
    version           INTEGER     NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL,
    updated_at        TIMESTAMPTZ NOT NULL,
    ended_at          TIMESTAMPTZ
);

CREATE INDEX progress_game_session_status_idx ON progress_game (session_id, status);
CREATE INDEX progress_game_status_updated_at_idx ON progress_game (status, updated_at);

-- 세션당 진행 중인 판은 하나다 (decisions.md 10번).
CREATE UNIQUE INDEX progress_game_one_active_per_session_idx
    ON progress_game (session_id)
    WHERE status = 'ACTIVE';
