package investorgame.result;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** 판이 정상적으로 끝났을 때의 결과 기록 (db.md 3.13절). 집계용 result_stat은 아직 없다. */
public interface ResultService {

  /** 같은 판으로 다시 부르면 기존 기록을 그대로 둔다. */
  void save(GameResult result);

  Optional<GameResult> find(UUID gameId);

  /** 주어진 판들 가운데 결과가 있는 것만. 관리자 플레이 기록용. */
  List<GameResult> findAll(Collection<UUID> gameIds);
}
