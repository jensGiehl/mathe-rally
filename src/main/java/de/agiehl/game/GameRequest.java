package de.agiehl.game;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record GameRequest(
        @NotEmpty @Size(max = 4) List<@NotNull Operation> operations,
        @NotNull Speed speed,
        Integer range) {
}
