package investorgame.common.error;

/** 다른 창이나 기기가 이 판을 진행하고 있다 (#189). API에서 409 OTHER_WINDOW로 바뀐다. */
public class ConflictException extends RuntimeException {

  public ConflictException(String message) {
    super(message);
  }
}
