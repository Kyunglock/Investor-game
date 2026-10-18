-- 숨은 방향과 변동 폭은 이 테이블에만 있고 API로 내려가지 않는다 (db.md 3.9절).
CREATE TABLE event_instance (
    id                  UUID        PRIMARY KEY,
    game_id             UUID        NOT NULL,
    seq                 INTEGER     NOT NULL,
    kind                TEXT        NOT NULL,
    definition_code     TEXT,
    sector_code         TEXT,
    occurs_day          INTEGER     NOT NULL,
    skippable           BOOLEAN     NOT NULL,
    status              TEXT        NOT NULL
                        CHECK (status IN ('SCHEDULED', 'PENDING', 'RESOLVED', 'SKIPPED')),
    hidden_direction    TEXT,
    hidden_magnitude_bp INTEGER,
    hint_code           TEXT,
    sway_sentiment      TEXT,
    sway_code           TEXT,
    options             JSONB       NOT NULL,
    chain_code          TEXT,
    parent_event_id     UUID,
    depth               SMALLINT    NOT NULL,
    branch_code         TEXT,
    created_at          TIMESTAMPTZ NOT NULL,
    resolved_at         TIMESTAMPTZ,
    UNIQUE (game_id, seq)
);

CREATE INDEX event_instance_game_status_day_idx ON event_instance (game_id, status, occurs_day);
CREATE INDEX event_instance_game_kind_day_idx ON event_instance (game_id, kind, occurs_day);

CREATE TABLE event_resolution (
    event_id      UUID        PRIMARY KEY,
    game_id       UUID        NOT NULL,
    choice        TEXT        NOT NULL,
    actual_action TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE event_deviation (
    event_id    UUID     NOT NULL,
    step        SMALLINT NOT NULL,
    stat_code   TEXT     NOT NULL,
    from_action TEXT     NOT NULL,
    to_action   TEXT     NOT NULL,
    PRIMARY KEY (event_id, step)
);
