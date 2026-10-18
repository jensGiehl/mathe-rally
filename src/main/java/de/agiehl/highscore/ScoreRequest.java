package de.agiehl.highscore;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ScoreRequest(
        @NotBlank
        @Size(max = 24)
        @Pattern(regexp = "[\\p{L}\\p{N} ._'−-]+", message = "Verwende für deinen Namen Buchstaben, Zahlen oder Leerzeichen.")
        String name) {
}
