-- 봇 플레이어 세션의 페르소나 (행동 프로필·봇 설계 4절). 사람의 세션은 NULL이다.
ALTER TABLE session_info ADD COLUMN bot_persona TEXT;
