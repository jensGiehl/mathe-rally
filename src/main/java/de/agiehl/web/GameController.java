package de.agiehl.web;

import de.agiehl.game.AnswerRequest;
import de.agiehl.game.GameRequest;
import de.agiehl.game.GameResponse;
import de.agiehl.game.GameService;
import de.agiehl.highscore.HighscoreResponse;
import de.agiehl.highscore.HighscoreService;
import de.agiehl.highscore.ScoreRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GameController {

    private final GameService games;
    private final HighscoreService highscores;

    public GameController(GameService games, HighscoreService highscores) {
        this.games = games;
        this.highscores = highscores;
    }

    @PostMapping("/games")
    @ResponseStatus(HttpStatus.CREATED)
    public GameResponse start(@Valid @RequestBody GameRequest request) {
        return games.start(request);
    }

    @PostMapping("/games/{id}/answers")
    public GameResponse answer(@PathVariable UUID id, @Valid @RequestBody AnswerRequest request) {
        return games.answer(id, request);
    }

    @PostMapping("/games/{id}/score")
    public HighscoreResponse saveScore(@PathVariable UUID id, @Valid @RequestBody ScoreRequest request) {
        return highscores.save(id, request);
    }

    @GetMapping("/highscores")
    public HighscoreResponse highscores(@RequestParam(required = false) UUID gameId) {
        return highscores.get(gameId);
    }
}
