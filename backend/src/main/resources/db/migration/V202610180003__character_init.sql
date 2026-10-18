CREATE TABLE character_profile (
    game_id          UUID        PRIMARY KEY,
    job_code         TEXT,
    job_start_day    INTEGER,
    interest_sector  TEXT,
    investment_style TEXT,
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL
);

-- 능력치는 행으로 저장해서 능력치를 추가해도 마이그레이션이 필요 없다 (db.md 3.4절).
CREATE TABLE character_stat (
    game_id       UUID     NOT NULL,
    stat_code     TEXT     NOT NULL,
    initial_value SMALLINT NOT NULL,
    value         SMALLINT NOT NULL,
    exp           INTEGER  NOT NULL,
    PRIMARY KEY (game_id, stat_code)
);
