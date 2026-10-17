package investorgame.character.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("character")
public record CharacterProperties(InitialStat initialStat) {

  public record InitialStat(int min, int max) {}
}
