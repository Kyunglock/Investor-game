package investorgame.progress.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 나이와 속도는 "일단 만들어 보고 판단"하기로 한 값이다 (decisions.md 2번).
 *
 * @param maxSkipDays 한 번의 시각 보고로 건너뛸 수 있는 최대 게임 일수
 * @param newsBuyRatioBp 뉴스 선택의 매수가 쓰는 현금 비율 (만분율)
 */
@ConfigurationProperties("progress")
public record ProgressProperties(int startAge, int endAge, int maxSkipDays, int newsBuyRatioBp) {}
