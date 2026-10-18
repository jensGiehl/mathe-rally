package de.agiehl.game;

public enum Speed {
    RELAXED(10_000, 1.0, 0.8),
    NORMAL(8_000, 1.5, 1.0),
    FAST(6_000, 2.0, 1.35);

    private final int durationMillis;
    private final double scoreBoost;
    private final double multiplier;

    Speed(int durationMillis, double scoreBoost, double multiplier) {
        this.durationMillis = durationMillis;
        this.scoreBoost = scoreBoost;
        this.multiplier = multiplier;
    }

    public int roundDurationMillis(int questionNumber) {
        return (int) Math.round(durationMillis / progression(questionNumber));
    }

    public double multiplier(int questionNumber) {
        return multiplier * progression(questionNumber);
    }

    public long pointsFor(int distance, int questionNumber) {
        return Math.round(distance * scoreBoost * progression(questionNumber));
    }

    public double scoreBoost() {
        return scoreBoost;
    }

    private double progression(int questionNumber) {
        return Math.min(2.0, 1.0 + Math.max(0, questionNumber - 9) * 0.025);
    }
}
