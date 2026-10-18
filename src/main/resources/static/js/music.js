export class RallyMusic {
  enabled = false;
  context = null;
  output = null;
  timer = null;
  voices = new Set();
  step = 0;
  nextNote = 0;

  constructor() {
    try {
      this.enabled = localStorage.getItem("rallyMusic") === "true";
    } catch {}
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    try {
      localStorage.setItem("rallyMusic", String(enabled));
    } catch {}
    if (!enabled) this.stop();
  }

  async prepare() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.context.addEventListener("statechange", () => {
        if (this.context.state !== "running") this.stop();
      });
    }
    await this.context.resume();
    if (this.context.state !== "running")
      throw new Error("Audio playback is unavailable.");
  }

  update(active) {
    if (!active || !this.enabled || this.context?.state !== "running") {
      this.stop();
      return;
    }
    if (this.timer !== null) return;
    this.output = this.context.createGain();
    this.output.gain.setValueAtTime(0, this.context.currentTime);
    this.output.gain.linearRampToValueAtTime(
      0.12,
      this.context.currentTime + 0.8,
    );
    this.output.connect(this.context.destination);
    this.nextNote = this.context.currentTime + 0.06;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 80);
  }

  schedule() {
    const beat = 60 / 76;
    const chords = [
      [48, 55, 60, 64, 67],
      [45, 52, 57, 60, 64],
      [41, 48, 53, 57, 60],
      [43, 50, 55, 59, 62],
    ];
    const melody = [0, 2, 3, 2, 1, 2, 4, 3];
    this.nextNote = Math.max(this.nextNote, this.context.currentTime);
    while (this.nextNote < this.context.currentTime + 0.25) {
      const chord = chords[Math.floor(this.step / 8) % chords.length];
      const position = this.step % 8;
      if (position === 0) {
        this.note(chord[0], this.nextNote, beat * 7.5, 0.2);
        chord.slice(2).forEach((pitch) =>
          this.note(pitch, this.nextNote, beat * 7.5, 0.1),
        );
      }
      if (position !== 7)
        this.note(
          chord[melody[position]] + 12,
          this.nextNote,
          beat * 1.8,
          0.22,
        );
      this.nextNote += beat;
      this.step = (this.step + 1) % 32;
    }
  }

  note(pitch, start, duration, volume) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      440 * 2 ** ((pitch - 69) / 12),
      start,
    );
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + 0.12);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    envelope.gain.linearRampToValueAtTime(0, start + duration + 0.1);
    oscillator.connect(envelope);
    envelope.connect(this.output);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      envelope.disconnect();
      this.voices.delete(oscillator);
    });
    this.voices.add(oscillator);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.12);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = null;
    if (!this.output) return;
    const output = this.output;
    const now = this.context.currentTime;
    const end = now + 0.18;
    const volume = output.gain.value;
    output.gain.cancelScheduledValues(now);
    output.gain.setValueAtTime(volume, now);
    output.gain.linearRampToValueAtTime(0, end);
    this.voices.forEach((voice) => voice.stop(end));
    this.voices.clear();
    window.setTimeout(() => output.disconnect(), 220);
    this.output = null;
  }
}
