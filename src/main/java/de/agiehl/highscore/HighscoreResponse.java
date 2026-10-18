package de.agiehl.highscore;

import java.util.List;

public record HighscoreResponse(
        HighscoreEntry entry,
        Long rank,
        long total,
        List<HighscoreEntry> top,
        HighscoreEntry personal) {
}
