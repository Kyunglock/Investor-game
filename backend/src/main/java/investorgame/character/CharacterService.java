package investorgame.character;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;

/** 캐릭터 도메인의 입구 (specs/character.md). */
public interface CharacterService {

  /** 판 시작 시 능력치를 랜덤으로 만든다. 같은 gameId로 다시 부르면 기존 캐릭터를 돌려준다. */
  CharacterView create(UUID gameId, RandomGenerator rng);

  CharacterView get(UUID gameId);

  /** 직업을 정한다. 직업이 없을 때(첫 취업 또는 실직 뒤)만 가능하다. 처음이면 careerStartDay도 이 날이 된다. 전업투자자면 오류. */
  void assignJob(UUID gameId, String jobCode, int startDay);

  /**
   * 직업 대신 전업투자자가 된다. 직업이 없을 때만 가능하고 되돌릴 수 없다. 처음이면 careerStartDay(생활비 기준)도 이 날이 된다. 월급이 없다는 것 말고는
   * 직장인과 같다.
   */
  void becomeFullTimeInvestor(UUID gameId, int day);

  /** 전업투자자가 회사를 세워 그 대표(직업)가 된다. 전업투자자일 때만 가능하고, 이 날부터 월급이 나오며 더는 전업투자자가 아니다 (decisions.md 44번). */
  void foundCompany(UUID gameId, String jobCode, int day);

  /**
   * 다른 직업으로 옮긴다. 연차(jobStartDay)는 이 날부터 다시 세고 인상분은 startBonusBp로 바뀐다. 직업이 없으면 오류 (decisions.md
   * 26번).
   */
  void changeJob(UUID gameId, String jobCode, int day, int startBonusBp);

  /** 직업을 잃는다. jobCode·jobStartDay가 null이 되고 인상분은 0이 된다. 직업이 없으면 오류. */
  void quitJob(UUID gameId);

  /** 연봉 협상·승진의 인상분을 더한다(만분율, 음수 가능). 직업이 없으면 오류. */
  void addSalaryBonus(UUID gameId, int bonusBp);

  /**
   * 성향 장면의 선택 하나를 반영한다. traitDeltas는 축 점수("style.", "risk.", "mind.", "sector.")에 누적하고, statDeltas는
   * 능력치에 즉시 더한다(범위 안으로 자르고 운은 무시). 값이 실제로 바뀐 능력치만 돌려준다 (expGained는 0).
   */
  List<StatChange> recordTraitChoice(
      UUID gameId, Map<String, Integer> traitDeltas, Map<String, Integer> statDeltas, int gameDay);

  /**
   * 누적 점수로 네 축과 투자자 유형을 확정한다. 기간·관심 점수가 없으면 오류, 위험·소신 점수가 없으면 axes의 후보에서 난수로 정한다. 이미 확정되었으면 그 값을
   * 돌려준다.
   */
  TraitResult finalizeTraits(UUID gameId, TraitAxes axes, RandomGenerator rng);

  /** 성장 원인을 반영한다. 운은 성장하지 않는다. 경험치를 얻은 능력치의 변화만 돌려준다. */
  List<StatChange> grow(UUID gameId, List<GrowthSource> sources, int gameDay);

  /** 연차(년). 직업이 없으면 0. */
  int tenureYears(UUID gameId, int currentDay);
}
