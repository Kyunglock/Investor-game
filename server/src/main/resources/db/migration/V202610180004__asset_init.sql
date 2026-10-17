CREATE TABLE asset_account (
    game_id      UUID        PRIMARY KEY,
    cash         BIGINT      NOT NULL,
    initial_cash BIGINT      NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL
);
