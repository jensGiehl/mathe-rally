package de.agiehl.game;

import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GameService {

    private static final Duration SESSION_LIFETIME = Duration.ofHours(2);
    private static final int MAX_SESSIONS = 10_000;

    private final ConcurrentHashMap<UUID, GameSession> sessions = new ConcurrentHashMap<>();
    private final QuestionGenerator generator;
    private final Clock clock;

    public GameService(QuestionGenerator generator, Clock clock) {
        this.generator = generator;
        this.clock = clock;
    }

    public GameResponse start(GameRequest request) {
        int range = request.range() == null ? 100 : request.range();
        if (!List.of(20, 100, 1000).contains(range)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Wähle den Zahlenraum 20, 100 oder 1000.");
        }
        if (sessions.size() >= MAX_SESSIONS) {
            removeExpiredSessions();
            if (sessions.size() >= MAX_SESSIONS) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Die Rennstrecke ist gerade voll. Versuche es später noch einmal.");
            }
        }
        var operations = request.operations().stream().distinct().toList();
        var id = UUID.randomUUID();
        var question = generator.generate(1, operations, range);
        var session = new GameSession(id, operations, request.speed(), range, question,
                0, 0, 0, true, clock.instant());
        sessions.put(id, session);
        return session.view(null, null);
    }

    public GameResponse answer(UUID id, AnswerRequest request) {
        var result = new AtomicReference<GameResponse>();
        sessions.compute(id, (_, session) -> {
            requireAvailable(session);
            if (request.questionNumber() != null) {
                var previous = session.lastAnswer();
                if (previous != null && request.questionNumber() == previous.questionNumber()) {
                    result.set(previous.response());
                    return session;
                }
                if (request.questionNumber() != session.question().number()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Diese Antwort gehört nicht zur aktuellen Aufgabe.");
                }
            }
            if (!session.running()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Dieses Rennen ist bereits beendet.");
            }
            boolean correct = session.question().accepts(request.lane());
            var nextQuestion = correct
                    ? generator.generate(session.solved() + 2, session.operations(), session.range())
                    : session.question();
            var nextSession = session.answer(correct, nextQuestion, clock.instant());
            var response = nextSession.view(correct, session.question().correctAnswer());
            result.set(response);
            return nextSession.rememberAnswer(session.question().number(), response);
        });
        return result.get();
    }

    public GameSession completedSession(UUID id) {
        var session = sessions.get(id);
        requireAvailable(session);
        if (session.running()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Beende zuerst dein Rennen.");
        }
        return session;
    }

    @Scheduled(fixedDelay = 600_000)
    public void removeExpiredSessions() {
        var cutoff = clock.instant().minus(SESSION_LIFETIME);
        sessions.entrySet().removeIf(entry -> entry.getValue().lastActivity().isBefore(cutoff));
    }

    private void requireAvailable(GameSession session) {
        if (session == null || session.lastActivity().plus(SESSION_LIFETIME).isBefore(clock.instant())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Dieses Rennen ist abgelaufen. Starte ein neues Rennen.");
        }
    }
}
