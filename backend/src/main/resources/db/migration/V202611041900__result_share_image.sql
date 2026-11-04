-- 결과 공유의 요약 그림 (#275). 공유한 사람의 화면이 그린 PNG를 올려 링크 미리보기(og:image)와 카카오톡 카드에 쓴다.
-- 올리기 전이거나 실패하면 비어 있고, 그때는 공통 그림(/og-card.png)을 쓴다.
ALTER TABLE result_share ADD COLUMN image BYTEA;
