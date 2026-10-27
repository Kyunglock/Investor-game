-- 비슷한 플레이어 찾기용 익명 행동 프로필 (행동 프로필·봇 설계). result_stat처럼 세션·판 ID를 저장하지 않아 세션이 만료돼도 남는다.
-- habits는 0~1로 맞춘 습관 지표 7개다. 순서는 PlayProfile.Habits.toVector()가 정한다.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE result_profile (
    id                BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content_version   TEXT,
    ended_on          DATE        NOT NULL,
    final_age         SMALLINT    NOT NULL,
    ending            TEXT        NOT NULL,
    bot_persona       TEXT,
    habits            vector(7)   NOT NULL,
    invested          BIGINT      NOT NULL,
    invest_pnl        BIGINT      NOT NULL,
    invest_return_bp  INTEGER     NOT NULL
);
