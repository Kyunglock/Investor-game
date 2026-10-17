package investorgame.common.error;

/** 요청한 대상이 없다. API에서 404로 바뀐다. */
public class NotFoundException extends RuntimeException {

  public NotFoundException(String message) {
    super(message);
  }
}
