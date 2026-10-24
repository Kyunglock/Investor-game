package investorgame.api;

import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** 오류는 하나의 형식 {code, message}로 돌려준다 (code-style.md 6절). */
@RestControllerAdvice
class ApiExceptionHandler {

  @ExceptionHandler(UnauthorizedException.class)
  ResponseEntity<ErrorResponse> unauthorized(UnauthorizedException e) {
    return error(HttpStatus.UNAUTHORIZED, "SESSION_REQUIRED", e.getMessage());
  }

  @ExceptionHandler(AdminForbiddenException.class)
  ResponseEntity<ErrorResponse> adminForbidden(AdminForbiddenException e) {
    return error(HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", e.getMessage());
  }

  @ExceptionHandler(NotFoundException.class)
  ResponseEntity<ErrorResponse> notFound(NotFoundException e) {
    return error(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
  }

  @ExceptionHandler(InvalidRequestException.class)
  ResponseEntity<ErrorResponse> invalid(InvalidRequestException e) {
    return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", e.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException e) {
    return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "요청 형식이 올바르지 않다");
  }

  private static ResponseEntity<ErrorResponse> error(
      HttpStatus status, String code, String message) {
    return ResponseEntity.status(status).body(new ErrorResponse(code, message));
  }

  record ErrorResponse(String code, String message) {}
}
