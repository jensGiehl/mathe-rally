package de.agiehl.game;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record AnswerRequest(
        @NotNull @Min(0) @Max(2) Integer lane,
        boolean turbo,
        @Min(1) Integer questionNumber) {

    public AnswerRequest(Integer lane, boolean turbo) {
        this(lane, turbo, null);
    }
}
