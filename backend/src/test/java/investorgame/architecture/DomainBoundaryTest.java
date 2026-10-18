package investorgame.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** 도메인 경계를 빌드에서 강제한다 (architecture.md 6.1절, domains.md 3절). 에이전트가 여러 도메인을 맡아도 이 규칙은 깨지지 않아야 한다. */
class DomainBoundaryTest {

  private static final String ROOT = "investorgame";

  private static final List<String> DOMAINS =
      List.of(
          "character",
          "behavior",
          "asset",
          "market",
          "household",
          "event",
          "progress",
          "session",
          "content",
          "result");

  private static final JavaClasses CLASSES =
      new ClassFileImporter()
          .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
          .importPackages(ROOT);

  static Stream<String> domains() {
    return DOMAINS.stream();
  }

  @ParameterizedTest
  @MethodSource("domains")
  void 다른_도메인의_internal_패키지는_쓰지_않는다(String domain) {
    noClasses()
        .that()
        .resideOutsideOfPackage(pkg(domain) + "..")
        .should()
        .dependOnClassesThat()
        .resideInAPackage(pkg(domain) + ".internal..")
        .because("다른 도메인은 공개 인터페이스와 record만 쓴다")
        .allowEmptyShould(true)
        .check(CLASSES);
  }

  /** 콘텐츠를 직접 읽을 수 있는 도메인. 이벤트 운영은 정의를, 시장은 종목을 읽는다 (경제 개편 설계 5.1절). */
  private static final Set<String> READS_CONTENT = Set.of("event", "market");

  /** 진행만 다른 게임 도메인을 호출한다. 이벤트 운영과 시장은 콘텐츠만 읽을 수 있다. */
  @ParameterizedTest
  @MethodSource("domains")
  void 진행_외의_도메인은_다른_도메인을_호출하지_않는다(String domain) {
    if (domain.equals("progress")) {
      return;
    }
    Set<String> allowed =
        READS_CONTENT.contains(domain) ? Set.of(domain, "content") : Set.of(domain);
    String[] forbidden =
        DOMAINS.stream()
            .filter(d -> !allowed.contains(d))
            .map(d -> pkg(d) + "..")
            .toArray(String[]::new);

    noClasses()
        .that()
        .resideInAPackage(pkg(domain) + "..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(forbidden)
        .because("도메인 사이의 호출은 진행이 조율한다")
        .allowEmptyShould(true)
        .check(CLASSES);
  }

  @Test
  void 도메인과_common은_api를_모른다() {
    noClasses()
        .that()
        .resideOutsideOfPackage(pkg("api") + "..")
        .should()
        .dependOnClassesThat()
        .resideInAPackage(pkg("api") + "..")
        .check(CLASSES);
  }

  @Test
  void common은_어떤_도메인에도_의존하지_않는다() {
    noClasses()
        .that()
        .resideInAPackage(pkg("common") + "..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(DOMAINS.stream().map(d -> pkg(d) + "..").toArray(String[]::new))
        .check(CLASSES);
  }

  @Test
  void api는_진행과_세션의_공개_타입만_쓴다() {
    noClasses()
        .that()
        .resideInAPackage(pkg("api") + "..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(
            DOMAINS.stream()
                .filter(d -> !d.equals("progress") && !d.equals("session"))
                .map(d -> pkg(d) + "..")
                .toArray(String[]::new))
        .because("API는 규칙을 판단하지 않고 진행에 요청한다")
        .check(CLASSES);
  }

  private static String pkg(String name) {
    return ROOT + "." + name;
  }
}
