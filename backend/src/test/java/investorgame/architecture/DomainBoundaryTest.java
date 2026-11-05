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

  private static final List<String> DOMAINS = List.of("behavior", "session", "content", "raising");

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

  /** 육성만 다른 도메인(행동 규칙과 콘텐츠)을 쓴다. 회사(공채 시장·배치·투자 회의·결산)를 조율한다 (증권사 육성 설계 4·6절). 나머지는 혼자 선다. */
  @ParameterizedTest
  @MethodSource("domains")
  void 육성_외의_도메인은_다른_도메인을_호출하지_않는다(String domain) {
    Set<String> allowed =
        domain.equals("raising") ? Set.of(domain, "content", "behavior") : Set.of(domain);
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
        .because("도메인 사이의 호출은 육성이 조율한다")
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
  void api는_육성과_세션의_공개_타입만_쓴다() {
    noClasses()
        .that()
        .resideInAPackage(pkg("api") + "..")
        .should()
        .dependOnClassesThat()
        .resideInAnyPackage(
            DOMAINS.stream()
                .filter(d -> !d.equals("session") && !d.equals("raising"))
                .map(d -> pkg(d) + "..")
                .toArray(String[]::new))
        .because("API는 규칙을 판단하지 않고 육성에 요청한다")
        .check(CLASSES);
  }

  private static String pkg(String name) {
    return ROOT + "." + name;
  }
}
