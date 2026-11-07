-- 업계 순위 (#351): 실제 유저 회사끼리 같은 연차의 연말 자본으로 견준다. 회사마다 해마다 한 줄.
CREATE TABLE raising_company_year (
    company_id  UUID        NOT NULL,
    year        INT         NOT NULL,
    capital     BIGINT      NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (company_id, year)
);

CREATE INDEX raising_company_year_rank_idx ON raising_company_year (year, capital DESC);
