package de.agiehl.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class GameServiceTest {

    private final Instant now = Instant.parse("2026-10-18T12:00:00Z");
    private final Clock clock = mock(Clock.class);
    private GameService games;

    @BeforeEach
    void setUp() {
        when(clock.instant()).thenReturn(now);
        var generator = mock(QuestionGenerator.class);
        when(generator.generate(anyInt(), anyList(), anyInt())).thenAnswer(invocation ->
                new Question(invocation.getArgument(0), "1 + 1", List.of(1, 2, 3), 2));
        games = new GameService(generator, clock);
    }

    @Test
    void scoresEachRoundOnTheServerAndAcceleratesFromTenthQuestion() {
        var state = games.start(request(Speed.NORMAL));
        assertThat(state.question().number()).isEqualTo(1);
        assertThat(state.roundDurationMs()).isEqualTo(8000);
        assertThat(state.correctAnswer()).isNull();
        for (int round = 1; round <= 8; round++) {
            state = games.answer(state.id(), new AnswerRequest(1, false));
        }
        assertThat(state.question().number()).isEqualTo(9);
        assertThat(state.roundDurationMs()).isEqualTo(8000);
        state = games.answer(state.id(), new AnswerRequest(1, true));
        assertThat(state.question().number()).isEqualTo(10);
        assertThat(state.solved()).isEqualTo(9);
        assertThat(state.score()).isEqualTo(9 * 375);
        assertThat(state.distance()).isEqualTo(9 * 250);
        assertThat(state.roundDurationMs()).isLessThan(8000);
        assertThat(state.speedMultiplier()).isGreaterThan(1);
        state = games.answer(state.id(), new AnswerRequest(1, false));
        assertThat(state.score()).isEqualTo(9 * 375 + 384);
    }

    @Test
    void wrongAnswerEndsTheGameAndFreezesScore() {
        var state = games.start(request(Speed.FAST));
        state = games.answer(state.id(), new AnswerRequest(0, false));
        assertThat(state.running()).isFalse();
        assertThat(state.gameOver()).isTrue();
        assertThat(state.correct()).isFalse();
        assertThat(state.correctAnswer()).isEqualTo(2);
        assertThat(state.solved()).isZero();
        assertThat(state.distance()).isEqualTo(200);
        assertThat(state.score()).isEqualTo(400);
        var id = state.id();
        assertThatThrownBy(() -> games.answer(id, new AnswerRequest(1, true)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThat(games.completedSession(id).score()).isEqualTo(400);
    }

    @Test
    void fasterSettingsEarnHigherPoints() {
        assertThat(Speed.FAST.pointsFor(250, 1)).isGreaterThan(Speed.NORMAL.pointsFor(250, 1));
        assertThat(Speed.NORMAL.pointsFor(250, 1)).isGreaterThan(Speed.RELAXED.pointsFor(250, 1));
        assertThat(Speed.FAST.roundDurationMillis(1000)).isEqualTo(3000);
    }

    @Test
    void rejectsInvalidRangeAndIncompleteScoreSubmission() {
        assertThatThrownBy(() -> games.start(new GameRequest(List.of(Operation.ADDITION), Speed.NORMAL, 50)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        var state = games.start(request(Speed.NORMAL));
        assertThatThrownBy(() -> games.completedSession(state.id()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("409");
        assertThatThrownBy(() -> games.completedSession(UUID.randomUUID()))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }

    @Test
    void expiresIdleSessions() {
        var state = games.start(request(Speed.RELAXED));
        when(clock.instant()).thenReturn(now.plusSeconds(7201));
        games.removeExpiredSessions();
        assertThatThrownBy(() -> games.answer(state.id(), new AnswerRequest(1, false)))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("404");
    }

    private GameRequest request(Speed speed) {
        return new GameRequest(List.of(Operation.ADDITION), speed, null);
    }
}
