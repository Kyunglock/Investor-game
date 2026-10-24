-- 누가 플레이했는지 보려고 세션에 처음·마지막 접속 IP를 남긴다 (decisions.md 63번).
ALTER TABLE session_info ADD COLUMN first_ip TEXT;
ALTER TABLE session_info ADD COLUMN last_ip TEXT;
