package investorgame.api;

/** 유효한 세션이 없다. 클라이언트는 새로 태어나야 한다 (decisions.md 9번). */
class UnauthorizedException extends RuntimeException {

  UnauthorizedException() {
    super("세션이 없거나 만료되었다");
  }
}
