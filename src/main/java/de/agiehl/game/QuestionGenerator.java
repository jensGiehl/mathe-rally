package de.agiehl.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.random.RandomGenerator;
import org.springframework.stereotype.Component;

@Component
public class QuestionGenerator {

    public Question generate(int number, List<Operation> operations, int range) {
        var random = RandomGenerator.getDefault();
        var operation = operations.get(random.nextInt(operations.size()));
        var calculation = switch (operation) {
            case MULTIPLICATION -> multiplication(random);
            case ADDITION -> addition(random, range);
            case SUBTRACTION -> subtraction(random, range);
            case DIVISION -> division(random);
        };
        return new Question(number, calculation.prompt(), alternatives(calculation.answer(), random),
                calculation.answer());
    }

    private Calculation multiplication(RandomGenerator random) {
        int left = random.nextInt(1, 11);
        int right = random.nextInt(1, 11);
        return new Calculation(left + " × " + right, left * right);
    }

    private Calculation addition(RandomGenerator random, int range) {
        int left = random.nextInt(1, range);
        int right = random.nextInt(1, range - left + 1);
        return new Calculation(left + " + " + right, left + right);
    }

    private Calculation subtraction(RandomGenerator random, int range) {
        int left = random.nextInt(1, range + 1);
        int right = random.nextInt(1, left + 1);
        return new Calculation(left + " − " + right, left - right);
    }

    private Calculation division(RandomGenerator random) {
        int divisor = random.nextInt(1, 11);
        int quotient = random.nextInt(1, 11);
        return new Calculation(divisor * quotient + " ÷ " + divisor, quotient);
    }

    private List<Integer> alternatives(int answer, RandomGenerator random) {
        var choices = new LinkedHashSet<Integer>();
        choices.add(answer);
        int deviation = Math.max(3, Math.min(20, answer / 3));
        while (choices.size() < 3) {
            int candidate = Math.max(0, answer + random.nextInt(-deviation, deviation + 1));
            choices.add(candidate);
        }
        var answers = new ArrayList<>(choices);
        Collections.shuffle(answers);
        return List.copyOf(answers);
    }

    private record Calculation(String prompt, int answer) {
    }
}
