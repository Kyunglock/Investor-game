package investorgame.content;

/** 결혼·자녀 같은 선택형 생활 이벤트의 문구. 선택지는 수락/거절 둘이다. */
public record LifeText(String title, String body, String acceptLabel, String declineLabel) {}
