-- 주거 도메인 (주거 설계 2절): 거주 형태·보증금·만기와 보유 아파트·주담대. 시세와 금리는 시장이 소유한다.
CREATE TABLE housing_state (
    game_id         UUID        PRIMARY KEY,
    tenure          TEXT        NOT NULL,
    region          TEXT,
    deposit         BIGINT      NOT NULL DEFAULT 0,
    monthly_rent    BIGINT      NOT NULL DEFAULT 0,
    jeonse_loan     BIGINT      NOT NULL DEFAULT 0,
    insured         BOOLEAN     NOT NULL DEFAULT FALSE,
    lease_end_day   INTEGER,
    updated_at      TIMESTAMPTZ NOT NULL
);

-- 팔린 집은 sold_day가 생기고 목록에서 빠진다.
CREATE TABLE housing_home (
    game_id              UUID     NOT NULL,
    seq                  SMALLINT NOT NULL,
    region               TEXT     NOT NULL,
    purchase_price       BIGINT   NOT NULL,
    purchase_day         INTEGER  NOT NULL,
    mortgage             BIGINT   NOT NULL DEFAULT 0,
    residence            BOOLEAN  NOT NULL,
    tenant_deposit       BIGINT   NOT NULL DEFAULT 0,
    tenant_lease_end_day INTEGER,
    listed_day           INTEGER,
    sold_day             INTEGER,
    sale_price           BIGINT,
    PRIMARY KEY (game_id, seq)
);
