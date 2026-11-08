package investorgame.raising.internal;

import investorgame.common.Korean;
import investorgame.content.ContentCatalog;
import investorgame.content.RaisingContent;
import investorgame.raising.internal.CompanyState.Employee;
import java.util.List;
import java.util.Map;

/**
 * 사기 (decisions.md 270번). 종목 회의에서 자기 말을 안 들어 줬는데 사장이 틀리면 서운하고, 들어 줬는데 맞으면 신이 난다. 한 해 내내 쉬면 기운을
 * 되찾는다. 사기는 손이 뒤집힐 확률에 걸린다. 직원은 사기가 낮아도 떠나지 않는다(265번). 연봉(인건비)·연봉 협상·사표는 뺐다(383번). DB와 시각을 모른다.
 */
class PayEngine {

  static final int MORALE_MIN = -2;
  static final int MORALE_MAX = 2;
  private static final int PERCENT = 100;

  private final ContentCatalog content;
  private final CompanyProperties properties;

  PayEngine(ContentCatalog content, CompanyProperties properties) {
    this.content = content;
    this.properties = properties;
  }

  private CompanyProperties.Pay rules() {
    return properties.people().pay();
  }

  private RaisingContent.People texts() {
    return content.raising().company().people();
  }

  /** 사기에 따라 손이 뒤집힐 확률에 곱하는 비율(%): 사기 −2면 130%, +2면 70%. */
  int moralePercent(Employee e) {
    return PERCENT - e.morale * rules().moraleFlipPercent();
  }

  private static void shift(Employee e, int by) {
    e.morale = Math.clamp(e.morale + by, MORALE_MIN, MORALE_MAX);
  }

  /**
   * 종목 회의 뒤 (270번): 자기 말이 맞았는데 사장이 다르게 골랐으면 서운하고(사기 −1, #338: 자기 말도 틀렸으면 서운하지 않다), 자기 말대로 골랐는데 맞았으면
   * 신이 난다(+1). 모르겠다고 한 사람은 그대로다. 결산 소식 줄에는 적지 않는다(298번: 사람이 늘면 "누가 맞았다"가 줄줄이 늘어서 길기만 했다). 사기는 직원
   * 상세에 보인다.
   */
  void afterMeeting(CompanyState c) {
    CompanyState.Invest invest = c.invest;
    if (invest == null || invest.remarks == null || invest.choice == null) {
      return;
    }
    String right = invest.up ? InvestEngine.BUY : InvestEngine.SELL;
    boolean bossRight = invest.choice.equals(right);
    for (CompanyState.Remark r : invest.remarks) {
      String said =
          "UP".equals(r.read) ? InvestEngine.BUY : "DOWN".equals(r.read) ? InvestEngine.SELL : null;
      Employee e = c.employees.stream().filter(x -> x.id == r.employeeId).findFirst().orElse(null);
      if (said == null || e == null) {
        continue;
      }
      if (said.equals(right) && !said.equals(invest.choice)) {
        shift(e, -1);
      } else if (said.equals(invest.choice) && bossRight) {
        shift(e, 1);
      }
    }
  }

  /** 분기를 넘길 때 자리에 앉아 있던 사람은 올해 쉰 것이 아니다. */
  void markWorked(CompanyState c) {
    c.employees.stream().filter(e -> e.desk != null).forEach(e -> e.restedAllYear = false);
  }

  /** 연말 (270번): 사기가 0 쪽으로 한 칸 돌아오고, 한 해 내내 쉰 사람은 기운을 되찾는다(+1). 소식 줄을 남긴다. */
  void yearEnd(CompanyState c, List<String> lines) {
    for (Employee e : c.employees) {
      e.morale -= Integer.signum(e.morale);
      if (e.restedAllYear && e.joinedYear < c.year) {
        shift(e, 1);
        lines.add(Korean.fill(texts().rested(), Map.of("name", e.name)));
      }
      e.restedAllYear = true;
    }
  }
}
