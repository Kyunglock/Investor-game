-- 보유를 섹터 평가액에서 종목 수량·원가로 바꾼다 (경제 개편 설계 6.1절). 운영 데이터가 없어 다시 만든다.
DROP TABLE asset_holding;

CREATE TABLE asset_holding (
    game_id    UUID        NOT NULL,
    stock_code TEXT        NOT NULL,
    quantity   BIGINT      NOT NULL,
    cost_basis BIGINT      NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (game_id, stock_code)
);

-- 빚(마이너스 통장). 지출이 현금을 넘으면 늘고, 수입이 먼저 갚는다. 매월 이자가 붙는다.
ALTER TABLE asset_account ADD COLUMN debt BIGINT NOT NULL DEFAULT 0;

ALTER TABLE asset_ledger RENAME COLUMN sector_code TO stock_code;
ALTER TABLE asset_ledger
    ADD COLUMN quantity   BIGINT,
    ADD COLUMN price      BIGINT,
    ADD COLUMN debt_after BIGINT NOT NULL DEFAULT 0;

-- 매월 한 번 처리하는 종류는 같은 날 두 번 기록되지 않게 한다. 요청이 재시도되어도 안전하다.
DROP INDEX asset_ledger_salary_once_idx;
CREATE UNIQUE INDEX asset_ledger_once_per_day_idx
    ON asset_ledger (game_id, game_day, kind)
    WHERE kind IN ('SALARY', 'SPOUSE_INCOME', 'SEVERANCE', 'EXPENSE', 'INTEREST');
