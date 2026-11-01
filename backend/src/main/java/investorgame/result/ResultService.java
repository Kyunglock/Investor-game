package investorgame.result;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** 판이 정상적으로 끝났을 때의 결과 기록 (db.md 3.13절). 집계용 result_stat은 아직 없다. */
public interface ResultService {

  /** 같은 판으로 다시 부르면 기존 기록을 그대로 둔다. */
  void save(GameResult result);

  /**
   * 결과와 익명 행동 프로필을 한 트랜잭션에 남긴다. 결과가 이미 있으면(같은 판을 다시 부르면) 프로필도 쌓지 않는다. 프로필에는 판 ID가 없어 중복을 따로 막을 수 없기
   * 때문이다.
   */
  void save(GameResult result, PlayProfile profile);

  Optional<GameResult> find(UUID gameId);

  /** 주어진 판들 가운데 결과가 있는 것만. 관리자 플레이 기록용. */
  List<GameResult> findAll(Collection<UUID> gameIds);

  /** 순위표에 올린다 (decisions.md 141번). 같은 판이 이미 있으면 그대로 두고 false. */
  boolean enterRanking(RankingEntry entry);

  /** 최종 자산이 큰 순서로 limit개. 같으면 먼저 올린 사람이 앞이다. */
  List<RankingEntry> ranking(int limit);

  int rankingSize();

  /** 그 판이 순위표에 있으면 1부터 시작하는 순위. 올리지 않았으면 비어 있다. */
  Optional<Integer> rankOf(UUID gameId);
}
