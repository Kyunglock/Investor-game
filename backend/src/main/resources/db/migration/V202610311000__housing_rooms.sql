-- 지금 사는 세집의 크기(방 수, 1 원룸 ~ 4 포룸) (#117). 식구 수에 따라 필요한 크기가 정해지고, 더 작으면 좁다.
-- 자가·부모님 집·옛 판은 NULL(좁다고 보지 않는다).
ALTER TABLE housing_state ADD COLUMN rooms SMALLINT;
