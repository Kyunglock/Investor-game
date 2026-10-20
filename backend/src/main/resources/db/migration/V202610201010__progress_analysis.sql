-- 안목 해석 (매매창 설계 4.3절). 대상(종목 코드 또는 'macro')·달마다 한 번 정해져 창을 다시 열어도 바뀌지 않는다.
-- text는 그 달의 사실을 채운 최종 문구다. prev_correct·remark는 그 전 해석이 맞았는지와 그때 붙는 한마디다(전 해석이 없으면 NULL).
CREATE TABLE progress_analysis (
    game_id      UUID    NOT NULL,
    target       TEXT    NOT NULL,
    month        INTEGER NOT NULL,
    insight      INTEGER NOT NULL,
    tier         TEXT    NOT NULL,
    truth        TEXT    NOT NULL,
    reading      TEXT    NOT NULL,
    confident    BOOLEAN NOT NULL,
    text         TEXT    NOT NULL,
    prev_correct BOOLEAN,
    remark       TEXT,
    PRIMARY KEY (game_id, target, month)
);
