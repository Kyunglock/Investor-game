-- 콘텐츠 정의는 JSON 파일에 있고, DB에는 어떤 버전이 로드되었는지만 남긴다 (db.md 3.12절).
CREATE TABLE content_version (
    version   TEXT        PRIMARY KEY,
    checksum  TEXT        NOT NULL,
    loaded_at TIMESTAMPTZ NOT NULL,
    summary   JSONB       NOT NULL
);
