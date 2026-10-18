FROM eclipse-temurin:27-jdk-resolute AS build

WORKDIR /workspace

COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw --batch-mode --no-transfer-progress dependency:go-offline

COPY src src
RUN ./mvnw --batch-mode --no-transfer-progress verify

FROM eclipse-temurin:27-jre-resolute

WORKDIR /app

RUN groupadd --gid 10001 rally && useradd --uid 10001 --gid rally --home-dir /app --no-create-home --shell /usr/sbin/nologin rally && mkdir -p /app/data && chown -R rally:rally /app

COPY --from=build --chown=rally:rally /workspace/target/*.jar /app/app.jar

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

USER rally:rally

VOLUME ["/app/data"]
EXPOSE 8080

ENTRYPOINT ["java", "-Dfile.encoding=UTF-8", "-jar", "/app/app.jar"]
