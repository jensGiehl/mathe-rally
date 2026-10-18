const TAU = Math.PI * 2;
const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const random = (seed) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

export class RoadRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.width = 1;
    this.height = 1;
    this.lastLane = 1;
    this.crashStart = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
  }

  render({
    time = 0,
    distance = 0,
    lane = 1,
    progress = 0,
    answers = null,
    active = false,
    turbo = false,
    crashed = false,
  } = {}) {
    if (this.width < 2 || this.height < 2) return;
    this.time = Number.isFinite(time) ? time : 0;
    this.distance = Number.isFinite(distance) ? distance : 0;
    this.lane = clamp(Number.isFinite(lane) ? lane : 1, 0, 2);
    this.horizon = this.height * 0.385;
    this.roadWidth = Math.min(this.width * 0.465, this.height * 0.95);
    this.curve = this.distance * 0.00072;
    const ctx = this.context;
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawLandscape();
    this.drawRoad();
    this.drawScenery();
    if (answers?.length === 3) this.drawAnswers(answers, clamp(progress, 0, 1));
    if (turbo && active) this.drawSpeedLines();
    this.drawCar(turbo && active, crashed);
    if (crashed) {
      this.crashStart ??= this.time;
      this.drawCrash(Math.max(0, this.time - this.crashStart));
    } else {
      this.crashStart = null;
    }
    this.lastLane = this.lane;
  }

  destroy() {
    this.resizeObserver.disconnect();
  }

  roadAt(depth) {
    const p = clamp(depth, 0, 1.15);
    const bend = Math.sin(this.curve + (1 - p) * 2.15) - Math.sin(this.curve);
    return {
      x:
        this.width * 0.5 +
        bend * this.width * 0.075 * Math.pow(Math.max(0, 1 - p), 0.8),
      y: this.horizon + (this.height - this.horizon) * Math.pow(p, 1.65),
      half: this.width * 0.003 + this.roadWidth * Math.pow(p, 1.35),
    };
  }

  polygon(points, fill) {
    const ctx = this.context;
    ctx.beginPath();
    points.forEach(([x, y], index) =>
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
    );
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  roundedRect(x, y, width, height, radius, fill, stroke = null, lineWidth = 1) {
    const ctx = this.context;
    ctx.beginPath();
    ctx.roundRect(
      x,
      y,
      width,
      height,
      Math.max(0, Math.min(radius, width / 2, height / 2)),
    );
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  drawLandscape() {
    const ctx = this.context;
    const w = this.width;
    const h = this.height;
    const sky = ctx.createLinearGradient(0, 0, 0, this.horizon + h * 0.15);
    sky.addColorStop(0, "#79c9ed");
    sky.addColorStop(0.62, "#bce9f3");
    sky.addColorStop(1, "#e3f3df");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const sunX = w * 0.818;
    const sunY = h * 0.146;
    const sunRadius = Math.min(w, h) * 0.043;
    const glow = ctx.createRadialGradient(
      sunX,
      sunY,
      sunRadius * 0.4,
      sunX,
      sunY,
      sunRadius * 4.2,
    );
    glow.addColorStop(0, "rgba(255,247,185,.7)");
    glow.addColorStop(1, "rgba(255,247,185,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(
      sunX - sunRadius * 5,
      sunY - sunRadius * 5,
      sunRadius * 10,
      sunRadius * 10,
    );
    ctx.fillStyle = "#fff5bc";
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, TAU);
    ctx.fill();
    this.cloud(
      w * 0.16 + Math.sin(this.time * 0.012) * w * 0.025,
      h * 0.12,
      Math.min(w * 0.13, h * 0.24),
      0.86,
    );
    this.cloud(
      w * 0.58 + Math.sin(this.time * 0.008 + 2) * w * 0.02,
      h * 0.074,
      Math.min(w * 0.105, h * 0.19),
      0.74,
    );
    this.cloud(w * 0.91, h * 0.278, Math.min(w * 0.07, h * 0.14), 0.5);
    const parallax = Math.sin(this.curve) * w * 0.012;
    ctx.save();
    ctx.translate(parallax, 0);
    this.mountains(
      [
        [-0.1, 0.42],
        [0.015, 0.31],
        [0.1, 0.34],
        [0.22, 0.2],
        [0.3, 0.3],
        [0.39, 0.265],
        [0.48, 0.39],
        [0.57, 0.32],
        [0.68, 0.23],
        [0.76, 0.315],
        [0.86, 0.25],
        [1.04, 0.41],
      ],
      "#a3c9ce",
      "#c6dedd",
    );
    this.mountains(
      [
        [-0.08, 0.44],
        [0.06, 0.35],
        [0.16, 0.36],
        [0.285, 0.16],
        [0.405, 0.32],
        [0.47, 0.31],
        [0.57, 0.42],
        [0.66, 0.34],
        [0.79, 0.215],
        [0.89, 0.325],
        [0.98, 0.3],
        [1.08, 0.43],
      ],
      "#719f9b",
      "#a1c6ae",
    );
    this.polygon(
      [
        [w * 0.218, h * 0.268],
        [w * 0.285, h * 0.16],
        [w * 0.361, h * 0.261],
        [w * 0.317, h * 0.245],
        [w * 0.29, h * 0.222],
        [w * 0.27, h * 0.255],
        [w * 0.252, h * 0.24],
      ],
      "#eaf4e9",
    );
    this.polygon(
      [
        [w * 0.728, h * 0.281],
        [w * 0.79, h * 0.215],
        [w * 0.849, h * 0.282],
        [w * 0.81, h * 0.263],
        [w * 0.793, h * 0.248],
        [w * 0.772, h * 0.271],
        [w * 0.755, h * 0.262],
      ],
      "#e1efe4",
    );
    this.polygon(
      [
        [w * 0.285, h * 0.16],
        [w * 0.405, h * 0.32],
        [w * 0.47, h * 0.31],
        [w * 0.49, h * 0.42],
        [w * 0.32, h * 0.42],
        [w * 0.334, h * 0.3],
      ],
      "rgba(43,101,95,.19)",
    );
    ctx.restore();
    const grass = ctx.createLinearGradient(0, this.horizon, 0, h);
    grass.addColorStop(0, "#87b96b");
    grass.addColorStop(0.28, "#90c86b");
    grass.addColorStop(1, "#69ac4f");
    ctx.fillStyle = grass;
    ctx.fillRect(0, this.horizon, w, h - this.horizon);
    this.hill(
      [
        [-0.08, 0.43],
        [0.06, 0.32],
        [0.2, 0.32],
        [0.35, 0.435],
        [0.49, 0.45],
        [0.55, 0.5],
      ],
      "#6ca56a",
    );
    this.hill(
      [
        [0.51, 0.45],
        [0.61, 0.35],
        [0.78, 0.315],
        [0.91, 0.33],
        [1.08, 0.43],
        [1.12, 0.56],
      ],
      "#68a06a",
    );
    this.hill(
      [
        [0.67, 0.47],
        [0.76, 0.37],
        [0.92, 0.37],
        [1.04, 0.43],
        [1.1, 0.56],
      ],
      "#84b777",
    );
    const lake = ctx.createLinearGradient(0, h * 0.425, 0, h * 0.7);
    lake.addColorStop(0, "#7fc8cb");
    lake.addColorStop(0.55, "#8bd6cf");
    lake.addColorStop(1, "#b6e1bd");
    ctx.beginPath();
    ctx.moveTo(0, h * 0.448);
    ctx.bezierCurveTo(
      w * 0.16,
      h * 0.42,
      w * 0.25,
      h * 0.425,
      w * 0.39,
      h * 0.46,
    );
    ctx.bezierCurveTo(
      w * 0.3,
      h * 0.48,
      w * 0.25,
      h * 0.52,
      w * 0.27,
      h * 0.55,
    );
    ctx.bezierCurveTo(w * 0.26, h * 0.59, w * 0.12, h * 0.61, 0, h * 0.65);
    ctx.closePath();
    ctx.fillStyle = lake;
    ctx.fill();
    ctx.strokeStyle = "rgba(231,255,237,.57)";
    ctx.lineCap = "round";
    for (let i = 0; i < 24; i++) {
      const y = h * (0.455 + random(i + 7) * 0.13);
      const x = w * random(i + 4) * Math.max(0.07, 0.34 - (y / h - 0.45) * 1.4);
      const length = w * (0.009 + random(i) * 0.04);
      ctx.lineWidth = i % 3 ? 1 : 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(this.time * 0.5 + i) * 2, y);
      ctx.lineTo(x + length, y);
      ctx.stroke();
    }
    this.hill(
      [
        [-0.08, 0.68],
        [0.05, 0.61],
        [0.16, 0.6],
        [0.26, 0.62],
        [0.36, 0.67],
        [0.45, 0.82],
      ],
      "#8ec16a",
    );
    this.hill(
      [
        [0.7, 0.64],
        [0.82, 0.54],
        [0.99, 0.53],
        [1.12, 0.57],
        [1.15, 0.76],
      ],
      "#91bf67",
    );
    for (let i = 0; i < 34; i++) {
      const x = w * random(i + 78);
      const y = this.horizon + h * random(i + 43) * 0.045;
      if (x > w * 0.38 && x < w * 0.65) continue;
      this.pine(x, y, h * (0.016 + random(i + 32) * 0.025), i, false);
    }
    this.drawBirds();
  }

  cloud(x, y, width, opacity) {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = `rgba(255,255,250,${opacity})`;
    ctx.beginPath();
    ctx.ellipse(x, y + width * 0.065, width * 0.49, width * 0.085, 0, 0, TAU);
    ctx.ellipse(x - width * 0.17, y, width * 0.19, width * 0.13, 0, 0, TAU);
    ctx.ellipse(
      x + width * 0.065,
      y - width * 0.055,
      width * 0.23,
      width * 0.17,
      0,
      0,
      TAU,
    );
    ctx.ellipse(
      x + width * 0.28,
      y + width * 0.01,
      width * 0.16,
      width * 0.11,
      0,
      0,
      TAU,
    );
    ctx.fill();
    ctx.restore();
  }

  mountains(points, lowerColor, upperColor) {
    const gradient = this.context.createLinearGradient(
      0,
      this.height * 0.15,
      0,
      this.height * 0.45,
    );
    gradient.addColorStop(0, upperColor);
    gradient.addColorStop(1, lowerColor);
    this.polygon(
      [
        ...points.map(([x, y]) => [x * this.width, y * this.height]),
        [this.width * 1.1, this.height * 0.5],
        [-this.width * 0.1, this.height * 0.5],
      ],
      gradient,
    );
  }

  hill(points, color) {
    const ctx = this.context;
    ctx.beginPath();
    ctx.moveTo(points[0][0] * this.width, points[0][1] * this.height);
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i];
      const [nextX, nextY] = points[i + 1];
      ctx.quadraticCurveTo(
        x * this.width,
        y * this.height,
        ((x + nextX) * this.width) / 2,
        ((y + nextY) * this.height) / 2,
      );
    }
    const last = points[points.length - 1];
    ctx.lineTo(last[0] * this.width, last[1] * this.height);
    ctx.lineTo(last[0] * this.width, this.height * 1.1);
    ctx.lineTo(points[0][0] * this.width, this.height * 1.1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  drawBirds() {
    const ctx = this.context;
    ctx.strokeStyle = "rgba(56,107,117,.5)";
    ctx.lineWidth = Math.max(1, this.width * 0.0013);
    for (let i = 0; i < 3; i++) {
      const x =
        this.width * (0.43 + i * 0.018) + Math.sin(this.time * 0.06) * 12;
      const y = this.height * (0.19 + (i % 2) * 0.018);
      const size = this.width * 0.006;
      const wing = Math.sin(this.time * 3 + i) * size * 0.25;
      ctx.beginPath();
      ctx.moveTo(x - size, y - wing);
      ctx.quadraticCurveTo(x - size * 0.4, y - size * 0.7, x, y);
      ctx.quadraticCurveTo(x + size * 0.4, y - size * 0.7, x + size, y - wing);
      ctx.stroke();
    }
  }

  drawRoad() {
    const ctx = this.context;
    const segments = 150;
    const asphalt = ctx.createLinearGradient(0, this.horizon, 0, this.height);
    asphalt.addColorStop(0, "#454f55");
    asphalt.addColorStop(1, "#4a545a");
    this.drawRoadSurface(asphalt);
    for (let i = 0; i < segments; i++) {
      const p = i / segments;
      const nextP = (i + 1) / segments;
      const far = this.roadAt(p);
      const near = this.roadAt(nextP);
      const z = (1 / Math.max(0.012, (p + nextP) / 2) - 1) / 0.003;
      const alternating = Math.floor((z + this.distance) / 24) % 2 === 0;
      for (const side of [-1, 1]) {
        this.roadStripe(
          far,
          near,
          side * 1.05,
          0.025,
          alternating ? "#d7d4b2" : "#d4d1ae",
        );
        this.roadStripe(
          far,
          near,
          side * 1.0125,
          0.0125,
          alternating ? "#f3ede0" : "#df7962",
        );
        this.roadStripe(far, near, side * 0.948, 0.008, "#e7e5d1");
      }
      if (Math.floor((z + this.distance) / 28) % 3 !== 0) {
        this.roadStripe(far, near, -1 / 3, 0.01, "#f7f3d7");
        this.roadStripe(far, near, 1 / 3, 0.01, "#f7f3d7");
      }
    }
    const shine = ctx.createLinearGradient(0, this.horizon, 0, this.height);
    shine.addColorStop(0, "rgba(215,230,210,.20)");
    shine.addColorStop(0.35, "rgba(215,230,210,0)");
    this.drawRoadSurface(shine);
  }

  drawRoadSurface(fill) {
    const ctx = this.context;
    const edge = this.roadAt(1);
    const top = this.roadAt(0);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    for (let i = 0; i <= 30; i++) {
      const road = this.roadAt(i / 30);
      ctx.lineTo(road.x + road.half, road.y);
    }
    ctx.lineTo(edge.x - edge.half, edge.y);
    for (let i = 30; i >= 0; i--) {
      const road = this.roadAt(i / 30);
      ctx.lineTo(road.x - road.half, road.y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  roadStripe(far, near, offset, thickness, color) {
    this.polygon(
      [
        [far.x + far.half * (offset - thickness), far.y],
        [far.x + far.half * (offset + thickness), far.y],
        [near.x + near.half * (offset + thickness), near.y + 1],
        [near.x + near.half * (offset - thickness), near.y + 1],
      ],
      color,
    );
  }

  drawScenery() {
    const scenery = [];
    const cycle = 2600;
    for (let i = 0; i < 42; i++) {
      const z =
        ((((i * cycle) / 42 + 36 - this.distance) % cycle) + cycle) % cycle;
      scenery.push({
        type: i % 8 === 3 ? "tree" : "pine",
        z,
        seed: i,
        side: i % 2 ? 1 : -1,
      });
    }
    for (let i = 0; i < 38; i++) {
      const z = ((((i * cycle) / 38 - this.distance) % cycle) + cycle) % cycle;
      scenery.push({ type: "post", z, seed: i, side: 1 });
      scenery.push({ type: "post", z, seed: i, side: -1 });
    }
    for (let i = 0; i < 30; i++) {
      const z =
        ((((i * cycle) / 30 + 13 - this.distance) % cycle) + cycle) % cycle;
      scenery.push({ type: "flowers", z, seed: i, side: i % 2 ? 1 : -1 });
    }
    scenery.sort((a, b) => b.z - a.z);
    for (const item of scenery) {
      const p = 1 / (1 + item.z * 0.003);
      const road = this.roadAt(p);
      const placement =
        item.type === "post" ? 1.12 : 1.28 + random(item.seed + 22) * 0.78;
      const x = road.x + item.side * road.half * placement;
      const size = this.height * Math.pow(p, 1.25);
      if (x < -size * 0.3 || x > this.width + size * 0.3) continue;
      if (item.type === "post")
        this.post(x, road.y, size * 0.067, item.side, item.seed);
      if (item.type === "pine")
        this.pine(
          x,
          road.y,
          size * (0.19 + random(item.seed + 9) * 0.13),
          item.seed,
          true,
        );
      if (item.type === "tree") this.tree(x, road.y, size * 0.23, item.seed);
      if (item.type === "flowers" && p > 0.22)
        this.flowers(x, road.y, size * 0.042, item.seed);
    }
  }

  pine(x, y, height, seed, shadow) {
    const ctx = this.context;
    const width = height * (0.41 + random(seed) * 0.12);
    if (shadow) {
      ctx.fillStyle = "rgba(47,88,55,.13)";
      ctx.beginPath();
      ctx.ellipse(
        x + width * 0.35,
        y + height * 0.01,
        width * 0.73,
        height * 0.05,
        -0.15,
        0,
        TAU,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#856749";
    ctx.fillRect(
      x - width * 0.055,
      y - height * 0.28,
      width * 0.11,
      height * 0.29,
    );
    const colors = ["#2f7559", "#347f5b", "#408b60"];
    for (let layer = 0; layer < 3; layer++) {
      const layerWidth = width * (1 - layer * 0.2);
      const bottom = y - height * (0.13 + layer * 0.23);
      const top = y - height * (0.6 + layer * 0.2);
      this.polygon(
        [
          [x, top],
          [x + layerWidth / 2, bottom],
          [x + layerWidth * 0.17, bottom - height * 0.018],
          [x, bottom + height * 0.026],
          [x - layerWidth / 2, bottom],
        ],
        colors[layer],
      );
      this.polygon(
        [
          [x, top],
          [x, bottom + height * 0.026],
          [x - layerWidth / 2, bottom],
        ],
        "rgba(19,75,58,.14)",
      );
    }
  }

  tree(x, y, height, seed) {
    const ctx = this.context;
    ctx.fillStyle = "rgba(47,88,55,.13)";
    ctx.beginPath();
    ctx.ellipse(x + height * 0.12, y, height * 0.33, height * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#8a6748";
    ctx.fillRect(
      x - height * 0.035,
      y - height * 0.5,
      height * 0.07,
      height * 0.5,
    );
    const circles = [
      [-0.18, -0.59, 0.25],
      [0.17, -0.58, 0.26],
      [0, -0.79, 0.29],
    ];
    circles.forEach(([dx, dy, radius], index) => {
      ctx.fillStyle = ["#4a9858", "#64a957", "#78b95e"][index];
      ctx.beginPath();
      ctx.arc(x + height * dx, y + height * dy, height * radius, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(213,233,132,.20)";
    ctx.beginPath();
    ctx.arc(x + height * 0.06, y - height * 0.85, height * 0.13, 0, TAU);
    ctx.fill();
    if (seed % 3 === 0) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#eaa565";
        ctx.beginPath();
        ctx.arc(
          x + (random(seed + i) - 0.5) * height * 0.4,
          y - height * (0.5 + random(i + 41) * 0.35),
          height * 0.025,
          0,
          TAU,
        );
        ctx.fill();
      }
    }
  }

  post(x, y, height, side, seed) {
    const ctx = this.context;
    const width = Math.max(1.1, height * 0.19);
    this.roundedRect(
      x - width / 2,
      y - height,
      width,
      height,
      width * 0.16,
      "#f7f1db",
    );
    ctx.fillStyle = "#526965";
    ctx.fillRect(
      x - width * 0.51,
      y - height * 0.75,
      width * 1.02,
      height * 0.25,
    );
    ctx.fillStyle = side === 1 ? "#f19b69" : "#e8efc7";
    ctx.fillRect(
      x - width * 0.24,
      y - height * 0.72,
      width * 0.48,
      height * 0.12,
    );
    if (seed % 9 === 5 && height > 5) {
      ctx.strokeStyle = "#ae9170";
      ctx.lineWidth = Math.max(0.8, height * 0.045);
      ctx.beginPath();
      ctx.moveTo(x, y - height * 0.6);
      ctx.lineTo(x, y - height * 2.3);
      ctx.stroke();
      this.polygon(
        [
          [x, y - height * 2.3],
          [x + side * height * 0.9, y - height * 2.06],
          [x, y - height * 1.8],
        ],
        seed % 2 ? "#f3bb56" : "#e6886e",
      );
    }
  }

  flowers(x, y, size, seed) {
    const ctx = this.context;
    for (let i = 0; i < 4; i++) {
      const fx = x + (random(seed + i) - 0.5) * size * 4;
      const fy = y + random(seed + i + 17) * size * 0.8;
      const tall = size * (0.45 + random(seed + i + 32) * 0.6);
      ctx.strokeStyle = "#4f8d45";
      ctx.lineWidth = Math.max(0.7, size * 0.07);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + size * 0.1, fy - tall);
      ctx.stroke();
      ctx.fillStyle = i % 3 ? "#fff2c9" : "#f5bc77";
      for (let petal = 0; petal < 5; petal++) {
        const angle = (petal * TAU) / 5;
        ctx.beginPath();
        ctx.arc(
          fx + Math.cos(angle) * size * 0.14,
          fy - tall + Math.sin(angle) * size * 0.14,
          Math.max(0.7, size * 0.11),
          0,
          TAU,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#e6b64b";
      ctx.beginPath();
      ctx.arc(fx, fy - tall, Math.max(0.5, size * 0.09), 0, TAU);
      ctx.fill();
    }
  }

  drawAnswers(answers, progress) {
    const ctx = this.context;
    const depth = 0.11 + Math.pow(progress, 1.12) * 0.8;
    const road = this.roadAt(depth);
    const laneWidth = (road.half * 2) / 3;
    const width = laneWidth * 0.78;
    const height = width * 0.57;
    const top = road.y - height * 1.4;
    answers.forEach((answer, index) => {
      const x = road.x + (index - 1) * laneWidth;
      const selected = Math.abs(this.lane - index) < 0.45;
      const postWidth = Math.max(1.5, width * 0.037);
      ctx.fillStyle = "rgba(20,41,47,.17)";
      ctx.beginPath();
      ctx.ellipse(
        x + width * 0.07,
        road.y + height * 0.04,
        width * 0.53,
        height * 0.12,
        0,
        0,
        TAU,
      );
      ctx.fill();
      this.roundedRect(
        x - width * 0.4,
        top + height * 0.7,
        postWidth,
        height * 0.7,
        postWidth * 0.3,
        "#436663",
      );
      this.roundedRect(
        x + width * 0.4 - postWidth,
        top + height * 0.7,
        postWidth,
        height * 0.7,
        postWidth * 0.3,
        "#436663",
      );
      ctx.save();
      ctx.shadowColor = "rgba(25,48,53,.22)";
      ctx.shadowBlur = width * 0.07;
      ctx.shadowOffsetY = width * 0.025;
      this.roundedRect(
        x - width / 2,
        top,
        width,
        height,
        width * 0.075,
        selected ? "#f7fff2" : "#fff9e7",
        selected ? "#78c3a0" : "#e5c17c",
        Math.max(1, width * 0.03),
      );
      ctx.restore();
      this.roundedRect(
        x - width * 0.44,
        top + height * 0.1,
        width * 0.88,
        height * 0.8,
        width * 0.045,
        null,
        selected ? "rgba(42,124,93,.16)" : "rgba(168,130,61,.14)",
        Math.max(0.6, width * 0.009),
      );
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.max(3, height * 0.67)}px "Nunito", "Trebuchet MS", sans-serif`;
      ctx.fillStyle = "#244c4c";
      ctx.fillText(String(answer), x, top + height * 0.53, width * 0.82);
      if (selected && width > 20) {
        const markerY = road.y + height * 0.16;
        this.polygon(
          [
            [x, markerY],
            [x + width * 0.09, markerY + height * 0.1],
            [x - width * 0.09, markerY + height * 0.1],
          ],
          "#c9eaa9",
        );
      }
    });
  }

  drawCar(turbo, crashed) {
    const ctx = this.context;
    const road = this.roadAt(0.9);
    const x = road.x + ((this.lane - 1) * road.half * 2) / 3;
    const width = clamp(
      Math.min(this.width * 0.125, this.height * 0.195),
      36,
      118,
    );
    const height = width * 1.07;
    const y = this.height * 0.953;
    const bounce = crashed
      ? 0
      : Math.sin(this.time * (turbo ? 24 : 10)) * (turbo ? 1.3 : 0.5);
    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.rotate(clamp((this.lane - this.lastLane) * 0.6, -0.045, 0.045));
    ctx.fillStyle = "rgba(13,31,37,.27)";
    ctx.beginPath();
    ctx.ellipse(0, height * 0.012, width * 0.63, height * 0.1, 0, 0, TAU);
    ctx.fill();
    if (turbo) {
      for (const side of [-1, 1]) {
        const flameLength =
          height * (0.3 + Math.sin(this.time * 36 + side) * 0.12);
        this.polygon(
          [
            [side * width * 0.27 - width * 0.055, -height * 0.06],
            [side * width * 0.27 + width * 0.055, -height * 0.06],
            [side * width * 0.27, flameLength],
          ],
          "#7edbff",
        );
        this.polygon(
          [
            [side * width * 0.27 - width * 0.027, -height * 0.06],
            [side * width * 0.27 + width * 0.027, -height * 0.06],
            [side * width * 0.27, flameLength * 0.6],
          ],
          "#fff6ba",
        );
      }
    }
    this.roundedRect(
      -width * 0.52,
      -height * 0.4,
      width * 0.16,
      height * 0.39,
      width * 0.045,
      "#243039",
    );
    this.roundedRect(
      width * 0.36,
      -height * 0.4,
      width * 0.16,
      height * 0.39,
      width * 0.045,
      "#243039",
    );
    const red = ctx.createLinearGradient(-width / 2, -height, width / 2, 0);
    red.addColorStop(0, "#ff8362");
    red.addColorStop(0.43, "#ec5a4c");
    red.addColorStop(1, "#b9363b");
    ctx.beginPath();
    ctx.moveTo(-width * 0.45, -height * 0.12);
    ctx.quadraticCurveTo(
      -width * 0.51,
      -height * 0.14,
      -width * 0.47,
      -height * 0.49,
    );
    ctx.lineTo(-width * 0.32, -height * 0.91);
    ctx.quadraticCurveTo(-width * 0.29, -height, 0, -height);
    ctx.quadraticCurveTo(width * 0.29, -height, width * 0.32, -height * 0.91);
    ctx.lineTo(width * 0.47, -height * 0.49);
    ctx.quadraticCurveTo(
      width * 0.51,
      -height * 0.14,
      width * 0.45,
      -height * 0.12,
    );
    ctx.closePath();
    ctx.fillStyle = red;
    ctx.fill();
    ctx.strokeStyle = "#a23a38";
    ctx.lineWidth = Math.max(1, width * 0.016);
    ctx.stroke();
    this.roundedRect(
      -width * 0.51,
      -height * 0.66,
      width * 0.12,
      height * 0.07,
      width * 0.025,
      "#d94c42",
    );
    this.roundedRect(
      width * 0.39,
      -height * 0.66,
      width * 0.12,
      height * 0.07,
      width * 0.025,
      "#d94c42",
    );
    const glass = ctx.createLinearGradient(
      0,
      -height * 0.91,
      0,
      -height * 0.55,
    );
    glass.addColorStop(0, "#8bc3c8");
    glass.addColorStop(1, "#315263");
    this.polygon(
      [
        [-width * 0.265, -height * 0.9],
        [width * 0.265, -height * 0.9],
        [width * 0.35, -height * 0.57],
        [-width * 0.35, -height * 0.57],
      ],
      "#843939",
    );
    this.polygon(
      [
        [-width * 0.25, -height * 0.884],
        [width * 0.25, -height * 0.884],
        [width * 0.32, -height * 0.59],
        [-width * 0.32, -height * 0.59],
      ],
      glass,
    );
    this.polygon(
      [
        [-width * 0.236, -height * 0.87],
        [width * 0.22, -height * 0.87],
        [-width * 0.13, -height * 0.605],
        [-width * 0.3, -height * 0.605],
      ],
      "rgba(214,245,238,.19)",
    );
    ctx.strokeStyle = "#375461";
    ctx.lineWidth = width * 0.012;
    for (let i = 0; i < 3; i++) {
      const yy = -height * (0.64 + i * 0.06);
      ctx.beginPath();
      ctx.moveTo(-width * (0.3 - i * 0.014), yy);
      ctx.lineTo(width * (0.3 - i * 0.014), yy);
      ctx.stroke();
    }
    this.polygon(
      [
        [-width * 0.065, -height * 0.985],
        [-width * 0.012, -height * 0.985],
        [-width * 0.012, -height * 0.92],
        [-width * 0.065, -height * 0.92],
      ],
      "#ffe9cf",
    );
    this.polygon(
      [
        [width * 0.012, -height * 0.985],
        [width * 0.065, -height * 0.985],
        [width * 0.065, -height * 0.92],
        [width * 0.012, -height * 0.92],
      ],
      "#ffe9cf",
    );
    this.roundedRect(
      -width * 0.42,
      -height * 0.54,
      width * 0.84,
      height * 0.075,
      width * 0.025,
      "#f3755c",
    );
    ctx.strokeStyle = "rgba(255,196,146,.7)";
    ctx.lineWidth = width * 0.018;
    ctx.beginPath();
    ctx.moveTo(-width * 0.42, -height * 0.49);
    ctx.lineTo(width * 0.42, -height * 0.49);
    ctx.stroke();
    const bumper = ctx.createLinearGradient(
      0,
      -height * 0.3,
      0,
      -height * 0.12,
    );
    bumper.addColorStop(0, "#ca403e");
    bumper.addColorStop(1, "#9e3436");
    this.roundedRect(
      -width * 0.455,
      -height * 0.37,
      width * 0.91,
      height * 0.24,
      width * 0.06,
      bumper,
    );
    for (const side of [-1, 1]) {
      const lightX = side < 0 ? -width * 0.406 : width * 0.21;
      this.roundedRect(
        lightX,
        -height * 0.335,
        width * 0.196,
        height * 0.082,
        width * 0.018,
        crashed ? "#ffddb2" : "#ffd18c",
        "#a84038",
        width * 0.012,
      );
      ctx.fillStyle = "#fff1be";
      ctx.fillRect(
        lightX + width * 0.025,
        -height * 0.317,
        width * 0.1,
        height * 0.017,
      );
      this.roundedRect(
        side * width * 0.3 - width * 0.033,
        -height * 0.12,
        width * 0.066,
        height * 0.042,
        width * 0.012,
        "#53626a",
      );
    }
    this.roundedRect(
      -width * 0.12,
      -height * 0.31,
      width * 0.24,
      height * 0.095,
      width * 0.012,
      "#fff7db",
    );
    ctx.fillStyle = "#526068";
    ctx.font = `800 ${width * 0.047}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RALLY", 0, -height * 0.26);
    this.roundedRect(
      -width * 0.43,
      -height * 0.165,
      width * 0.86,
      height * 0.035,
      width * 0.014,
      "#7d3e3d",
    );
    ctx.restore();
  }

  drawSpeedLines() {
    const ctx = this.context;
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const phase = (this.time * 1.8 + random(i + 21)) % 1;
      const side = i % 2 ? 1 : -1;
      const angle = side * (0.5 + random(i + 6) * 0.8);
      const originX = this.width * 0.5;
      const originY = this.height * 0.4;
      const dx = Math.sin(angle) * this.width;
      const dy = (0.18 + random(i + 19) * 0.72) * this.height;
      const start = 0.3 + phase * 0.8;
      const length = 0.04 + phase * 0.09;
      ctx.strokeStyle = `rgba(235,254,249,${phase * 0.45})`;
      ctx.lineWidth = 1 + phase * 1.5;
      ctx.beginPath();
      ctx.moveTo(originX + dx * start, originY + dy * start);
      ctx.lineTo(
        originX + dx * (start + length),
        originY + dy * (start + length),
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCrash(elapsed) {
    const ctx = this.context;
    const w = this.width;
    const h = this.height;
    const strength = clamp(elapsed * 4, 0, 1);
    ctx.fillStyle = `rgba(74,36,40,${0.1 * strength})`;
    ctx.fillRect(0, 0, w, h);
    if (elapsed < 0.18) {
      ctx.fillStyle = `rgba(255,244,218,${(1 - elapsed / 0.18) * 0.45})`;
      ctx.fillRect(0, 0, w, h);
    }
    const impact = { x: w * 0.47, y: h * 0.54 };
    ctx.save();
    ctx.lineJoin = "round";
    const spokes = [];
    for (let i = 0; i < 13; i++) {
      const angle = (i * TAU) / 13 + (random(i + 8) - 0.5) * 0.3;
      const points = [[impact.x, impact.y]];
      for (let step = 1; step <= 5; step++) {
        const radius = step / 5;
        const jitter = (random(i * 8 + step) - 0.5) * w * 0.037 * radius;
        points.push([
          impact.x + Math.cos(angle) * w * 0.8 * radius + jitter,
          impact.y + Math.sin(angle) * h * 0.8 * radius,
        ]);
      }
      spokes.push(points);
      this.crackLine(points, `rgba(29,58,62,${0.25 * strength})`, 2.6);
      this.crackLine(points, `rgba(249,255,249,${0.87 * strength})`, 1.1);
      if (i % 2 === 0) {
        const start = points[2];
        this.crackLine(
          [
            start,
            [
              start[0] + Math.cos(angle + 0.65) * w * 0.12,
              start[1] + Math.sin(angle + 0.65) * h * 0.16,
            ],
            points[4],
          ],
          `rgba(238,255,247,${0.65 * strength})`,
          0.9,
        );
      }
    }
    for (let ring = 1; ring <= 3; ring++) {
      for (let i = 0; i < spokes.length; i++) {
        const a = spokes[i][ring];
        const b = spokes[(i + 1) % spokes.length][ring];
        const midpoint = [
          mix(a[0], b[0], 0.5) + (random(i + ring) - 0.5) * w * 0.03,
          mix(a[1], b[1], 0.5),
        ];
        this.crackLine(
          [a, midpoint, b],
          `rgba(240,255,248,${(0.6 - ring * 0.1) * strength})`,
          0.8,
        );
        if ((i + ring) % 4 === 0)
          this.polygon(
            [[impact.x, impact.y], a, midpoint, b],
            `rgba(227,255,244,${0.055 * strength})`,
          );
      }
    }
    ctx.restore();
  }

  crackLine(points, color, width) {
    const ctx = this.context;
    ctx.beginPath();
    points.forEach(([x, y], index) =>
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}
