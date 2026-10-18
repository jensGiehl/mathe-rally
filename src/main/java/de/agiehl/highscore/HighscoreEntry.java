package de.agiehl.highscore;

import de.agiehl.game.Operation;
import de.agiehl.game.Speed;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record HighscoreEntry(
        UUID id,
        String name,
        long score,
        long distance,
        int solved,
        Speed speed,
        List<Operation> operations,
        Instant createdAt) {

    public HighscoreEntry {
        operations = List.copyOf(operations);
    }
}
