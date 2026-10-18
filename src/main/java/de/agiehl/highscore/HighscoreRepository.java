package de.agiehl.highscore;

import de.agiehl.game.GameSession;
import de.agiehl.game.Operation;
import de.agiehl.game.Speed;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class HighscoreRepository {

    private static final String RANK_ORDER = "score DESC, solved DESC, distance DESC, created_at ASC, id ASC";
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public HighscoreRepository(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS highscores (
                    id UUID PRIMARY KEY,
                    game_id UUID NOT NULL UNIQUE,
                    player_name VARCHAR(24) NOT NULL,
                    score BIGINT NOT NULL,
                    distance BIGINT NOT NULL,
                    solved INTEGER NOT NULL,
                    speed VARCHAR(16) NOT NULL,
                    operations VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL
                )
                """);
        jdbc.execute("CREATE INDEX IF NOT EXISTS highscores_ranking ON highscores(score DESC, solved DESC, distance DESC, created_at ASC, id ASC)");
    }

    public HighscoreEntry save(GameSession session, String name) {
        var id = UUID.randomUUID();
        var now = clock.instant();
        var operations = session.operations().stream().map(Enum::name).collect(Collectors.joining(","));
        jdbc.update("""
                        INSERT INTO highscores (id, game_id, player_name, score, distance, solved, speed, operations, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, id, session.id(), name, session.score(), session.distance(), session.solved(),
                session.speed().name(), operations, OffsetDateTime.ofInstant(now, ZoneOffset.UTC));
        return new HighscoreEntry(id, name, session.score(), session.distance(), session.solved(),
                session.speed(), session.operations(), now);
    }

    public Optional<HighscoreEntry> findByGameId(UUID gameId) {
        return jdbc.query("SELECT * FROM highscores WHERE game_id = ?", this::map, gameId).stream().findFirst();
    }

    public List<HighscoreEntry> topThree() {
        return jdbc.query("SELECT * FROM highscores ORDER BY " + RANK_ORDER + " FETCH FIRST 3 ROWS ONLY", this::map);
    }

    public long rank(UUID entryId) {
        return jdbc.queryForObject("SELECT position FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY "
                + RANK_ORDER + ") AS position FROM highscores) WHERE id = ?", Long.class, entryId);
    }

    public long count() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM highscores", Long.class);
    }

    private HighscoreEntry map(ResultSet row, int rowNumber) throws SQLException {
        var operations = Arrays.stream(row.getString("operations").split(",")).map(Operation::valueOf).toList();
        return new HighscoreEntry(row.getObject("id", UUID.class), row.getString("player_name"),
                row.getLong("score"), row.getLong("distance"), row.getInt("solved"),
                Speed.valueOf(row.getString("speed")), operations,
                row.getObject("created_at", OffsetDateTime.class).toInstant());
    }
}
