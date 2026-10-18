package investorgame.character.internal;

import investorgame.character.CharacterService;
import investorgame.character.CharacterView;
import investorgame.character.GrowthSource;
import investorgame.character.StatChange;
import investorgame.character.TraitAxes;
import investorgame.character.TraitResult;
import investorgame.common.GameProperties;
import investorgame.common.StatCodes;
import investorgame.common.Stats;
import investorgame.common.error.InvalidRequestException;
import investorgame.common.error.NotFoundException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class JdbcCharacterService implements CharacterService {

  private static final String STYLE_PREFIX = "style.";
  private static final String SECTOR_PREFIX = "sector.";
  private static final String RISK_PREFIX = "risk.";
  private static final String MIND_PREFIX = "mind.";
  private static final String TRAIT_REASON = "TRAIT";

  private final JdbcClient jdbc;
  private final Clock clock;
  private final CharacterProperties properties;
  private final GameProperties calendar;

  JdbcCharacterService(
      JdbcClient jdbc, Clock clock, CharacterProperties properties, GameProperties calendar) {
    this.jdbc = jdbc;
    this.clock = clock;
    this.properties = properties;
    this.calendar = calendar;
  }

  @Override
  @Transactional
  public CharacterView create(UUID gameId, RandomGenerator rng) {
    if (exists(gameId)) {
      return get(gameId);
    }
    jdbc.sql(
            """
            INSERT INTO character_profile (game_id, created_at, updated_at)
            VALUES (:gameId, :now, :now)
            """)
        .param("gameId", gameId)
        .param("now", now())
        .update();

    CharacterProperties.InitialStat range = properties.initialStat();
    for (String code : StatCodes.ALL) {
      int value = rng.nextInt(range.min(), range.max() + 1);
      jdbc.sql(
              """
              INSERT INTO character_stat (game_id, stat_code, initial_value, value, exp)
              VALUES (:gameId, :code, :value, :value, 0)
              """)
          .param("gameId", gameId)
          .param("code", code)
          .param("value", value)
          .update();
    }
    return get(gameId);
  }

  @Override
  @Transactional(readOnly = true)
  public CharacterView get(UUID gameId) {
    Profile profile = profile(gameId);
    Map<String, Integer> current = new HashMap<>();
    Map<String, Integer> initial = new HashMap<>();
    for (StatRow row : stats(gameId)) {
      current.put(row.statCode(), row.value());
      initial.put(row.statCode(), row.initialValue());
    }
    return new CharacterView(
        gameId,
        Stats.fromCodes(current),
        Stats.fromCodes(initial),
        profile.jobCode(),
        profile.jobStartDay(),
        profile.investmentStyle(),
        profile.riskProfile(),
        profile.mindProfile(),
        profile.interestSector(),
        profile.investorType());
  }

  @Override
  @Transactional
  public void assignJob(UUID gameId, String jobCode, int startDay) {
    profile(gameId);
    int updated =
        jdbc.sql(
                """
                UPDATE character_profile
                SET job_code = :jobCode, job_start_day = :startDay, updated_at = :now
                WHERE game_id = :gameId AND job_code IS NULL
                """)
            .param("jobCode", jobCode)
            .param("startDay", startDay)
            .param("now", now())
            .param("gameId", gameId)
            .update();
    if (updated == 0) {
      throw new InvalidRequestException("직업은 한 번만 정할 수 있다");
    }
  }

  @Override
  @Transactional
  public List<StatChange> recordTraitChoice(
      UUID gameId, Map<String, Integer> traitDeltas, Map<String, Integer> statDeltas, int gameDay) {
    traitDeltas.forEach(
        (code, delta) ->
            jdbc.sql(
                    """
                    INSERT INTO character_trait_score (game_id, trait_code, score)
                    VALUES (:gameId, :code, :delta)
                    ON CONFLICT (game_id, trait_code)
                      DO UPDATE SET score = character_trait_score.score + EXCLUDED.score
                    """)
                .param("gameId", gameId)
                .param("code", code)
                .param("delta", delta)
                .update());

    // 능력치는 즉시 움직인다. 운은 타고난 값이라 무시한다 (확정). 태어날 때 값(initial_value)은 건드리지 않는다.
    Map<String, StatRow> rows = new LinkedHashMap<>();
    stats(gameId).forEach(row -> rows.put(row.statCode(), row));
    int min = properties.traitStat().min();
    int max = properties.growth().maxStat();
    List<StatChange> changes = new ArrayList<>();
    for (String code : StatCodes.ALL) {
      Integer delta = statDeltas.get(code);
      StatRow row = rows.get(code);
      if (delta == null || row == null || code.equals(StatCodes.LUCK)) {
        continue;
      }
      int after = Math.clamp(row.value() + delta, min, max);
      if (after == row.value()) {
        continue;
      }
      jdbc.sql(
              """
              UPDATE character_stat SET value = :value
              WHERE game_id = :gameId AND stat_code = :code
              """)
          .param("value", after)
          .param("gameId", gameId)
          .param("code", code)
          .update();
      logChange(gameId, code, after - row.value(), TRAIT_REASON, null, gameDay);
      changes.add(new StatChange(code, 0, row.value(), after));
    }
    return changes;
  }

  @Override
  @Transactional
  public TraitResult finalizeTraits(UUID gameId, TraitAxes axes, RandomGenerator rng) {
    Profile profile = profile(gameId);
    if (profile.investmentStyle() != null) {
      return new TraitResult(
          profile.investmentStyle(),
          profile.riskProfile(),
          profile.mindProfile(),
          profile.interestSector(),
          profile.investorType());
    }
    Map<String, Integer> scores = new HashMap<>();
    jdbc.sql("SELECT trait_code, score FROM character_trait_score WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(TraitScore.class)
        .list()
        .forEach(s -> scores.put(s.traitCode(), s.score()));

    // 동점 후보는 코드 이름순으로 정렬한 뒤 뽑아서 같은 시드면 같은 결과가 나오게 한다. 뽑는 순서: 기간 → 위험 → 소신 → 관심.
    String style = top(scores, STYLE_PREFIX, List.of(), rng);
    String risk = top(scores, RISK_PREFIX, axes.risks(), rng);
    String mind = top(scores, MIND_PREFIX, axes.minds(), rng);
    String sector = top(scores, SECTOR_PREFIX, List.of(), rng);
    String type = style + "-" + risk + "-" + mind;
    jdbc.sql(
            """
            UPDATE character_profile
            SET investment_style = :style, risk_profile = :risk, mind_profile = :mind,
                interest_sector = :sector, investor_type = :type, updated_at = :now
            WHERE game_id = :gameId
            """)
        .param("style", style)
        .param("risk", risk)
        .param("mind", mind)
        .param("sector", sector)
        .param("type", type)
        .param("now", now())
        .param("gameId", gameId)
        .update();
    return new TraitResult(style, risk, mind, sector, type);
  }

  @Override
  @Transactional
  public List<StatChange> grow(UUID gameId, List<GrowthSource> sources, int gameDay) {
    CharacterProperties.Growth growth = properties.growth();
    Map<String, StatRow> rows = new LinkedHashMap<>();
    stats(gameId).forEach(row -> rows.put(row.statCode(), row));
    Map<String, Integer> gained = new LinkedHashMap<>();
    Map<String, Integer> before = new HashMap<>();

    for (GrowthSource source : sources) {
      String code = source.statCode();
      StatRow row = rows.get(code);
      if (row == null || code.equals(StatCodes.LUCK)) {
        continue;
      }
      int exp =
          switch (source) {
            case GrowthSource.DeviationGrowth d -> growth.deviationExp();
            case GrowthSource.Training t -> t.expAmount();
          };
      before.putIfAbsent(code, row.value());
      gained.merge(code, exp, Integer::sum);

      int totalExp = row.exp() + exp;
      int newValue = Math.min(growth.maxStat(), row.value() + totalExp / growth.expPerPoint());
      int remainingExp = totalExp - Math.max(0, newValue - row.value()) * growth.expPerPoint();
      if (newValue > row.value()) {
        logChange(
            gameId,
            code,
            newValue - row.value(),
            source instanceof GrowthSource.Training ? "TRAINING" : "DEVIATION",
            source.eventId(),
            gameDay);
      }
      rows.put(code, new StatRow(code, row.initialValue(), newValue, remainingExp));
    }

    List<StatChange> changes = new ArrayList<>();
    for (Map.Entry<String, Integer> entry : gained.entrySet()) {
      StatRow row = rows.get(entry.getKey());
      jdbc.sql(
              """
              UPDATE character_stat SET value = :value, exp = :exp
              WHERE game_id = :gameId AND stat_code = :code
              """)
          .param("value", row.value())
          .param("exp", row.exp())
          .param("gameId", gameId)
          .param("code", row.statCode())
          .update();
      changes.add(
          new StatChange(
              row.statCode(), entry.getValue(), before.get(row.statCode()), row.value()));
    }
    return changes;
  }

  @Override
  @Transactional(readOnly = true)
  public int tenureYears(UUID gameId, int currentDay) {
    Integer startDay = profile(gameId).jobStartDay();
    return startDay == null ? 0 : Math.max(0, currentDay - startDay) / calendar.daysPerYear();
  }

  private void logChange(
      UUID gameId, String statCode, int delta, String reason, UUID eventId, int gameDay) {
    jdbc.sql(
            """
            INSERT INTO character_stat_log (game_id, stat_code, delta, reason, event_id, game_day, created_at)
            VALUES (:gameId, :code, :delta, :reason, :eventId, :gameDay, :now)
            """)
        .param("gameId", gameId)
        .param("code", statCode)
        .param("delta", delta)
        .param("reason", reason)
        .param("eventId", eventId)
        .param("gameDay", gameDay)
        .param("now", now())
        .update();
  }

  /** 점수가 없을 때 fallback 후보가 비어 있으면 오류, 있으면 그 후보에서 난수로 정한다. 어느 쪽이든 난수는 한 번 뽑아 순서를 고정한다. */
  private static String top(
      Map<String, Integer> scores, String prefix, List<String> fallback, RandomGenerator rng) {
    int best = Integer.MIN_VALUE;
    List<String> candidates = new ArrayList<>();
    for (Map.Entry<String, Integer> entry : scores.entrySet()) {
      if (!entry.getKey().startsWith(prefix)) {
        continue;
      }
      if (entry.getValue() > best) {
        best = entry.getValue();
        candidates.clear();
      }
      if (entry.getValue() == best) {
        candidates.add(entry.getKey().substring(prefix.length()));
      }
    }
    if (candidates.isEmpty()) {
      if (fallback.isEmpty()) {
        throw new InvalidRequestException("성향 점수가 없다: " + prefix);
      }
      candidates.addAll(fallback);
    }
    candidates.sort(null);
    return candidates.get(rng.nextInt(candidates.size()));
  }

  private Profile profile(UUID gameId) {
    return jdbc.sql(
            """
            SELECT job_code, job_start_day, investment_style, risk_profile, mind_profile,
                   interest_sector, investor_type
            FROM character_profile
            WHERE game_id = :gameId
            """)
        .param("gameId", gameId)
        .query(Profile.class)
        .optional()
        .orElseThrow(() -> new NotFoundException("캐릭터가 없다"));
  }

  private List<StatRow> stats(UUID gameId) {
    return jdbc.sql(
            "SELECT stat_code, initial_value, value, exp FROM character_stat WHERE game_id = :gameId")
        .param("gameId", gameId)
        .query(StatRow.class)
        .list();
  }

  private boolean exists(UUID gameId) {
    return jdbc.sql("SELECT EXISTS (SELECT 1 FROM character_profile WHERE game_id = :gameId)")
        .param("gameId", gameId)
        .query(Boolean.class)
        .single();
  }

  private OffsetDateTime now() {
    return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
  }

  private record Profile(
      String jobCode,
      Integer jobStartDay,
      String investmentStyle,
      String riskProfile,
      String mindProfile,
      String interestSector,
      String investorType) {}

  private record StatRow(String statCode, int initialValue, int value, int exp) {}

  private record TraitScore(String traitCode, int score) {}
}
