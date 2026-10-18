package de.agiehl.highscore;

import de.agiehl.game.GameService;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

@Service
public class HighscoreService {

    private final HighscoreRepository repository;
    private final GameService games;

    public HighscoreService(HighscoreRepository repository, GameService games) {
        this.repository = repository;
        this.games = games;
    }

    public HighscoreResponse save(UUID gameId, ScoreRequest request) {
        var existing = repository.findByGameId(gameId);
        var entry = existing.orElseGet(() -> {
            var session = games.completedSession(gameId);
            try {
                return repository.save(session, request.name().strip().replaceAll(" +", " "));
            } catch (DuplicateKeyException _) {
                return repository.findByGameId(gameId).orElseThrow();
            }
        });
        return leaderboard(entry, true);
    }

    public HighscoreResponse get(UUID gameId) {
        var personal = gameId == null ? null : repository.findByGameId(gameId).orElse(null);
        return leaderboard(personal, false);
    }

    private HighscoreResponse leaderboard(HighscoreEntry personal, boolean includeEntry) {
        return new HighscoreResponse(includeEntry ? personal : null,
                personal == null ? null : repository.rank(personal.id()), repository.count(),
                repository.topThree(), personal);
    }
}
