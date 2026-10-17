package investorgame.asset;

import java.util.UUID;
import java.util.random.RandomGenerator;

/** 자산 도메인의 입구 (specs/asset.md). 워킹 스켈레톤에는 생성과 조회만 있다. 매매, 주가 변동, 월급은 agent2가 스펙대로 추가한다. */
public interface AssetService {

  /** 판 시작 시 계정을 만들고 초기 현금을 랜덤으로 정한다. 같은 gameId로 다시 부르면 기존 계정을 돌려준다. */
  AccountView create(UUID gameId, RandomGenerator rng);

  AccountView get(UUID gameId);
}
