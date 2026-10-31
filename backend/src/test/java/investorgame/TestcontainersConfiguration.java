package investorgame;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/** 로컬 compose.yaml과 같은 이미지(Postgres 17 + pgvector)를 쓴다. 행동 프로필이 vector 열을 쓴다. */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

  @Bean
  @ServiceConnection
  PostgreSQLContainer postgresContainer() {
    return new PostgreSQLContainer(
        DockerImageName.parse("pgvector/pgvector:pg17").asCompatibleSubstituteFor("postgres"));
  }
}
