package de.agiehl.highscore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.agiehl.game.GameSession;
import de.agiehl.game.Operation;
import de.agiehl.game.Question;
import de.agiehl.game.Speed;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class HighscoreRepositoryTest {

    @TempDir
    Path directory;

    @Test
    void persistsScoresAndShowsTopThreePlusPersonalRankAfterReopeningDatabase() {
        var repository = repository();
        var first = repository.save(session(600, 2), "Mia");
        repository.save(session(1200, 5), "Amir");
        repository.save(session(950, 4), "Zoë");
        repository.save(session(700, 3), "Ben");
        var reopened = repository();
        assertThat(reopened.count()).isEqualTo(4);
        assertThat(reopened.topThree()).extracting(HighscoreEntry::name).containsExactly("Amir", "Zoë", "Ben");
        assertThat(reopened.rank(first.id())).isEqualTo(4);
        assertThat(reopened.topThree().getFirst().createdAt()).isEqualTo(Instant.parse("2026-10-18T12:00:00Z"));
    }

    @Test
    void acceptsOneHighscorePerGameAndUsesSolvedCountToBreakScoreTies() {
        var repository = repository();
        var game = session(500, 1);
        var entry = repository.save(game, "Lina");
        assertThatThrownBy(() -> repository.save(game, "Lina erneut")).isInstanceOf(DuplicateKeyException.class);
        repository.save(session(500, 2), "Leo");
        assertThat(repository.topThree()).extracting(HighscoreEntry::name).containsExactly("Leo", "Lina");
        assertThat(repository.findByGameId(game.id())).contains(entry);
        assertThat(repository.rank(entry.id())).isEqualTo(2);
    }

    private HighscoreRepository repository() {
        var source = new DriverManagerDataSource("jdbc:h2:file:" + directory.resolve("highscores").toString().replace('\\', '/'), "sa", "");
        return new HighscoreRepository(new JdbcTemplate(source),
                Clock.fixed(Instant.parse("2026-10-18T12:00:00Z"), ZoneOffset.UTC));
    }

    private GameSession session(long score, int solved) {
        return new GameSession(UUID.randomUUID(), List.of(Operation.ADDITION), Speed.NORMAL, 100,
                new Question(solved + 1, "1 + 1", List.of(1, 2, 3), 2),
                score, solved * 250L + 200, solved, false, Instant.now());
    }
}
