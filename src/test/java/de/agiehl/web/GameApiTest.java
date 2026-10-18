package de.agiehl.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.datasource.url=jdbc:h2:mem:api-tests;DB_CLOSE_DELAY=-1")
class GameApiTest {

    @LocalServerPort
    private int port;

    private final HttpClient client = HttpClient.newHttpClient();
    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void playsAndPersistsAServerScoredGameOnce() throws Exception {
        var started = post("/api/games", """
                {"operations":["ADDITION"],"speed":"NORMAL","range":20}
                """);
        assertThat(started.statusCode()).isEqualTo(201);
        var state = json(started);
        assertThat(state.has("correctAnswer")).isFalse();
        var id = state.get("id").asText();
        var question = state.get("question");
        var operands = question.get("prompt").asText().split(" ");
        int correct = Integer.parseInt(operands[0]) + Integer.parseInt(operands[2]);
        int wrongLane = question.get("answers").get(0).asInt() == correct ? 1 : 0;
        var crashed = post("/api/games/" + id + "/answers", "{\"lane\":" + wrongLane + ",\"turbo\":true}");
        assertThat(crashed.statusCode()).isEqualTo(200);
        assertThat(json(crashed).get("gameOver").asBoolean()).isTrue();
        assertThat(json(crashed).get("score").asLong()).isEqualTo(300);
        var saved = post("/api/games/" + id + "/score", "{\"name\":\"  Zoë  \"}");
        assertThat(saved.statusCode()).isEqualTo(200);
        assertThat(json(saved).get("entry").get("name").asText()).isEqualTo("Zoë");
        var duplicated = post("/api/games/" + id + "/score", "{\"name\":\"Andere\"}");
        assertThat(json(duplicated).get("entry").get("id").asText())
                .isEqualTo(json(saved).get("entry").get("id").asText());
        assertThat(json(duplicated).get("total").asLong()).isEqualTo(json(saved).get("total").asLong());
        var leaderboard = get("/api/highscores?gameId=" + id);
        assertThat(json(leaderboard).get("personal").get("name").asText()).isEqualTo("Zoë");
        assertThat(json(leaderboard).get("rank").asLong()).isPositive();
    }

    @Test
    void validatesSettingsAnswersAndNames() throws Exception {
        assertThat(post("/api/games", "{\"operations\":[],\"speed\":\"NORMAL\"}").statusCode()).isEqualTo(400);
        assertThat(post("/api/games", "{\"operations\":[null],\"speed\":\"NORMAL\"}").statusCode()).isEqualTo(400);
        assertThat(post("/api/games", "{\"operations\":[\"ADDITION\"],\"speed\":\"INVALID\"}").statusCode()).isEqualTo(400);
        assertThat(post("/api/games", "{\"operations\":[\"ADDITION\"],\"speed\":\"NORMAL\",\"range\":42}").statusCode()).isEqualTo(400);
        var started = json(post("/api/games", "{\"operations\":[\"DIVISION\"],\"speed\":\"FAST\"}"));
        var id = started.get("id").asText();
        assertThat(post("/api/games/" + id + "/answers", "{\"lane\":3}").statusCode()).isEqualTo(400);
        assertThat(post("/api/games/" + id + "/answers", "{}").statusCode()).isEqualTo(400);
        assertThat(post("/api/games/" + id + "/answers", "{\"lane\":1,\"questionNumber\":0}").statusCode()).isEqualTo(400);
        assertThat(post("/api/games/" + id + "/score", "{\"name\":\"Lena\"}").statusCode()).isEqualTo(409);
        assertThat(post("/api/games/" + id + "/score", "{\"name\":\"<script>\"}").statusCode()).isEqualTo(400);
        assertThat(get("/api/highscores?gameId=invalid").statusCode()).isEqualTo(400);
    }

    @Test
    void retriesNumberedAnswersWithoutAdvancingOrScoringTwiceIncludingCrash() throws Exception {
        var started = json(post("/api/games", "{\"operations\":[\"ADDITION\"],\"speed\":\"NORMAL\"}"));
        var answerPath = "/api/games/" + started.get("id").asText() + "/answers";
        var firstBody = answerBody(started.get("question"), true);
        var first = post(answerPath, firstBody);
        assertThat(first.statusCode()).isEqualTo(200);
        assertThat(json(first).get("solved").asInt()).isEqualTo(1);
        assertThat(json(first).get("score").asLong()).isEqualTo(375);
        assertThat(post(answerPath, firstBody).body()).isEqualTo(first.body());
        assertThat(post(answerPath, "{\"lane\":0,\"turbo\":false,\"questionNumber\":3}").statusCode()).isEqualTo(409);

        var second = post(answerPath, answerBody(json(first).get("question"), true));
        assertThat(second.statusCode()).isEqualTo(200);
        assertThat(json(second).get("solved").asInt()).isEqualTo(2);
        assertThat(json(second).get("score").asLong()).isEqualTo(750);
        assertThat(post(answerPath, firstBody).statusCode()).isEqualTo(409);

        var crashBody = answerBody(json(second).get("question"), false);
        var crash = post(answerPath, crashBody);
        assertThat(crash.statusCode()).isEqualTo(200);
        assertThat(json(crash).get("gameOver").asBoolean()).isTrue();
        assertThat(json(crash).get("score").asLong()).isEqualTo(1050);
        assertThat(json(crash).get("distance").asLong()).isEqualTo(700);
        assertThat(post(answerPath, crashBody).body()).isEqualTo(crash.body());
    }

    private String answerBody(JsonNode question, boolean correct) {
        var operands = question.get("prompt").asText().split(" ");
        int answer = Integer.parseInt(operands[0]) + Integer.parseInt(operands[2]);
        int lane = 0;
        while ((question.get("answers").get(lane).asInt() == answer) != correct) {
            lane++;
        }
        return "{\"lane\":" + lane + ",\"turbo\":true,\"questionNumber\":"
                + question.get("number").asInt() + "}";
    }

    private HttpResponse<String> post(String path, String body) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private JsonNode json(HttpResponse<String> response) {
        return mapper.readTree(response.body());
    }
}
