import { RoadRenderer } from "./road.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const number = new Intl.NumberFormat("de-DE");
const date = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class RallyApi {
  async request(path, body) {
    let response;
    try {
      response = await fetch(`/api${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ApiError(
        "Die Verbindung macht kurz Pause. Bitte versuche es noch einmal.",
        0,
      );
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new ApiError(
        payload.detail ||
          "Das hat leider nicht geklappt. Versuch es noch einmal.",
        response.status,
      );
    return payload;
  }
}

class RallySound {
  enabled = false;
  context = null;

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      this.context.resume().catch(() => {});
      this.play("correct");
    }
    return this.enabled;
  }

  play(kind) {
    if (!this.enabled || !this.context) return;
    const sequences = {
      correct: [523, 659, 784],
      crash: [170, 105, 60],
      turbo: [220, 440, 880],
      lane: [290],
    };
    sequences[kind].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = this.context.currentTime + index * 0.07;
      oscillator.type = kind === "crash" ? "sawtooth" : "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        kind === "crash" ? 0.035 : 0.06,
        start + 0.01,
      );
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    });
  }
}

class Leaderboard {
  constructor(api) {
    this.api = api;
    try {
      this.lastGameId = sessionStorage.getItem("rallyLastGame");
    } catch {
      this.lastGameId = null;
    }
  }

  async refresh() {
    const query = this.lastGameId
      ? `?gameId=${encodeURIComponent(this.lastGameId)}`
      : "";
    try {
      const scores = await this.api.request(`/highscores${query}`);
      this.render($("#sidebar-scores"), scores, false);
      this.render($("#full-scores"), scores, true);
    } catch {
      for (const container of [$("#sidebar-scores"), $("#full-scores")]) {
        container.replaceChildren(
          this.message(
            "Die Bestenliste ist gerade nicht erreichbar. Öffne sie gleich noch einmal.",
          ),
        );
      }
    }
  }

  message(text) {
    const paragraph = document.createElement("p");
    paragraph.className = "empty-scores";
    paragraph.textContent = text;
    return paragraph;
  }

  row(entry, rank, personal) {
    const row = document.createElement("div");
    row.className = `score-row${personal ? " personal" : ""}`;
    const rankLabel = document.createElement("span");
    rankLabel.className = "score-rank";
    rankLabel.textContent = rank;
    const info = document.createElement("span");
    info.className = "score-info";
    const name = document.createElement("span");
    name.className = "score-name";
    name.textContent = `${entry.name}${personal ? " · Du" : ""}`;
    const recorded = document.createElement("span");
    recorded.className = "score-date";
    recorded.textContent = date.format(new Date(entry.createdAt));
    info.append(name, recorded);
    const points = document.createElement("span");
    points.className = "score-points";
    points.textContent = number.format(entry.score);
    const suffix = document.createElement("small");
    suffix.textContent = "Pkt.";
    points.append(suffix);
    row.append(rankLabel, info, points);
    return row;
  }

  render(container, data, includePersonal) {
    container.replaceChildren();
    if (!data.top?.length) {
      container.append(
        this.message("Hier könnte dein Name stehen. Starte die erste Rallye!"),
      );
      return;
    }
    data.top.forEach((entry, index) =>
      container.append(
        this.row(
          entry,
          index + 1,
          includePersonal && entry.id === data.personal?.id,
        ),
      ),
    );
    if (includePersonal && data.personal && data.rank > 3) {
      if (data.rank > 4) {
        const ellipsis = document.createElement("div");
        ellipsis.className = "score-ellipsis";
        ellipsis.textContent = "•••";
        container.append(ellipsis);
      }
      container.append(this.row(data.personal, data.rank, true));
    }
  }
}

class RallyGame {
  api = new RallyApi();
  sound = new RallySound();
  state = "idle";
  game = null;
  lane = 1;
  visualLane = 1;
  progress = 0;
  turbo = false;
  elapsed = 0;
  idleDistance = 0;
  pendingAnswer = null;
  pauseRequested = false;
  lastFrame = performance.now();
  toastTimer = null;
  crashTimer = null;
  confettiFrame = null;

  constructor() {
    this.renderer = new RoadRenderer($("#road"));
    this.leaderboard = new Leaderboard(this.api);
    this.bindControls();
    this.restoreName();
    this.leaderboard.refresh();
    requestAnimationFrame((time) => this.frame(time));
  }

  bindControls() {
    $$(".start-trigger").forEach((button) =>
      button.addEventListener("click", () => this.start()),
    );
    $$(".touch-steer").forEach((button) =>
      button.addEventListener("click", () =>
        this.steer(Number(button.dataset.direction)),
      ),
    );
    $("#turbo-button").addEventListener("click", () => this.boost());
    $("#pause-toggle").addEventListener("click", () => this.pause());
    $("#resume-button").addEventListener("click", () => this.resume());
    $("#play-again").addEventListener("click", () => {
      this.reset();
      this.start();
    });
    $("#back-to-setup").addEventListener("click", () => this.reset());
    $("#score-form").addEventListener("submit", (event) =>
      this.saveScore(event),
    );
    $("#sound-toggle").addEventListener("click", () => {
      try {
        const enabled = this.sound.toggle();
        const button = $("#sound-toggle");
        button.setAttribute("aria-pressed", String(enabled));
        button.setAttribute(
          "aria-label",
          enabled ? "Ton ausschalten" : "Ton einschalten",
        );
        button.title = enabled ? "Ton ausschalten" : "Ton einschalten";
        button.innerHTML = `<svg viewBox="0 0 24 24"><path d="m11 5-6 4H2v6h3l6 4V5Z${enabled ? "M16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14" : "M16 9l5 6m0-6-5 6"}"/></svg>`;
      } catch {
        this.toast("Dein Browser unterstützt hier leider keinen Ton.");
      }
    });
    $("#fullscreen-toggle").addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await $(".play-column").requestFullscreen();
      } catch {
        this.toast("Vollbild ist in diesem Browser nicht verfügbar.");
      }
    });
    $$(".help-trigger").forEach((button) =>
      button.addEventListener("click", () =>
        this.openDialog($("#help-dialog")),
      ),
    );
    $$(".leaderboard-trigger").forEach((button) =>
      button.addEventListener("click", () => {
        this.openDialog($("#leaderboard-dialog"));
        this.leaderboard.refresh();
      }),
    );
    $$("[data-close]").forEach((button) =>
      button.addEventListener("click", () => button.closest("dialog").close()),
    );
    $$("dialog").forEach((dialog) =>
      dialog.addEventListener("click", (event) => {
        if (dialog === $("#result-dialog")) return;
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          dialog.close();
      }),
    );
    $("#result-dialog").addEventListener("cancel", (event) =>
      event.preventDefault(),
    );
    document.addEventListener("keydown", (event) => {
      if (
        $("dialog[open]") ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          document.activeElement?.tagName,
        )
      )
        return;
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "p", "P", "Escape"].includes(
          event.key,
        ) &&
        ["running", "paused", "waiting"].includes(this.state)
      )
        event.preventDefault();
      if (event.repeat) return;
      if (event.key === "ArrowLeft") this.steer(-1);
      if (event.key === "ArrowRight") this.steer(1);
      if (event.key === "ArrowUp") this.boost();
      if (["p", "P", "Escape"].includes(event.key))
        this.state === "paused" ? this.resume() : this.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    window.addEventListener("blur", () => this.pause());
    $$('input[name="speed"]').forEach((input) =>
      input.addEventListener("change", () => {
        if (this.state === "idle")
          $("#hud-boost").textContent =
            `× ${input.value === "RELAXED" ? "1" : input.value === "FAST" ? "2" : "1,5"}`;
      }),
    );
  }

  openDialog(dialog) {
    this.pause();
    dialog.showModal();
  }

  async start() {
    if (this.state !== "idle") return;
    const operations = $$('input[name="operation"]:checked').map(
      (input) => input.value,
    );
    if (!operations.length) {
      this.toast("Wähle mindestens eine Rechenart für deine Rallye.");
      return;
    }
    this.state = "starting";
    this.pauseRequested = false;
    this.lockSettings(true);
    $$(".start-trigger").forEach((button) => {
      button.disabled = true;
    });
    try {
      this.game = await this.api.request("/games", {
        operations,
        speed: $('input[name="speed"]:checked').value,
        range: Number($("#number-range").value),
      });
      this.state = "running";
      this.lane = this.visualLane = 1;
      this.elapsed = this.progress = 0;
      this.turbo = false;
      this.pendingAnswer = null;
      $("#start-screen").hidden = true;
      $("#question-panel").hidden = false;
      $("#pause-toggle").hidden = false;
      $("#game-frame").classList.add("is-running");
      $("#stage-pill").lastChild.textContent = " RALLYE LÄUFT";
      $("#stage-tip").textContent = "Vertrau deinem Kopf.";
      $$(".sidebar-start").forEach((button) => {
        button.textContent = "Deine Rallye läuft …";
      });
      this.showQuestion();
      this.updateHud();
      if (innerWidth < 768)
        $("#game-frame").scrollIntoView({
          behavior: reducedMotion ? "instant" : "smooth",
          block: "start",
        });
      document.activeElement?.blur();
      if (this.pauseRequested || document.hidden || $("dialog[open]"))
        this.pause();
    } catch (error) {
      this.state = "idle";
      this.lockSettings(false);
      $$(".start-trigger").forEach((button) => {
        button.disabled = false;
      });
      this.toast(error.message);
    }
  }

  lockSettings(locked) {
    $("#settings-fields").disabled = locked;
    $("#settings-lock").hidden = !locked;
  }

  showQuestion() {
    const question = this.game.question;
    $("#question-count").textContent =
      `AUFGABE ${question.number}${question.number >= 10 ? " · TEMPO STEIGT" : ""}`;
    $("#question-prompt").textContent = `${question.prompt} = ?`;
    $("#answer-lanes").replaceChildren(
      ...question.answers.map((answer, lane) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", `Spur ${lane + 1}: ${answer}`);
        const arrow = document.createElement("span");
        arrow.textContent = ["←", "•", "→"][lane];
        button.append(arrow, document.createTextNode(String(answer)));
        button.addEventListener("click", () => {
          if (this.state !== "running") return;
          this.lane = lane;
          this.updateLane();
        });
        return button;
      }),
    );
    this.updateLane();
  }

  updateLane() {
    $$("#answer-lanes button").forEach((button, index) => {
      button.classList.toggle("selected", index === this.lane);
      button.setAttribute("aria-pressed", String(index === this.lane));
    });
  }

  steer(direction) {
    if (this.state !== "running") return;
    const previous = this.lane;
    this.lane = Math.max(0, Math.min(2, this.lane + direction));
    if (previous !== this.lane) this.sound.play("lane");
    this.updateLane();
  }

  boost() {
    if (this.state !== "running" || this.turbo) return;
    this.turbo = true;
    $("#turbo-flash").hidden = false;
    this.sound.play("turbo");
  }

  pause() {
    if (["starting", "waiting"].includes(this.state)) {
      this.pauseRequested = true;
      return;
    }
    if (this.state !== "running") return;
    this.pauseRequested = true;
    this.state = "paused";
    $("#pause-screen h2").textContent = "Kleine Verschnaufpause.";
    $("#pause-screen p").textContent = "Deine Rallye wartet auf dich.";
    $("#resume-button").innerHTML =
      'Weiterfahren <span aria-hidden="true">→</span>';
    $("#pause-screen").hidden = false;
  }

  resume() {
    if (this.state !== "paused" || $("dialog[open]")) return;
    $("#pause-screen").hidden = true;
    this.pauseRequested = false;
    this.lastFrame = performance.now();
    document.activeElement?.blur();
    if (this.pendingAnswer) this.submitAnswer();
    else this.state = "running";
  }

  frame(now) {
    const elapsedSeconds = Math.max(0, (now - this.lastFrame) / 1000);
    const delta = Math.min(elapsedSeconds, 0.05);
    this.lastFrame = now;
    if (this.state === "running") {
      const duration = this.game.roundDurationMs / 1000;
      this.elapsed +=
        elapsedSeconds * (this.turbo ? Math.max(5, duration / 0.45) : 1);
      this.progress = Math.min(1, this.elapsed / duration);
      $("#round-progress").style.transform = `scaleX(${1 - this.progress})`;
      if (this.progress >= 1) {
        this.pendingAnswer = {
          lane: this.lane,
          turbo: this.turbo,
          questionNumber: this.game.question.number,
        };
        this.submitAnswer();
      }
    }
    if (this.state === "idle" && !reducedMotion)
      this.idleDistance += delta * 12;
    this.visualLane += (this.lane - this.visualLane) * Math.min(1, delta * 13);
    const displayDistance = this.game
      ? this.game.distance +
        (this.state === "crashed" || this.state === "finished"
          ? 0
          : this.progress * 250)
      : this.idleDistance;
    this.renderer.render({
      time: reducedMotion ? 0 : now / 1000,
      distance: displayDistance,
      lane: this.visualLane,
      progress: this.progress,
      answers: ["running", "paused", "waiting"].includes(this.state)
        ? this.game.question.answers
        : null,
      active: ["running", "waiting"].includes(this.state),
      turbo: this.turbo && this.state === "running" && !reducedMotion,
      crashed: this.state === "crashed",
    });
    if (this.state === "running")
      $("#hud-distance").textContent = number.format(
        Math.floor(displayDistance),
      );
    requestAnimationFrame((time) => this.frame(time));
  }

  async submitAnswer() {
    this.state = "waiting";
    $("#turbo-flash").hidden = true;
    try {
      const next = await this.api.request(
        `/games/${this.game.id}/answers`,
        this.pendingAnswer,
      );
      this.pendingAnswer = null;
      const previous = this.game;
      this.game = next;
      this.updateHud();
      if (next.gameOver) {
        this.crash(previous.question, next.correctAnswer);
        return;
      }
      this.sound.play("correct");
      this.feedback(
        next.question.number === 10
          ? "Stark! Jetzt wird’s flotter ✦"
          : `${["Richtig gut!", "Sauber gerechnet!", "Weiter so!", "Stark!", "Perfekte Spur!"][next.solved % 5]} +${number.format(next.score - previous.score)}`,
      );
      this.elapsed = this.progress = 0;
      this.turbo = false;
      this.state = "running";
      this.showQuestion();
      if (this.pauseRequested || document.hidden || $("dialog[open]"))
        this.pause();
    } catch (error) {
      if ([404, 410].includes(error.status)) {
        this.reset();
        this.toast(
          "Deine Rallye ist abgelaufen. Starte einfach eine neue Runde.",
        );
        return;
      }
      this.state = "paused";
      $("#pause-screen h2").textContent = "Kurzer Boxenstopp.";
      $("#pause-screen p").textContent = error.message;
      $("#resume-button").innerHTML =
        'Erneut versuchen <span aria-hidden="true">↻</span>';
      $("#pause-screen").hidden = false;
    }
  }

  updateHud() {
    $("#hud-score").textContent = number.format(this.game.score);
    $("#hud-distance").textContent = number.format(this.game.distance);
    $("#hud-boost").textContent = `× ${number.format(this.game.scoreBoost)}`;
  }

  feedback(text) {
    const feedback = $("#feedback");
    feedback.classList.remove("show");
    feedback.textContent = text;
    void feedback.offsetWidth;
    feedback.classList.add("show");
  }

  crash(question, correctAnswer) {
    this.state = "crashed";
    this.turbo = false;
    $("#question-panel").hidden = true;
    $("#pause-toggle").hidden = true;
    $("#game-frame").classList.add("crashed");
    $("#stage-pill").lastChild.textContent = " ZIEL ERREICHT";
    this.sound.play("crash");
    this.shatter();
    $("#crash-answer").textContent =
      `Die richtige Spur war: ${question.prompt} = ${correctAnswer}`;
    $("#result-score").textContent = number.format(this.game.score);
    $("#result-distance").textContent =
      `${number.format(this.game.distance)} m`;
    $("#result-solved").textContent = number.format(this.game.solved);
    $("#result-kicker").textContent = "WAS FÜR EINE FAHRT!";
    $("#result-title").innerHTML =
      this.game.solved > 0
        ? "Jede Rallye macht<br>dich ein Stück besser."
        : "Nächste Runde,<br>nächste Chance!";
    $("#score-form").hidden = false;
    $("#save-status").textContent = "";
    $("#result-scores").hidden = true;
    $("#save-score").disabled = false;
    this.restoreName();
    this.crashTimer = setTimeout(
      async () => {
        this.state = "finished";
        if (document.fullscreenElement)
          await document.exitFullscreen().catch(() => {});
        $$("dialog[open]").forEach((dialog) => dialog.close());
        $("#result-dialog").showModal();
      },
      reducedMotion ? 450 : 1100,
    );
  }

  shatter() {
    const svg = $("#windshield");
    const paths = [];
    const center = { x: 550, y: 320 };
    for (let ray = 0; ray < 17; ray++) {
      const angle = (ray * Math.PI * 2) / 17;
      const points = [center];
      for (let step = 1; step <= 5; step++) {
        const radius = step * (76 + (ray % 4) * 11);
        const wobble = step % 2 === 0 ? 0.06 : -0.05;
        points.push({
          x: center.x + Math.cos(angle + wobble) * radius,
          y: center.y + Math.sin(angle + wobble) * radius,
        });
      }
      paths.push(
        `M${points.map((point) => `${point.x},${point.y}`).join("L")}`,
      );
      for (let ring = 1; ring <= 3; ring++) {
        const radius = ring * 90;
        const nextAngle = angle + (Math.PI * 2) / 17;
        paths.push(
          `M${center.x + Math.cos(angle) * radius},${center.y + Math.sin(angle) * radius}l${Math.cos(nextAngle + 0.3) * 20},${Math.sin(nextAngle + 0.3) * 20}L${center.x + Math.cos(nextAngle) * radius},${center.y + Math.sin(nextAngle) * radius}`,
        );
      }
    }
    svg.innerHTML = `<g fill="none" stroke="#253e4c" stroke-opacity=".35" stroke-width="3">${paths.map((path) => `<path d="${path}"/>`).join("")}</g><g fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.4">${paths.map((path) => `<path d="${path}"/>`).join("")}</g>`;
    svg.hidden = false;
  }

  restoreName() {
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith("rallyName="));
    if (!cookie) return;
    try {
      $("#player-name").value = decodeURIComponent(
        cookie.slice("rallyName=".length),
      );
    } catch {}
  }

  async saveScore(event) {
    event.preventDefault();
    const input = $("#player-name");
    input.value = input.value.trim();
    if (!input.reportValidity()) return;
    $("#save-score").disabled = true;
    $("#play-again").disabled = true;
    $("#back-to-setup").disabled = true;
    $("#save-status").textContent = "Dein Rekord wird eingetragen …";
    const finishedGameId = this.game.id;
    try {
      const result = await this.api.request(`/games/${finishedGameId}/score`, {
        name: input.value,
      });
      const savedName = result.entry.name;
      document.cookie = `rallyName=${encodeURIComponent(savedName)}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      try {
        sessionStorage.setItem("rallyLastGame", finishedGameId);
      } catch {}
      this.leaderboard.lastGameId = finishedGameId;
      $("#score-form").hidden = true;
      $("#save-status").textContent =
        `Dein Platz: ${number.format(result.rank)} von ${number.format(result.total)}. Stark gemacht, ${savedName}!`;
      $("#result-scores").hidden = false;
      this.leaderboard.render(
        $("#result-scores"),
        { ...result, personal: result.entry },
        true,
      );
      this.leaderboard.refresh();
      if (result.rank <= 3) {
        $("#result-kicker").textContent =
          `✦ PLATZ ${result.rank} AUF DEM TREPPCHEN ✦`;
        $("#result-title").innerHTML = [
          "Du bist unser<br>Rallye-Champion!",
          "Silber! Was für<br>eine starke Rallye.",
          "Bronze! Du bist<br>auf dem Treppchen.",
        ][result.rank - 1];
        this.celebrate();
      }
    } catch (error) {
      $("#save-status").textContent = error.message;
      $("#save-score").disabled = false;
    } finally {
      $("#play-again").disabled = false;
      $("#back-to-setup").disabled = false;
    }
  }

  celebrate() {
    this.sound.play("correct");
    if (reducedMotion) return;
    const canvas = $("#confetti");
    cancelAnimationFrame(this.confettiFrame);
    canvas.hidden = false;
    canvas.showPopover?.();
    const ctx = canvas.getContext("2d");
    canvas.width = innerWidth * Math.min(devicePixelRatio, 2);
    canvas.height = innerHeight * Math.min(devicePixelRatio, 2);
    ctx.scale(Math.min(devicePixelRatio, 2), Math.min(devicePixelRatio, 2));
    const pieces = Array.from({ length: 135 }, () => ({
      x: Math.random() * innerWidth,
      y: -Math.random() * innerHeight,
      speed: 85 + Math.random() * 150,
      rotation: Math.random() * 6,
      drift: Math.random() * 2 - 1,
      size: 4 + Math.random() * 7,
      color: ["#c8dc7c", "#e4bf66", "#85b8a3", "#f1a995", "#95c9d9"][
        Math.floor(Math.random() * 5)
      ],
    }));
    const began = performance.now();
    let previous = began;
    const draw = (now) => {
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      pieces.forEach((piece) => {
        piece.y += piece.speed * delta;
        piece.x += Math.sin(now / 500 + piece.rotation) * 0.6 + piece.drift;
        piece.rotation += delta;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;
        ctx.globalAlpha = Math.min(1, (6500 - (now - began)) / 1000);
        ctx.fillRect(
          -piece.size / 2,
          -piece.size / 2,
          piece.size,
          piece.size * 0.55,
        );
        ctx.restore();
      });
      if (now - began < 6500) this.confettiFrame = requestAnimationFrame(draw);
      else {
        canvas.hidePopover?.();
        canvas.hidden = true;
      }
    };
    this.confettiFrame = requestAnimationFrame(draw);
  }

  reset() {
    clearTimeout(this.crashTimer);
    cancelAnimationFrame(this.confettiFrame);
    $("#confetti").hidePopover?.();
    $$("dialog[open]").forEach((dialog) => dialog.close());
    this.state = "idle";
    this.game = null;
    this.progress = this.elapsed = 0;
    this.lane = this.visualLane = 1;
    this.turbo = false;
    this.pendingAnswer = null;
    this.pauseRequested = false;
    this.lockSettings(false);
    for (const selector of [
      "#pause-screen",
      "#question-panel",
      "#windshield",
      "#turbo-flash",
      "#pause-toggle",
      "#confetti",
    ])
      $(selector).hidden = true;
    $("#start-screen").hidden = false;
    $("#game-frame").classList.remove("is-running", "crashed");
    $$(".start-trigger").forEach((button) => {
      button.disabled = false;
    });
    $(".sidebar-start").innerHTML =
      'Los geht’s <span aria-hidden="true">→</span>';
    $("#hud-score").textContent = "0";
    $("#hud-distance").textContent = "0";
    $("#stage-pill").lastChild.textContent = " BEREIT, WENN DU ES BIST";
    $("#stage-tip").textContent = "Deine nächste Bestleistung wartet.";
    $('input[name="speed"]:checked').dispatchEvent(new Event("change"));
  }

  toast(message) {
    clearTimeout(this.toastTimer);
    $("#toast").textContent = message;
    $("#toast").hidden = false;
    this.toastTimer = setTimeout(() => {
      $("#toast").hidden = true;
    }, 5500);
  }
}

new RallyGame();
