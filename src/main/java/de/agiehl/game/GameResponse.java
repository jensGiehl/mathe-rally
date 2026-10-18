package de.agiehl.game;

import java.util.UUID;

public record GameResponse(
        UUID id,
        Question.QuestionView question,
        long score,
        long distance,
        int solved,
        double speedMultiplier,
        int roundDurationMs,
        boolean running,
        Boolean correct,
        Integer correctAnswer,
        boolean gameOver,
        double scoreBoost) {
}
