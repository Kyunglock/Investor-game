package investorgame.common;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 게임 달력. 1년 = 12개월 × 30일 = 360일 (specs/README.md 4절). */
@ConfigurationProperties("game")
public record GameProperties(int daysPerMonth, int daysPerYear) {}
