/* Koi pond: ripples at the cursor, koi that follow (then lose interest),
   lily pads, and food pellets on click. Plain Canvas 2D, no dependencies. */

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/* Colour patterns: base body colour + patches along the spine. */
const PATTERNS = [
  { base: '#f7f1e8', spots: [['#e0623f', 0.1, 0.0, 0.55], ['#e0623f', 0.42, 0.2, 0.5], ['#e0623f', 0.66, -0.15, 0.4]] },   // kohaku
  { base: '#f2e4c9', spots: [['#d9a441', 0.05, 0, 0.7], ['#d9a441', 0.35, 0, 0.75], ['#d9a441', 0.65, 0, 0.6]] },          // gold ogon
  { base: '#f7f1e8', spots: [['#e0623f', 0.15, 0.1, 0.6], ['#1e2a2b', 0.38, -0.3, 0.3], ['#e0623f', 0.5, 0.15, 0.45], ['#1e2a2b', 0.7, 0.25, 0.25]] }, // sanke
  { base: '#e9784f', spots: [['#f7f1e8', 0.3, 0.3, 0.35], ['#f7f1e8', 0.6, -0.2, 0.3]] },                                  // orange
  { base: '#f7f1e8', spots: [['#e0623f', 0.04, 0, 0.45]] },                                                              // tancho
];

export class Koi {
  constructor(x, y, opts = {}) {
    this.len = opts.len ?? rand(70, 110);
    this.n = 16;
    this.seg = this.len / this.n;
    this.angle = opts.angle ?? rand(0, TAU);
    this.speed = rand(28, 40);
    this.cruise = this.speed;
    this.phase = rand(0, TAU);
    this.wanderBias = rand(-0.4, 0.4);
    this.pattern = opts.pattern ?? PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    this.depth = opts.depth ?? rand(0.78, 1);
    this.curiosity = rand(0.6, 1);   // how keen it is on the cursor
    this.bored = 0;                 // seconds spent chasing; makes it wander off
    this.pts = [];
    for (let i = 0; i < this.n; i++) {
      this.pts.push({ x: x - Math.cos(this.angle) * this.seg * i, y: y - Math.sin(this.angle) * this.seg * i });
    }
  }
  get head() { return this.pts[0]; }

  update(dt, ctx) {
    const h = this.head;
    const { w, hgt, cursor, pellets, school } = ctx;
    let desired = this.angle + Math.sin(this.phase * 0.23 + this.wanderBias * 9) * 0.9 * dt + this.wanderBias * dt * 0.4;
    let targetSpeed = this.cruise;

    // Food first.
    let food = null, fd = Infinity;
    for (const p of pellets) {
      const d = Math.hypot(p.x - h.x, p.y - h.y);
      if (d < fd && d < 420) { fd = d; food = p; }
    }
    if (food) {
      desired = Math.atan2(food.y - h.y, food.x - h.x);
      targetSpeed = 85;
      if (fd < 10) food.eaten = true;
    } else if (cursor.active) {
      const d = Math.hypot(cursor.x - h.x, cursor.y - h.y);
      // Follow lazily; get bored after a while and drift away, then come back.
      if (d < 380 * this.curiosity && this.bored < 5) {
        this.bored += dt;
        if (d > 46) {
          desired = Math.atan2(cursor.y - h.y, cursor.x - h.x);
          targetSpeed = lerp(this.cruise, 70, clamp((d - 40) / 200, 0, 1));
        } else {
          targetSpeed = this.cruise * 0.6; // circle around the cursor
          desired = Math.atan2(cursor.y - h.y, cursor.x - h.x) + Math.PI / 2;
        }
      } else {
        this.bored = Math.max(0, this.bored - dt * 0.6);
      }
    } else {
      this.bored = Math.max(0, this.bored - dt);
    }

    // Keep away from the edges.
    const m = 90;
    let ex = 0, ey = 0;
    if (h.x < m) ex = 1; else if (h.x > w - m) ex = -1;
    if (h.y < m) ey = 1; else if (h.y > hgt - m) ey = -1;
    if (ex || ey) {
      const edgeA = Math.atan2(ey || Math.sin(this.angle) * 0.2, ex || Math.cos(this.angle) * 0.2);
      desired = this.angle + angleDiff(this.angle, edgeA) * 0.9;
    }

    // Separation.
    for (const o of school) {
      if (o === this) continue;
      const dx = h.x - o.head.x, dy = h.y - o.head.y;
      const d = Math.hypot(dx, dy);
      if (d < 50 && d > 0) {
        const away = Math.atan2(dy, dx);
        desired = this.angle + angleDiff(this.angle, away) * 0.25 + angleDiff(this.angle, desired) * 0.75;
      }
    }

    const turn = clamp(angleDiff(this.angle, desired), -2.2 * dt, 2.2 * dt);
    this.angle += turn;
    this.speed = lerp(this.speed, targetSpeed, 1 - Math.exp(-dt * 1.5));
    this.phase += dt * (2 + this.speed * 0.06);

    // Swim wiggle on the head, then let the body follow like a rope.
    const wig = Math.sin(this.phase * 2.2) * 0.28;
    h.x += Math.cos(this.angle + wig) * this.speed * dt;
    h.y += Math.sin(this.angle + wig) * this.speed * dt;
    for (let i = 1; i < this.n; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      b.x = a.x + Math.cos(ang) * this.seg;
      b.y = a.y + Math.sin(ang) * this.seg;
    }
  }

  width(t) {
    // Body width profile along the spine, head (0) to tail (1).
    const maxW = this.len * 0.13;
    if (t < 0.22) return maxW * (0.62 + 0.38 * Math.sin((t / 0.22) * Math.PI / 2));
    return maxW * Math.max(0.12, Math.cos(((t - 0.22) / 0.78) * Math.PI / 2) ** 1.25);
  }

  outline() {
    const L = [], R = [];
    const P = this.pts;
    for (let i = 0; i < this.n - 2; i++) {
      const a = P[Math.max(0, i - 1)], b = P[i + 1];
      const ang = Math.atan2(a.y - b.y, a.x - b.x);
      const wd = this.width(i / (this.n - 3));
      L.push({ x: P[i].x + Math.cos(ang + Math.PI / 2) * wd, y: P[i].y + Math.sin(ang + Math.PI / 2) * wd });
      R.push({ x: P[i].x + Math.cos(ang - Math.PI / 2) * wd, y: P[i].y + Math.sin(ang - Math.PI / 2) * wd });
    }
    return { L, R };
  }

  tracePath(c, ox = 0, oy = 0) {
    const { L, R } = this.outline();
    const P = this.pts;
    const nose = { x: P[0].x + Math.cos(this.angle) * this.len * 0.06, y: P[0].y + Math.sin(this.angle) * this.len * 0.06 };
    c.beginPath();
    c.moveTo(nose.x + ox, nose.y + oy);
    const smooth = (pts) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        c.quadraticCurveTo(pts[i].x + ox, pts[i].y + oy, mx + ox, my + oy);
      }
    };
    c.quadraticCurveTo(L[0].x + ox, L[0].y + oy, L[0].x + ox, L[0].y + oy);
    smooth(L);
    const tail = P[this.n - 2];
    c.lineTo(tail.x + ox, tail.y + oy);
    const Rr = [...R].reverse();
    c.lineTo(Rr[0].x + ox, Rr[0].y + oy);
    smooth(Rr);
    c.quadraticCurveTo(R[0].x + ox, R[0].y + oy, nose.x + ox, nose.y + oy);
    c.closePath();
  }

  draw(c, shadow = true) {
    const P = this.pts;
    const pat = this.pattern;
    c.save();
    c.globalAlpha = this.depth;

    // Soft shadow on the pond floor.
    if (shadow) {
      c.fillStyle = 'rgba(8, 25, 28, 0.22)';
      this.tracePath(c, 7, 10);
      c.fill();
    }

    // Tail fin: translucent fan that sways.
    const tA = P[this.n - 3], tB = P[this.n - 1];
    const tailAng = Math.atan2(tB.y - tA.y, tB.x - tA.x) + Math.sin(this.phase * 2.2 - 1.2) * 0.35;
    const tl = this.len * 0.3;
    c.fillStyle = hexA(pat.base, 0.55);
    c.beginPath();
    c.moveTo(tA.x, tA.y);
    c.quadraticCurveTo(tB.x + Math.cos(tailAng + 0.6) * tl * 0.6, tB.y + Math.sin(tailAng + 0.6) * tl * 0.6,
      tB.x + Math.cos(tailAng + 0.45) * tl, tB.y + Math.sin(tailAng + 0.45) * tl);
    c.quadraticCurveTo(tB.x + Math.cos(tailAng) * tl * 0.55, tB.y + Math.sin(tailAng) * tl * 0.55,
      tB.x + Math.cos(tailAng - 0.45) * tl, tB.y + Math.sin(tailAng - 0.45) * tl);
    c.quadraticCurveTo(tB.x + Math.cos(tailAng - 0.6) * tl * 0.6, tB.y + Math.sin(tailAng - 0.6) * tl * 0.6, tA.x, tA.y);
    c.fill();

    // Pectoral fins.
    const f = P[3], fb = P[4];
    const ba = Math.atan2(f.y - fb.y, f.x - fb.x);
    const flap = Math.sin(this.phase * 1.4) * 0.35;
    c.fillStyle = hexA(pat.base, 0.6);
    for (const side of [1, -1]) {
      c.save();
      c.translate(f.x + Math.cos(ba + side * Math.PI / 2) * this.width(0.2) * 0.8, f.y + Math.sin(ba + side * Math.PI / 2) * this.width(0.2) * 0.8);
      c.rotate(ba + side * (2.2 + flap));
      c.beginPath();
      c.ellipse(this.len * 0.09, 0, this.len * 0.11, this.len * 0.045, 0, 0, TAU);
      c.fill();
      c.restore();
    }

    // Body.
    c.fillStyle = pat.base;
    this.tracePath(c);
    c.fill();

    // Patches, clipped to the body.
    c.save();
    this.tracePath(c);
    c.clip();
    for (const [col, t, off, size] of pat.spots) {
      const i = Math.min(this.n - 1, Math.floor(t * (this.n - 2)));
      const p = P[i], q = P[Math.min(this.n - 1, i + 1)];
      const a = Math.atan2(p.y - q.y, p.x - q.x);
      const wd = this.width(t);
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(p.x + Math.cos(a + Math.PI / 2) * wd * off, p.y + Math.sin(a + Math.PI / 2) * wd * off,
        this.len * size * 0.22, wd * 1.05, a, 0, TAU);
      c.fill();
    }
    // Light along the back.
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = this.len * 0.03;
    c.beginPath();
    c.moveTo(P[1].x, P[1].y);
    for (let i = 2; i < this.n - 4; i++) c.lineTo(P[i].x, P[i].y);
    c.stroke();
    c.restore();

    // Eyes.
    const eyeOff = this.width(0.05) * 0.6;
    c.fillStyle = 'rgba(20,30,30,0.75)';
    for (const side of [1, -1]) {
      c.beginPath();
      c.arc(P[0].x + Math.cos(this.angle + side * Math.PI / 2) * eyeOff + Math.cos(this.angle) * 2,
        P[0].y + Math.sin(this.angle + side * Math.PI / 2) * eyeOff + Math.sin(this.angle) * 2, Math.max(1.2, this.len * 0.014), 0, TAU);
      c.fill();
    }
    c.restore();
  }
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

class LilyPad {
  constructor(x, y, r, flower = false) {
    this.x = x; this.y = y; this.r = r; this.vx = 0; this.vy = 0;
    this.rot = rand(0, TAU); this.notch = rand(0.25, 0.4); this.flower = flower; this.phase = rand(0, TAU);
    this.hx = x; this.hy = y;
  }
  update(dt) {
    this.phase += dt;
    // Spring back home gently.
    this.vx += (this.hx - this.x) * 0.25 * dt; this.vy += (this.hy - this.y) * 0.25 * dt;
    this.vx *= Math.exp(-dt * 1.2); this.vy *= Math.exp(-dt * 1.2);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += Math.sin(this.phase * 0.4) * 0.02 * dt;
  }
  draw(c, dusk) {
    const { x, y, r } = this;
    c.save();
    c.translate(x, y);
    c.rotate(this.rot);
    c.fillStyle = 'rgba(5,20,22,0.16)';
    c.beginPath(); c.moveTo(6, 8); c.arc(6, 8, r, this.notch, TAU - 0.05); c.closePath(); c.fill();
    const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, dusk ? '#5d7f68' : '#9cc3a0');
    g.addColorStop(1, dusk ? '#2f4f3e' : '#5f9271');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, this.notch, TAU - 0.05); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const a = this.notch + 0.3 + i * ((TAU - this.notch - 0.4) / 7);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); c.stroke();
    }
    if (this.flower) {
      c.rotate(-this.rot * 2);
      for (let layer = 0; layer < 2; layer++) {
        const pr = r * (layer ? 0.32 : 0.45);
        c.fillStyle = layer ? '#f6dcd7' : '#e8b9b2';
        for (let i = 0; i < 8; i++) {
          c.save(); c.rotate(i * TAU / 8 + layer * 0.4);
          c.beginPath(); c.ellipse(pr * 0.55, 0, pr * 0.55, pr * 0.22, 0, 0, TAU); c.fill();
          c.restore();
        }
      }
      c.fillStyle = '#e9c46a';
      c.beginPath(); c.arc(0, 0, r * 0.09, 0, TAU); c.fill();
    }
    c.restore();
  }
}

export class Pond {
  constructor(canvas, { count = 7, pads = true, interactive = true } = {}) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d');
    this.koi = [];
    this.ripples = [];
    this.pellets = [];
    this.pads = [];
    this.cursor = { x: 0, y: 0, active: false, last: 0 };
    this.count = count;
    this.withPads = pads;
    this.running = false;
    this.dusk = false;
    this.lastRipple = 0;
    this.t = 0;
    this.listeners = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (interactive) this.bind();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    const oldW = this.w || r.width, oldH = this.h || r.height;
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.koi.length) {
      const small = this.w < 640;
      const n = small ? Math.max(4, this.count - 2) : this.count;
      for (let i = 0; i < n; i++) {
        this.koi.push(new Koi(rand(120, this.w - 120), rand(120, this.h - 120), {
          len: small ? rand(55, 80) : rand(75, 115),
          pattern: PATTERNS[i % PATTERNS.length],
        }));
      }
    } else {
      for (const k of this.koi) for (const p of k.pts) { p.x *= this.w / oldW; p.y *= this.h / oldH; }
    }
    if (this.withPads) {
      const s = Math.min(this.w, this.h);
      const spots = [[0.1, 0.18, 0.07, true], [0.86, 0.22, 0.055, false], [0.93, 0.78, 0.08, true], [0.07, 0.84, 0.05, false], [0.8, 0.9, 0.04, false]];
      this.pads = spots.map(([x, y, r, f]) => new LilyPad(x * this.w, y * this.h, Math.max(22, r * s), f));
    }
  }

  bind() {
    const target = this.canvas.parentElement;
    const move = (x, y) => {
      const r = this.canvas.getBoundingClientRect();
      const px = x - r.left, py = y - r.top;
      const now = performance.now();
      const dist = Math.hypot(px - this.cursor.x, py - this.cursor.y);
      this.cursor.x = px; this.cursor.y = py; this.cursor.active = true; this.cursor.last = now;
      if (now - this.lastRipple > 110 && dist > 4) {
        this.lastRipple = now;
        this.addRipple(px, py, 34, 1.4, 0.35);
      }
    };
    target.addEventListener('pointermove', (e) => move(e.clientX, e.clientY));
    target.addEventListener('pointerleave', () => { this.cursor.active = false; });
    target.addEventListener('click', (e) => {
      if (e.target.closest('a,button')) return;
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      this.addRipple(x, y, 120, 2.6, 0.7);
      setTimeout(() => this.addRipple(x, y, 70, 2.0, 0.45), 180);
      this.pellets.push({ x, y, born: performance.now(), eaten: false });
      this.emit('feed');
    });
  }

  on(fn) { this.listeners.push(fn); }
  emit(ev) { for (const fn of this.listeners) fn(ev, this); }

  addRipple(x, y, max, life, strength) {
    this.ripples.push({ x, y, max, life, age: 0, strength });
    for (const p of this.pads) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < max * 2.2 && d > 1) {
        const k = (strength * 40) / Math.max(30, d) * 3;
        p.vx += ((p.x - x) / d) * k; p.vy += ((p.y - y) / d) * k;
      }
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.prev = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.prev) / 1000);
      this.prev = now;
      this.step(dt, now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  step(dt, now) {
    this.t += dt;
    if (this.cursor.active && now - this.cursor.last > 4000) this.cursor.active = false;
    const ctx = { w: this.w, hgt: this.h, cursor: this.cursor, pellets: this.pellets, school: this.koi };
    for (const k of this.koi) k.update(dt, ctx);
    this.pellets = this.pellets.filter((p) => !p.eaten && now - p.born < 9000);
    for (const p of this.pads) p.update(dt);
    for (const r of this.ripples) r.age += dt;
    this.ripples = this.ripples.filter((r) => r.age < r.life);
    this.draw();
  }

  drawWater() {
    const { c, w, h } = this;
    const g = c.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    if (this.dusk) { g.addColorStop(0, '#173235'); g.addColorStop(1, '#0a1517'); }
    else { g.addColorStop(0, '#3f7a7a'); g.addColorStop(0.55, '#2f5d62'); g.addColorStop(1, '#1d3d42'); }
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // Drifting soft light patches (cheap caustics).
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = w * (0.5 + 0.45 * Math.sin(this.t * 0.05 + i * 1.7));
      const y = h * (0.5 + 0.4 * Math.cos(this.t * 0.04 + i * 2.3));
      const rr = Math.max(w, h) * 0.22;
      const lg = c.createRadialGradient(x, y, 0, x, y, rr);
      lg.addColorStop(0, this.dusk ? 'rgba(242,184,128,0.04)' : 'rgba(190,230,220,0.07)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lg;
      c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    c.restore();
  }

  drawRipples() {
    const c = this.c;
    for (const r of this.ripples) {
      const t = r.age / r.life;
      const ease = 1 - (1 - t) ** 3;
      const a = (1 - t) * r.strength;
      for (let k = 0; k < 3; k++) {
        const rad = r.max * ease - k * r.max * 0.16;
        if (rad <= 0) continue;
        c.beginPath();
        c.ellipse(r.x, r.y, rad, rad * 0.86, 0, 0, TAU);
        c.strokeStyle = this.dusk ? `rgba(242,200,150,${a * (0.5 - k * 0.13)})` : `rgba(235,250,245,${a * (0.65 - k * 0.18)})`;
        c.lineWidth = 1.6 - k * 0.4;
        c.stroke();
        c.beginPath();
        c.ellipse(r.x + 1.5, r.y + 2, rad, rad * 0.86, 0, 0, TAU);
        c.strokeStyle = `rgba(5,25,28,${a * (0.25 - k * 0.07)})`;
        c.lineWidth = 1.2;
        c.stroke();
      }
    }
  }

  drawPellets(now) {
    const c = this.c;
    for (const p of this.pellets) {
      const age = (now - p.born) / 1000;
      c.fillStyle = `rgba(217,164,65,${Math.max(0, 1 - age / 9)})`;
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.arc(p.x + Math.cos(i * 1.3 + age * 0.3) * (4 + i * 1.5), p.y + Math.sin(i * 1.9 + age * 0.3) * (4 + i), 2.2, 0, TAU);
        c.fill();
      }
    }
  }

  draw() {
    const now = performance.now();
    this.drawWater();
    this.drawPellets(now);
    const sorted = [...this.koi].sort((a, b) => a.depth - b.depth);
    for (const k of sorted) k.draw(this.c);
    this.drawRipples();
    for (const p of this.pads) p.draw(this.c, this.dusk);
  }

  /* Still painted frame for reduced-motion visitors. */
  paintStill() {
    for (let i = 0; i < 60; i++) {
      const ctx = { w: this.w, hgt: this.h, cursor: { active: false }, pellets: [], school: this.koi };
      for (const k of this.koi) k.update(1 / 30, ctx);
    }
    this.draw();
  }
}
