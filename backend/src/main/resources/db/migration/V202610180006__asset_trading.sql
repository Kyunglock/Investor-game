CREATE TABLE asset_holding (
    game_id     UUID        NOT NULL,
    sector_code TEXT        NOT NULL,
    amount      BIGINT      NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (game_id, sector_code)
);

CREATE TABLE asset_ledger (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_id     UUID        NOT NULL,
    game_day    INTEGER     NOT NULL,
    kind        TEXT        NOT NULL,
    sector_code TEXT,
    amount      BIGINT      NOT NULL,
    cash_after  BIGINT      NOT NULL,
    event_id    UUID,
    created_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX asset_ledger_game_idx ON asset_ledger (game_id, id);

-- 같은 날 월급이 두 번 들어가지 않게 한다. 요청이 재시도되어도 안전하다 (specs/asset.md 6절).
CREATE UNIQUE INDEX asset_ledger_salary_once_idx
    ON asset_ledger (game_id, game_day)
    WHERE kind = 'SALARY';
