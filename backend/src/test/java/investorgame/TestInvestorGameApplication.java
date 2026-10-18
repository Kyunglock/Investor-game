package investorgame;

import org.springframework.boot.SpringApplication;

/** 로컬 Postgres 없이 Testcontainers로 서버를 띄운다: ./gradlew bootTestRun */
public class TestInvestorGameApplication {

  public static void main(String[] args) {
    SpringApplication.from(InvestorGameApplication::main)
        .with(TestcontainersConfiguration.class)
        .run(args);
  }
}
