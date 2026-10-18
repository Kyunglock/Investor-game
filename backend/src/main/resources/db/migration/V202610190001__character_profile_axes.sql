-- 성향 네 축 중 위험·소신과 투자자 유형 (경제 개편 설계 4.2절). 기간(investment_style)·관심(interest_sector)은 이미 있다.
ALTER TABLE character_profile
    ADD COLUMN risk_profile  TEXT,
    ADD COLUMN mind_profile  TEXT,
    ADD COLUMN investor_type TEXT;
