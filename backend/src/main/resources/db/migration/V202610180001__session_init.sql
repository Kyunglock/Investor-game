CREATE TABLE session_info (
    id           UUID        PRIMARY KEY,
    token_hash   TEXT        NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX session_info_last_seen_at_idx ON session_info (last_seen_at);
