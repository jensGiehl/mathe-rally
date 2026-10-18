package de.agiehl.game;

import java.util.List;

public record Question(int number, String prompt, List<Integer> answers, int correctAnswer) {

    public Question {
        answers = List.copyOf(answers);
    }

    public boolean accepts(int lane) {
        return answers.get(lane) == correctAnswer;
    }

    public QuestionView view() {
        return new QuestionView(number, prompt, answers);
    }

    public record QuestionView(int number, String prompt, List<Integer> answers) {
    }
}
