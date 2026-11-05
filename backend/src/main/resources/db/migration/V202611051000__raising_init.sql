-- 3분 육성 한 판 (증권사 육성 설계 3절). 카드 12장 안팎의 짧은 판이고 다른 도메인이 읽지 않아서, 판의 상태를 JSON 한 칸에 통째로 둔다.
CREATE TABLE raising_run (
    id              UUID        PRIMARY KEY,
    session_id      UUID        NOT NULL,
    status          TEXT        NOT NULL CHECK (status IN ('ACTIVE', 'ENDED', 'ABANDONED')),
    seed            BIGINT      NOT NULL,
    scripted        BOOLEAN     NOT NULL,
    state           JSONB       NOT NULL,
    content_version TEXT,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ
);

CREATE INDEX raising_run_session_created_idx ON raising_run (session_id, created_at DESC);

-- 세션당 진행 중인 판은 하나다.
CREATE UNIQUE INDEX raising_run_one_active_per_session_idx
    ON raising_run (session_id)
    WHERE status = 'ACTIVE';

-- 세션이 판을 넘어 기억하는 것: 열린 기능, 본 설명, 단골 인물이 나온 횟수, 판 수 (11.1절, 투자 원칙 장치 설계 2.1절).
CREATE TABLE raising_memory (
    session_id UUID        PRIMARY KEY,
    state      JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
