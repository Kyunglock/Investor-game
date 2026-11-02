-- 최종 자산 순위 (decisions.md 141번). 끝난 판에 사용자가 이름을 적어 올린 줄만 쌓인다.
-- 세션 ID는 두지 않아 세션이 만료돼도 남고, 판마다 한 줄만 허용한다. 이름은 공개가 전제다.
CREATE TABLE result_ranking (
    game_id     UUID        PRIMARY KEY,
    name        VARCHAR(16) NOT NULL,
    final_asset BIGINT      NOT NULL,
    final_age   SMALLINT    NOT NULL,
    ending      TEXT        NOT NULL,
    job_title   TEXT,
    entered_at  TIMESTAMPTZ NOT NULL
);

-- 순위표 조회(자산 내림차순, 같으면 먼저 올린 사람)와 내 순위 계산(final_asset 비교)이 이 순서를 쓴다.
CREATE INDEX result_ranking_asset_idx ON result_ranking (final_asset DESC, entered_at);
