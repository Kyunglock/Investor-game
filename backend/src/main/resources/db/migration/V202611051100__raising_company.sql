-- 아주 작은 회사 (증권사 육성 설계 4·6절, 2단계). 첫 육성의 사람을 등록하면 열린다. 상태는 JSON 한 칸.
CREATE TABLE raising_company (
    id         UUID        PRIMARY KEY,
    session_id UUID        NOT NULL,
    status     TEXT        NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
    seed       BIGINT      NOT NULL,
    state      JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX raising_company_session_created_idx ON raising_company (session_id, created_at DESC);

-- 세션당 돌아가는 회사는 하나다.
CREATE UNIQUE INDEX raising_company_one_active_per_session_idx
    ON raising_company (session_id)
    WHERE status = 'ACTIVE';
