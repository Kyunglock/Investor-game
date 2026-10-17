package investorgame.event;

/** 우선순위 순서다. 같은 날 후보가 겹치면 앞의 것이 먼저 나온다 (specs/event.md 5.1절). */
public enum EventKind {
  JOB,
  OFFER,
  TRAIT,
  NEWS
}
