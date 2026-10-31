#!/bin/bash
# investor-game 운영 재배포. 저장소에서 git pull 한 뒤 실행한다.
#   ./scripts/deploy.sh
# 순서: DB 백업 → 프론트/백엔드 빌드 → 배포 파일 교체 → 백엔드 재기동(실패 시 이전 jar 로 자동 롤백) → nginx 재시작 → 검증
#
# 운영 스택(compose.yaml, deploy/, app/, data/, backup/)은 저장소가 아니라 $SRV 에 있다.
# 기본값은 ~/srv/investor-game 이고, 환경변수 INVESTOR_SRV 로 바꿀 수 있다.
set -euo pipefail
SRC=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)
SRV=${INVESTOR_SRV:-$HOME/srv/investor-game}
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}

[ -f "$SRV/compose.yaml" ] || { echo "운영 폴더가 없음: $SRV (INVESTOR_SRV 로 지정)"; exit 1; }

echo "① DB 백업"; "$SRV/backup/pg-backup.sh"

echo "② 프론트 빌드"; (cd "$SRC/frontend" && pnpm install --frozen-lockfile >/dev/null && pnpm build >/dev/null) && echo "   OK"
echo "③ 백엔드 빌드"; (cd "$SRC/backend" && ./gradlew bootJar --console=plain -q) && echo "   OK"

echo "④ 배포 파일 교체"
# 이전 jar 를 남겨 둔다. 새 jar 가 기동에 실패하면(예: 마이그레이션 오류) 이걸로 되돌린다.
[ -f "$SRV/app/backend.jar" ] && cp "$SRV/app/backend.jar" "$SRV/app/backend.jar.prev"
rm -rf "$SRV/deploy/web.new" && mkdir -p "$SRV/deploy/web.new" && cp -R "$SRC/frontend/dist/." "$SRV/deploy/web.new/"
cp "$SRC"/backend/build/libs/backend-*.jar "$SRV/app/backend.jar"

echo "⑤ 백엔드 재기동"
cd "$SRV"
wait_healthy() { # $1=컨테이너 $2=최대 초
  local s; for _ in $(seq 1 $(( $2 / 3 ))); do
    s=$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || echo none)
    [ "$s" = healthy ] && return 0; sleep 3
  done; return 1
}
# --no-deps: 백엔드만 재생성한다. 이게 없으면 compose 가 의존하는 nginx 까지 지웠다가, 백엔드가
# healthy 가 안 되면 nginx 를 다시 만들지 않아 사이트가 통째로 내려간다(2026-10-29 장애).
docker compose up -d --no-build --no-deps --force-recreate backend >/dev/null
if ! wait_healthy investor-backend 120; then
  echo "   ✗ 백엔드가 healthy 가 아님. 원인(마지막 ERROR):"
  docker logs investor-backend --tail 200 2>&1 | grep -E 'ERROR|Message\s+:' | grep -vE '^\s+at ' | tail -4 | sed 's/^/     /'
  if [ -f "$SRV/app/backend.jar.prev" ]; then
    echo "   ↩ 이전 jar 로 롤백"
    cp "$SRV/app/backend.jar.prev" "$SRV/app/backend.jar"
    docker compose up -d --no-build --no-deps --force-recreate backend >/dev/null
    wait_healthy investor-backend 120 && echo "   롤백 성공: 이전 버전으로 서비스 중" || echo "   롤백도 실패. docker logs investor-backend 확인"
  fi
  rm -rf "$SRV/deploy/web.new"
  echo "   프론트는 교체하지 않음(백엔드와 짝이 안 맞으므로)"
  exit 1
fi
echo "   backend healthy"

echo "⑥ 프론트 교체 + nginx 재시작"
rm -rf "$SRV/deploy/web" && mv "$SRV/deploy/web.new" "$SRV/deploy/web"
docker compose up -d --no-build nginx >/dev/null && docker compose restart nginx >/dev/null
echo "   OK"

echo "⑦ 검증"
h=$(shasum -a 256 "$SRV/app/backend.jar" | cut -c1-12); c=$(docker exec investor-backend sha256sum /app/app.jar | cut -c1-12)
[ "$h" = "$c" ] && echo "   jar 일치($h)" || { echo "   jar 불일치 host=$h container=$c"; exit 1; }
code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' https://game.kwaklabs.com/)
echo "   https://game.kwaklabs.com → HTTP $code"
docker exec investor-postgres psql -U investor -d investor -tAc "select version from flyway_schema_history where success order by installed_rank desc limit 1" | xargs echo "   최신 마이그레이션:"
echo "완료"
