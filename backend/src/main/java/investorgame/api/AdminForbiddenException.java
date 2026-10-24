package investorgame.api;

/** 관리자 토큰이 없거나 틀렸다. 서버에 토큰이 설정되지 않았으면 언제나 이 오류다. */
class AdminForbiddenException extends RuntimeException {

  AdminForbiddenException() {
    super("관리자 토큰이 맞지 않는다");
  }
}
