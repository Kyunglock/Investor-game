package investorgame.event;

/**
 * 우선순위 순서다. 같은 날 후보가 겹치면 앞의 것이 먼저 나온다 (specs/event.md 5.1절). LIFE는 결혼·자녀 선택, CAREER는 취업 뒤 직장
 * 장면(연봉·승진·이직·구조조정), SHAKE는 보유 종목이 흔들릴 때 버틸지 팔지 묻는 인내심 시험, NOTICE는 멈추지 않는 알림이다.
 */
public enum EventKind {
  JOB,
  OFFER,
  TRAIT,
  LIFE,
  CAREER,
  NEWS,
  SHAKE,
  NOTICE
}
