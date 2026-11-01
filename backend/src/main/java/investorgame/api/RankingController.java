package investorgame.api;

import investorgame.progress.ProgressService;
import investorgame.progress.RankingView;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 최종 자산 순위표 (decisions.md 141번). 공개 값이라 세션이 없어도 본다. 올리는 쪽은 GameController의 /ranking. */
@RestController
class RankingController {

  private final ProgressService progress;

  RankingController(ProgressService progress) {
    this.progress = progress;
  }

  @GetMapping("/api/ranking")
  RankingView ranking() {
    return progress.ranking();
  }
}
