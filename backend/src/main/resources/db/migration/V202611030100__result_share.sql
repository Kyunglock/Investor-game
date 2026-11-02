-- 결과 공유 (#197). 플레이어가 공유를 누른 판만 한 줄 남는다. 공유 ID는 추측할 수 없는 무작위 문자열이고,
-- 카드에는 화면에 보이는 결과만 담는다(IP·세션 없음). 세션이 만료돼도 링크는 계속 열린다.
CREATE TABLE result_share (
    share_id   VARCHAR(16) PRIMARY KEY,
    game_id    UUID        NOT NULL UNIQUE,
    card       JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
