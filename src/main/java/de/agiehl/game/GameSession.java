package de.agiehl.game;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record GameSession(
        UUID id,
        List<Operation> operations,
        Speed speed,
        int range,
        Question question,
        long score,
        long distance,
        int solved,
        boolean running,
        Instant lastActivity,
        AnswerReceipt lastAnswer) {

    public GameSession {
        operations = List.copyOf(operations);
    }

    public GameSession(UUID id, List<Operation> operations, Speed speed, int range, Question question,
            long score, long distance, int solved, boolean running, Instant lastActivity) {
        this(id, operations, speed, range, question, score, distance, solved, running, lastActivity, null);
    }

    public GameSession answer(boolean correct, Question nextQuestion, Instant now) {
        int traveled = correct ? 250 : 200;
        return new GameSession(id, operations, speed, range, nextQuestion,
                score + speed.pointsFor(traveled, question.number()), distance + traveled,
                solved + (correct ? 1 : 0), correct, now);
    }

    public GameSession rememberAnswer(int questionNumber, GameResponse response) {
        return new GameSession(id, operations, speed, range, question, score, distance, solved,
                running, lastActivity, new AnswerReceipt(questionNumber, response));
    }

    public GameResponse view(Boolean correct, Integer previousAnswer) {
        return new GameResponse(id, question.view(), score, distance, solved,
                speed.multiplier(question.number()), speed.roundDurationMillis(question.number()),
                running, correct, previousAnswer, !running, speed.scoreBoost());
    }

    public record AnswerReceipt(int questionNumber, GameResponse response) {
    }
}
