-- 직장 체계 (decisions.md 26번): 처음 일을 시작한 날(생활비 기준)과 연봉 협상·승진으로 쌓인 인상분. 실직하면 job_code·job_start_day가 null로 돌아간다.
ALTER TABLE character_profile
    ADD COLUMN career_start_day INTEGER,
    ADD COLUMN salary_bonus_bp  INTEGER NOT NULL DEFAULT 0;

UPDATE character_profile SET career_start_day = job_start_day WHERE job_start_day IS NOT NULL;
