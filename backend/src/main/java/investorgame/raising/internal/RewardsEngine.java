package investorgame.raising.internal;

import investorgame.common.error.InvalidRequestException;
import investorgame.raising.CompanyView;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/** 날마다 받는 보상 (decisions.md 528번): 출석. 하루의 경계는 한국 시간 자정이고 서버 시각으로 판정한다(화면의 시계는 믿지 않는다). */
@Component
class RewardsEngine {
  private final IdleEngine idle;
  private final CompanyEngine engine;

  RewardsEngine(IdleEngine idle, CompanyEngine engine) {
    this.idle = idle;
    this.engine = engine;
  }

  private CompanyProperties.Attendance rule() {
    return engine.attendance();
  }

  /** 오늘 출석 보상을 아직 안 받았나. */
  boolean claimable(CompanyState c) {
    return !idle.today().equals(c.attendDay);
  }

  /** 돈 보상 한 칸의 크기: 지금 회사의 초당 수입 × minutes분. */
  private double money(CompanyState c, int minutes) {
    return Math.floor(minutes * 60.0 * idle.perSecond(c));
  }

  /**
   * 출석 보상을 받는다 (528번): 하루에 한 번. 출석판의 다음 칸을 받고 한 칸 나아간다. 누적 출석이라 하루 빠져도 처음으로 돌아가지 않고, 마지막 칸 다음은 다시 첫
   * 칸이다. 오늘 이미 받았으면 400.
   */
  void attend(CompanyState c) {
    if (!claimable(c)) {
      throw new InvalidRequestException("오늘 출석 보상은 이미 받았어요");
    }
    List<CompanyProperties.AttendanceDay> days = rule().days();
    int at = Math.floorMod(c.attendCount, days.size());
    CompanyProperties.AttendanceDay day = days.get(at);
    CompanyState.AttendReward reward = new CompanyState.AttendReward();
    reward.day = at + 1;
    reward.diamonds = day.diamonds();
    reward.money = day.incomeMinutes() > 0 ? money(c, day.incomeMinutes()) : 0;
    c.diamonds += reward.diamonds;
    c.capital += reward.money;
    c.attendCount++;
    c.attendDay = idle.today();
    c.lastAttend = reward;
  }

  /** 테스트판: 하루가 지난 셈 친다. 오늘 받은 출석을 다시 받을 수 있다. */
  void nextDay(CompanyState c) {
    c.attendDay = null;
  }

  /**
   * 출석판의 화면 값. 오늘 받을 칸(이미 받았으면 오늘 받은 칸)이 today이고, 이번 주기에서 그 앞까지가 받은 칸이다. 마지막 칸을 받은 날에는 모든 칸이 받은 채로
   * 보이고 다음 날 새 주기가 시작된다.
   */
  CompanyView.Attendance view(CompanyState c) {
    List<CompanyProperties.AttendanceDay> days = rule().days();
    boolean claimable = claimable(c);
    int next = Math.floorMod(c.attendCount, days.size());
    boolean finished = !claimable && c.attendCount > 0 && next == 0;
    int stamped = finished ? days.size() : next;
    int today = claimable ? next + 1 : stamped;
    List<CompanyView.AttendanceDay> board = new ArrayList<>();
    for (int i = 0; i < days.size(); i++) {
      CompanyProperties.AttendanceDay d = days.get(i);
      board.add(
          new CompanyView.AttendanceDay(
              i + 1,
              d.diamonds(),
              d.incomeMinutes(),
              d.incomeMinutes() > 0 ? CompanyView.money(money(c, d.incomeMinutes())) : null,
              i < stamped));
    }
    CompanyState.AttendReward r = c.lastAttend;
    return new CompanyView.Attendance(
        today,
        claimable,
        board,
        r == null
            ? null
            : new CompanyView.AttendanceReward(r.day, r.diamonds, CompanyView.money(r.money)));
  }
}
