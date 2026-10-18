package de.agiehl.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

class QuestionGeneratorTest {

    private final QuestionGenerator generator = new QuestionGenerator();

    @ParameterizedTest
    @EnumSource(Operation.class)
    void generatesCorrectCalculationsWithThreeDistinctAnswers(Operation operation) {
        for (int number = 1; number <= 150; number++) {
            var question = generator.generate(number, List.of(operation), 100);
            var parts = question.prompt().split(" ");
            int left = Integer.parseInt(parts[0]);
            int right = Integer.parseInt(parts[2]);
            int expected = switch (operation) {
                case MULTIPLICATION -> left * right;
                case ADDITION -> left + right;
                case SUBTRACTION -> left - right;
                case DIVISION -> left / right;
            };
            assertThat(question.number()).isEqualTo(number);
            assertThat(question.correctAnswer()).isEqualTo(expected).isNotNegative();
            assertThat(question.answers()).hasSize(3).doesNotHaveDuplicates().contains(expected);
            assertThat(question.answers()).allMatch(answer -> answer >= 0);
            if (operation == Operation.MULTIPLICATION) {
                assertThat(left).isBetween(1, 10);
                assertThat(right).isBetween(1, 10);
            }
            if (operation == Operation.DIVISION) {
                assertThat(right).isBetween(1, 10);
                assertThat(expected).isBetween(1, 10);
                assertThat(left % right).isZero();
            }
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {20, 100, 1000})
    void respectsSelectedRangeForAdditionAndSubtraction(int range) {
        for (var operation : List.of(Operation.ADDITION, Operation.SUBTRACTION)) {
            for (int number = 1; number <= 150; number++) {
                var question = generator.generate(number, List.of(operation), range);
                var parts = question.prompt().split(" ");
                assertThat(Integer.parseInt(parts[0])).isBetween(0, range);
                assertThat(Integer.parseInt(parts[2])).isBetween(0, range);
                assertThat(question.correctAnswer()).isBetween(0, range);
            }
        }
    }
}
