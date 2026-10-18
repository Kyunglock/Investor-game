package investorgame.common.error;

/** 사용자 입력이 규칙에 맞지 않는다. API에서 400으로 바뀐다. 메시지에 숨은 값을 담지 않는다. */
public class InvalidRequestException extends RuntimeException {

  public InvalidRequestException(String message) {
    super(message);
  }
}
