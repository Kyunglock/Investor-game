-- 전업투자자: 직업 선택에서 직업 대신 투자를 고른 날. 이날부터 월급 없이 생활비만 나가고 구직 제안이 더 오지 않는다.
ALTER TABLE character_profile
    ADD COLUMN full_time_investor_day INTEGER;
