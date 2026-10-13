# ---------- 1단계: 빌드 ----------
FROM eclipse-temurin:17-jdk AS build
WORKDIR /workspace

# 의존성 정의 파일만 먼저 복사해 둔다. 소스가 바뀌어도 이 층은 캐시되어 다시 내려받지 않는다.
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null

COPY src src
# 테스트는 여기서 돌리지 않는다. Testcontainers가 Docker 안에서 Docker를 필요로 해서, GitHub Actions에서 따로 돌린다.
RUN ./gradlew --no-daemon bootJar -x test \
    && rm -f build/libs/*-plain.jar \
    && mv build/libs/*.jar build/app.jar

# ---------- 2단계: 실행 ----------
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# root가 아닌 일반 사용자로 실행한다 (컨테이너가 뚫려도 권한을 최소로)
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /workspace/build/app.jar app.jar
USER app

# 운영 프로파일을 기본으로 켠다 (application-prod.yml). 비밀값은 환경변수로만 받는다.
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

# 서버 안에서만 부르는 헬스체크. /actuator/health 하나만 공개돼 있다
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
