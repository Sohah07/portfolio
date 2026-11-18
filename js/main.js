import { Pond, Koi } from './pond.js?v=19';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- Theme (dusk mode) ---------- */
const root = document.documentElement;
const duskBtn = $('.dusk-toggle');
let stored = null;
try { stored = localStorage.getItem('theme'); } catch (e) { /* storage blocked */ }
const startDusk = stored ? stored === 'dusk' : (root.dataset.theme === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches);
function setDusk(on) {
  root.dataset.theme = on ? 'dusk' : 'light';
  duskBtn.setAttribute('aria-pressed', String(on));
  if (pond) pond.dusk = on;
  try { localStorage.setItem('theme', on ? 'dusk' : 'light'); } catch (e) { /* ignore */ }
}

/* ---------- 1. Pond ---------- */
const pond = new Pond($('.pond-canvas'), { count: 7 });
setDusk(startDusk);
duskBtn.addEventListener('click', () => setDusk(root.dataset.theme !== 'dusk'));

if (reduceMotion) pond.paintStill(); else pond.start();

// Keyboard visitors land in the pond, so the arrow keys work straight away.
if (window.scrollY < 10 && !location.hash) pondEl0().focus({ preventScroll: true });
function pondEl0() { return document.querySelector('.pond'); }

// Pause the pond when it is off screen.
new IntersectionObserver(([e]) => {
  if (reduceMotion) return;
  e.isIntersecting ? pond.start() : pond.stop();
}).observe($('.pond'));

// Split the hero text into letters so koi passing beneath make them wobble.
const letters = [];
$$('[data-wobble]').forEach((el) => {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch;
    s.setAttribute('aria-hidden', 'true');
    el.appendChild(s);
    letters.push({ el: s, cx: 0, cy: 0, amt: 0, phase: Math.random() * 6 });
  }
});
function measureLetters() {
  const pr = $('.pond').getBoundingClientRect();
  for (const l of letters) {
    l.el.style.transform = '';
    const r = l.el.getBoundingClientRect();
    l.cx = r.left - pr.left + r.width / 2;
    l.cy = r.top - pr.top + r.height / 2;
  }
}
document.fonts?.ready.then(measureLetters);
window.addEventListener('resize', measureLetters);
measureLetters();

if (!reduceMotion) {
  let last = performance.now();
  (function wobble(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (pond.running) {
      for (const l of letters) {
        let near = 0;
        for (const k of pond.koi) {
          for (let i = 0; i < k.n; i += 3) {
            const p = k.pts[i];
            const d = Math.hypot(p.x - l.cx, p.y - l.cy);
            if (d < 70) near = Math.max(near, 1 - d / 70);
          }
        }
        for (const r of pond.ripples) {
          const ringR = r.max * (1 - (1 - r.age / r.life) ** 3);
          const d = Math.abs(Math.hypot(r.x - l.cx, r.y - l.cy) - ringR);
          if (d < 18) near = Math.max(near, (1 - d / 18) * r.strength * 0.8);
        }
        l.amt += (near - l.amt) * Math.min(1, dt * 4);
        l.phase += dt * 5;
        if (l.amt > 0.01) {
          const y = Math.sin(l.phase) * 5 * l.amt;
          const rot = Math.cos(l.phase * 0.8) * 4 * l.amt;
          l.el.style.transform = `translateY(${y.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) skewX(${(rot * 0.6).toFixed(2)}deg)`;
          l.el.style.opacity = String(1 - l.amt * 0.25);
        } else if (l.el.style.transform) {
          l.el.style.transform = ''; l.el.style.opacity = '';
        }
      }
    }
    requestAnimationFrame(wobble);
  })(last);
}

// Dive: as the hero scrolls away, the pond surface fades into paper.
const pondEl = $('.pond');
const topbar = $('.topbar');
function onScroll() {
  const h = pondEl.offsetHeight;
  const p = Math.min(1, Math.max(0, window.scrollY / (h * 0.7)));
  pondEl.style.setProperty('--dive', p.toFixed(3));
  topbar.classList.toggle('solid', window.scrollY > h - 70);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Guide koi: one koi follows you down the page ---------- */
const guideCanvas = $('.guide-koi');
if (!reduceMotion && guideCanvas && getComputedStyle(guideCanvas).display !== 'none') {
  const gc = guideCanvas.getContext('2d');
  const guide = new Koi(55, 300, { len: 62, angle: Math.PI / 2, depth: 0.95 });
  guide.pattern = { base: '#f7f1e8', spots: [['#e07a5f', 0.1, 0, 0.55], ['#e07a5f', 0.45, 0.2, 0.45]] };
  let lastY = window.scrollY, vel = 0, t = 0, lastT = performance.now();
  function sizeGuide() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    guideCanvas.width = 110 * dpr; guideCanvas.height = innerHeight * dpr;
    gc.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeGuide();
  addEventListener('resize', sizeGuide);
  (function swim(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; t += dt;
    const visible = window.scrollY > pondEl.offsetHeight * 0.6;
    guideCanvas.classList.toggle('on', visible);
    if (visible) {
      const dy = window.scrollY - lastY; lastY = window.scrollY;
      vel += (dy / Math.max(dt, 0.001) - vel) * Math.min(1, dt * 3);
      const ty = innerHeight / 2 + Math.max(-1, Math.min(1, vel / 1200)) * innerHeight * 0.32 + Math.sin(t * 0.5) * 60;
      const tx = 55 + Math.sin(t * 0.7) * 22;
      const cursor = { x: tx, y: ty, active: true };
      guide.bored = 0;
      guide.update(dt, { w: 110, hgt: innerHeight, cursor, pellets: [], school: [guide] });
      // Keep it inside the gutter.
      for (const p of guide.pts) p.x = Math.max(12, Math.min(98, p.x));
      gc.clearRect(0, 0, 110, innerHeight);
      guide.draw(gc, false);
    } else {
      lastY = window.scrollY;
    }
    requestAnimationFrame(swim);
  })(lastT);
}

/* ---------- Reveals ---------- */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('in');
    e.target.dispatchEvent(new CustomEvent('reveal'));
    io.unobserve(e.target);
  }
}, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
const observeReveals = () => $$('.reveal, .reveal-rise').forEach((el) => io.observe(el));

/* ---------- 2. Rotating words ---------- */
const words = ['builder', 'teacher', 'storyteller', 'researcher', 'reader'];
const rot = $('.rotator span');
let wi = 0;
if (!reduceMotion) {
  setInterval(() => {
    rot.classList.add('out');
    setTimeout(() => { wi = (wi + 1) % words.length; rot.textContent = words[wi]; rot.classList.remove('out'); }, 600);
  }, 2800);
}

/* ---------- 3. Count up + GradeFlow demo ---------- */
$('.khelo').addEventListener('reveal', () => {
  $$('.stats dt').forEach((dt) => {
    const end = +dt.dataset.count, suf = dt.dataset.suffix || '';
    if (reduceMotion) { dt.textContent = end.toLocaleString() + suf; return; }
    const t0 = performance.now(), dur = 1800;
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur), e = 1 - (1 - p) ** 3;
      dt.textContent = Math.round(end * e).toLocaleString() + (p === 1 ? suf : '');
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });
});

const gf = $('.gf-demo');
function runGradeFlow() {
  const items = $$('.gf-rubric li', gf);
  gf.classList.remove('done');
  items.forEach((li) => li.classList.remove('hit', 'miss'));
  items.forEach((li, i) => setTimeout(() => li.classList.add(+li.dataset.pts > 0 ? 'hit' : 'miss'), 700 + i * 650));
  setTimeout(() => gf.classList.add('done'), 700 + items.length * 650 + 200);
}
$('.gradeflow').addEventListener('reveal', runGradeFlow);
$('.gf-replay').addEventListener('click', runGradeFlow);

/* ---------- 4. Pebbles (GitHub) ---------- */
const ICONS = {
  highlighter: '<path d="M14 46 L34 26 L42 34 L22 54 Z"/><path d="M34 26 L42 18 L50 26 L42 34"/><path class="accent" d="M10 56 H40"/>',
  lens: '<path d="M14 20 L8 28 L14 36"/><path d="M30 20 L36 28 L30 36"/><circle class="accent" cx="40" cy="38" r="10"/><path class="accent" d="M47 45 L56 54"/>',
  house: '<path d="M10 32 L32 12 L54 32"/><path d="M16 28 V52 H48 V28"/><path class="accent" d="M26 52 V40 H38 V52"/>',
  tag: '<path d="M12 12 H34 L54 32 L34 52 L12 30 Z"/><circle class="accent" cx="22" cy="22" r="4"/>',
  scatter: '<path d="M10 54 H54 M10 54 V10"/><circle cx="18" cy="44" r="2.5"/><circle cx="26" cy="40" r="2.5"/><circle cx="32" cy="30" r="2.5"/><circle cx="42" cy="26" r="2.5"/><circle cx="48" cy="16" r="2.5"/><path class="accent" d="M14 48 L52 14"/>',
};
const REPOS = [
  { name: 'Skimatic', repo: 'Skimatic', lang: 'Hackathon project · JavaScript', icon: 'highlighter', tags: ['Hackathon', 'Chrome extension', 'Accessibility'],
    desc: 'A Chrome extension that semantically summarizes an article and highlights its key ideas by category, designed to help readers with ADHD or dyslexia.' },
  { name: 'AI Code Reviewer', repo: 'AI_Code_Reviewer', lang: 'Python', icon: 'lens', tags: ['AST', 'LLM', 'GitHub'],
    desc: 'Reviews pull requests by pairing AST-based static analysis with LLM reasoning to flag bugs, code smells, security risks and missing tests.' },
  { name: 'NYC Airbnb Analysis', repo: 'New-York-AirBnb-Data-Analysis', lang: 'Jupyter', icon: 'house', tags: ['pandas', 'Geospatial', 'Data viz'],
    desc: 'Manhattan is priciest, especially for entire homes and hotel rooms. Listings with more reviews tend to cost less, and no single factor explains price on its own.' },
  { name: 'ASOS Analysis', repo: 'Asos-Data-Analysis', lang: 'Jupyter', icon: 'tag', tags: ['pandas', 'Pricing', 'Inventory'],
    desc: 'A brand strategy analysis found higher-priced brands like Mango that keep selling out, losing revenue to demand that inventory is not meeting.' },
  { name: 'Loan Campaign Model', repo: 'brown-summer-program-', lang: 'Jupyter', icon: 'scatter', tags: ['Regression', 'ML'],
    desc: 'Built at Brown Pre-College: a linear regression model that predicts who responds to a personal-loan campaign.' },
];
const pebbles = $('.pebbles');
REPOS.forEach((r) => {
  const url = `https://github.com/Sohah07/${r.repo}`;
  const el = document.createElement('div');
  el.className = 'pebble reveal';
  el.setAttribute('role', 'listitem');
  el.tabIndex = 0;
  el.innerHTML = `
    <div class="face">
      <svg class="icon" viewBox="0 0 64 64" aria-hidden="true">${ICONS[r.icon]}</svg>
      <h3>${r.name}</h3><span class="lang">${r.lang}</span>${r.unconfirmed ? '<span class="confirm">description to confirm</span>' : ''}
    </div>
    <div class="more">
      <h3>${r.name}</h3>
      <p>${r.desc}</p>
      <div class="tags">${r.tags.map((t) => `<span>${t}</span>`).join('')}</div>
      <a class="btn visit" href="${url}" target="_blank" rel="noopener">View repo ↗</a>
    </div>`;
  const ripple = (x, y) => {
    const ring = document.createElement('span');
    ring.className = 'ring';
    ring.style.setProperty('--rx', x + 'px'); ring.style.setProperty('--ry', y + 'px');
    el.appendChild(ring);
    setTimeout(() => ring.remove(), 1300);
  };
  const open = (e) => {
    if (el.classList.contains('open')) return;
    $$('.pebble.open').forEach((p) => p !== el && p.classList.remove('open'));
    el.classList.add('open');
    const rect = el.getBoundingClientRect();
    ripple(e?.clientX ? e.clientX - rect.left : rect.width / 2, e?.clientY ? e.clientY - rect.top : rect.height / 2);
  };
  if (finePointer) {
    el.addEventListener('mouseenter', open);
    el.addEventListener('mouseleave', () => el.classList.remove('open'));
  }
  el.addEventListener('click', (e) => { if (!e.target.closest('a')) open(e); });
  el.addEventListener('dblclick', (e) => { if (!e.target.closest('a')) window.open(url, '_blank', 'noopener'); });
  el.addEventListener('focus', () => open());
  el.addEventListener('blur', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('open'); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === el) window.open(url, '_blank', 'noopener'); });
  pebbles.appendChild(el);
});

/* ---------- 5. Research: chain + transparency slider ---------- */
const chain = $('.chain');
const hex = () => Math.random().toString(16).slice(2, 6);
for (let i = 0; i < 6; i++) {
  const b = document.createElement('span');
  b.className = 'block';
  b.textContent = hex();
  chain.appendChild(b);
}
$('.journal').addEventListener('reveal', () => {
  $$('.block', chain).forEach((b, i) => setTimeout(() => b.classList.add('on'), 300 + i * 260));
  if (!reduceMotion) setInterval(() => { const bs = $$('.block', chain); bs[Math.floor(Math.random() * bs.length)].textContent = hex(); }, 1400);
});
const slider = $('#transparency');
const levels = ['overview', 'how it works', 'full detail'];
slider.addEventListener('input', () => {
  const v = +slider.value;
  $('#tlevel').textContent = levels[v];
  $$('.layer').forEach((l) => l.classList.toggle('on', +l.dataset.level <= v));
});

/* ---------- 6. Learning stream ---------- */
const STONES = [
  { when: 'year one', ph: true, title: 'GenWise · Manipal University', take: 'Introduction to AI and machine learning: my first real look under the hood.' },
  { when: 'year two', ph: true, title: 'GenWise residential internship', take: "Built an algorithm to solve the Rubik's cube.", gold: true },
  { when: 'Summer 2022', title: 'Boston University Summer Challenge', take: 'Two courses: Economics, where I studied game theory, and Business from the Ground Up, where I led my team from product idea to an investor pitch.',
    courses: [
      { name: 'Business from the Ground Up', note: 'Led Team 4 from a product concept (Butter Booster by Cook-chen) through costs, sales forecasting and break-even to a draft business plan pitched to "investors". I built the financials and the newspaper ad.',
        letter: 'assets/letters/bu-business-from-the-ground-up.pdf', letterLabel: "Read Professor Anastasi's evaluation" },
      { name: 'Economics', note: 'A two-week dive into game theory: Nash equilibria, sequential and repeated games, social choice and Arrow\'s Impossibility Theorem. My group\'s final presentation explored International Economics.',
        letter: 'assets/letters/bu-economics.pdf', letterLabel: "Read Professor Porter's evaluation" },
    ],
    quote: '"You are an innovator, contributing great ideas, challenging conventional wisdom with thoughtfulness and creativity." Professor Tom Anastasi, Questrom School of Business' },
  { when: 'Jul–Aug 2023', title: 'Brown Pre-College: AI, Data Science & ML', take: 'Built a linear regression model to predict response to a personal-loan campaign; data viz, ML and data science foundations.' },
  { when: 'Jan 2024', title: 'Inspirit AI Scholars Program', take: 'Learned data analysis and the foundations of AI; completed as an AI Scholar, a program for high-performing student leaders worldwide.' },
  { when: 'Feb 2024', title: 'Oxford Scholastica research internship', take: 'Co-authored the OxJournal paper on cryptocurrency and blockchain.', gold: true, link: '#research' },
  { when: '2024', ph: true, title: 'Girls Who Code Summer Immersion', take: 'Designed interactive role-play games and learned the core ideas of game design.' },
  { when: 'Spring 2025', title: 'New York Academy of Sciences · Junior Academy', take: 'Team proposal for Hydrolink AI, a transparent and ethical AI framework.', link: '#research' },
];
const stones = $('.stones');
const sheet = $('.sheet');
const sheetBody = $('.sheet-body');
function openSheet(html) {
  sheetBody.innerHTML = html;
  sheet.showModal();
}
$('.sheet-close').addEventListener('click', () => sheet.close());
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

STONES.forEach((s) => {
  const li = document.createElement('li');
  li.className = 'stone reveal';
  li.innerHTML = `
    <span class="when">${s.when}${s.ph ? ' <i class="ph-dot" title="confirm"></i>' : ''}</span>
    <button class="rock${s.gold ? ' gold' : ''}" type="button" aria-label="Details: ${s.title}"></button>
    <div class="card"><h3>${s.title}</h3><p class="take">${s.take}</p>${(s.courses || []).filter((c) => c.letter).map((c) => `<a class="letter-link" href="${c.letter}" target="_blank" rel="noopener">${c.letterLabel} ↗</a>`).join('')}</div>`;
  $('.rock', li).addEventListener('click', () => openSheet(`
    <p class="tag">${s.when}</p>
    <h3 id="sheet-title">${s.title}</h3>
    <p>${s.take}</p>
    ${s.phTake ? '<p class="ph">Add one line on what you learned or made here.</p>' : ''}
    ${s.courses ? `<ul class="courses">${s.courses.map((c) => `<li><h4>${c.name}</h4><p${c.ph ? ' class="ph"' : ''}>${c.note}</p>${c.letter ? `<a class="letter-link" href="${c.letter}" target="_blank" rel="noopener">${c.letterLabel} ↗</a>` : ''}</li>`).join('')}</ul>` : ''}
    ${s.quote ? `<blockquote>${s.quote.replace(/" (.*)$/, '"<cite>$1</cite>')}</blockquote>` : ''}
    ${s.link ? `<p><a href="${s.link}" onclick="this.closest('dialog').close()">See the project ↓</a></p>` : ''}
    <div class="ph-box cert">certificate preview (cropped)</div>`));
  stones.appendChild(li);
});

// Khelo Science photos open larger.
$$('.photo').forEach((b) => b.addEventListener('click', () => openSheet(`
  <p class="tag">Khelo Science</p>
  <h3 id="sheet-title">${b.dataset.caption}</h3>
  <img class="full-photo" src="${b.dataset.src}" alt="${b.querySelector('img').alt}" />`)));

// Draw the stream so it flows evenly through every stone, whatever the card heights.
const streamSvg = $('.stream-path');
const streamWrap = $('.stream-wrap');
function drawStream() {
  // Layout positions (offsetTop/Left) ignore the reveal animation's transforms.
  const wr = { width: streamWrap.clientWidth, height: streamWrap.clientHeight };
  const pts = $$('.stone .rock').map((r) => {
    let x = r.offsetWidth / 2, y = r.offsetHeight / 2, el = r;
    while (el && el !== streamWrap) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return [x, y];
  });
  if (!pts.length) return;
  streamSvg.setAttribute('viewBox', `0 0 ${wr.width} ${wr.height}`);
  const amp = Math.min(46, wr.width * 0.06);
  let d = `M${pts[0][0]} ${Math.max(0, pts[0][1] - 40)} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const dir = i % 2 ? 1 : -1;
    const dy = (y1 - y0) / 3;
    d += ` C${x0 + amp * dir} ${y0 + dy}, ${x1 + amp * dir} ${y1 - dy}, ${x1} ${y1}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0]} ${last[1] + 40}`;
  $('path', streamSvg).setAttribute('d', d);
}
new ResizeObserver(drawStream).observe($('.stones'));
addEventListener('resize', drawStream);
document.fonts?.ready.then(drawStream);

// Stanford Daily video: the cover starts it, native controls take over after.
const screen = $('.screen');
const sdVideo = $('#sd-video');
$('.screen-cover').addEventListener('click', () => {
  screen.classList.add('playing');
  sdVideo.controls = true;
  sdVideo.play().catch(() => {});
  sdVideo.focus();
});

/* ---------- 9. Riverside room ---------- */
// Vinyl: a click just spins the record (no audio); the playlist link sits below it.
const vinylNook = $('.vinyl-nook');
const record = $('.record');
record.addEventListener('click', () => {
  const on = record.getAttribute('aria-pressed') !== 'true';
  record.setAttribute('aria-pressed', String(on));
  vinylNook.classList.toggle('playing', on);
  $('.now-playing').textContent = on ? '♪ spinning' : 'tap the record';
});

// Bookshelf
const BOOKS = [
  { t: 'Pride and Prejudice', c: '#7b4b5a', h: 168 },
  { t: 'The Silent Patient', c: '#2f5d62', h: 162 },
  { t: 'Normal People', c: '#b4523a', h: 150 },
  { t: 'Atomic Habits', c: '#d9a441', h: 150 },
  { t: 'Anne of Green Gables', c: '#5f7f6e', h: 178 },
  { t: 'Sapiens', c: '#3d4a5c', h: 182 },
];
const shelf = $('.shelf');
BOOKS.forEach((b) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'book';
  el.style.height = b.h + 'px';
  el.style.background = b.c;
  el.textContent = b.t;
  el.setAttribute('role', 'listitem');
  el.addEventListener('click', () => openBook(b.t, false));
  shelf.appendChild(el);
});
const cur = document.createElement('button');
cur.type = 'button';
cur.className = 'book lying';
cur.style.background = '#5a2230';
cur.innerHTML = 'The Phantom of the Opera<span class="badge">READING</span>';
cur.addEventListener('click', () => openBook('The Phantom of the Opera', true));
shelf.appendChild(cur);
const AUTHORS = {
  'Pride and Prejudice': 'Jane Austen', 'The Silent Patient': 'Alex Michaelides', 'Normal People': 'Sally Rooney',
  'Atomic Habits': 'James Clear', 'Anne of Green Gables': 'L. M. Montgomery', 'Sapiens': 'Yuval Noah Harari',
  'The Phantom of the Opera': 'Gaston Leroux',
};
// Ratings out of 5. Leave a book out to show "rating coming soon".
const RATINGS = {};
function openBook(title, current) {
  const r = RATINGS[title];
  const stars = r ? '★'.repeat(r) + '☆'.repeat(5 - r) : '';
  openSheet(`
    <p class="tag">${current ? 'currently reading' : 'a favorite'}</p>
    <h3 id="sheet-title">${title}</h3>
    <p class="by">${AUTHORS[title] || ''}</p>
    ${current ? '<p class="book-note">Reading it now.</p>'
      : r ? `<p class="stars big" aria-label="${r} out of 5 stars">${stars}</p>` : '<p class="book-note ph">rating coming soon</p>'}`);
}

// Cinema reel (duplicated so the strip loops seamlessly)
const MOVIES = [
  ["Breakfast at Tiffany's", '#1e2a2b', '#7fb8b0'], ['10 Things I Hate About You', '#b4523a', '#e8c5c1'],
  ['Ratatouille', '#7b4b2a', '#d9a441'], ['Mamma Mia!', '#2f5d8a', '#f2d27a'], ['Little Women', '#5f7f6e', '#e8d9c4'],
];
const track = $('.reel-track');
[...MOVIES, ...MOVIES].forEach(([t, a, b], i) => {
  const f = document.createElement('div');
  f.className = 'frame';
  f.style.background = `linear-gradient(160deg, ${b}, ${a})`;
  f.textContent = t;
  if (i >= MOVIES.length) f.setAttribute('aria-hidden', 'true');
  track.appendChild(f);
});

// Map pins
const PLACES = [
  { name: 'Goa, India', x: 0.25, y: 0.55, tag: 'my favorite place', note: 'Golden-hour sunsets over the Arabian Sea.', photo: 'assets/photos/goa.jpg', alt: 'Sunset reflecting on the sea in Goa', fav: true },
  { name: 'Boston, MA', x: 0.78, y: 0.5, tag: 'places', note: 'My first winter: a frozen Public Garden lagoon.', photo: 'assets/photos/boston-winter.jpg', alt: 'The frozen lagoon in the Boston Public Garden on a clear winter day' },
  { name: 'Amherst, MA', x: 0.62, y: 0.42, tag: 'places', note: 'Home base for college.', photo: 'assets/photos/amherst.jpg', alt: 'The UMass Amherst campus pond and fountain with the Old Chapel tower behind it' },
  { name: 'New York City', x: 0.5, y: 0.78, tag: 'places', note: 'My first trip to NYC.', photo: 'assets/photos/nyc.jpg', alt: 'The main concourse of Grand Central Terminal under its painted constellation ceiling' },
];
const pins = $('.pins');
PLACES.forEach((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pin' + (p.fav ? ' fav' : '');
  b.style.left = p.x * 100 + '%';
  b.style.top = p.y * 100 + '%';
  b.setAttribute('aria-label', p.name);
  b.title = p.name;
  b.addEventListener('click', () => openSheet(`
    <p class="tag">${p.tag}</p><h3 id="sheet-title">${p.name}</h3>
    ${p.photo ? `<img class="full-photo place-photo" src="${p.photo}" alt="${p.alt}" />` : ''}
    <p style="margin-top:1rem">${p.note}</p>`));
  pins.appendChild(b);
});

// Recommendation form: chips + a ripple when you "drop a stone"
$$('.chip').forEach((c) => c.addEventListener('click', () => {
  $$('.chip').forEach((x) => x.setAttribute('aria-checked', String(x === c)));
}));
const recs = $('.recs');
const mini = $('.mini-pond');
recs.addEventListener('submit', (e) => {
  e.preventDefault();
  const txt = $('#rec-text').value.trim();
  const kind = $('.chip[aria-checked="true"]').textContent;
  if (!txt) { $('#rec-text').focus(); $('.thanks').textContent = `what ${kind} should I try?`; return; }
  splash();
  $('.thanks').textContent = `Thank you! Your ${kind} rec landed in the pond.`;
  recs.reset();
  // Demo only: in the real site this posts to a form service (e.g. Formspree) or a small database.
});
function splash() {
  const r = mini.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  mini.width = r.width * dpr; mini.height = r.height * dpr;
  const c = mini.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const btn = $('.recs .btn').getBoundingClientRect();
  const x = btn.left - r.left + btn.width / 2, y = btn.top - r.top + btn.height / 2;
  const t0 = performance.now();
  const color = getComputedStyle(root).getPropertyValue('--pond').trim();
  (function f(now) {
    const t = Math.min(1, (now - t0) / 2200);
    c.clearRect(0, 0, r.width, r.height);
    for (let k = 0; k < 4; k++) {
      const tt = t - k * 0.09;
      if (tt <= 0) continue;
      const rad = (1 - (1 - tt) ** 3) * Math.max(r.width, r.height) * 0.9;
      c.beginPath(); c.ellipse(x, y, rad, rad * 0.7, 0, 0, Math.PI * 2);
      c.strokeStyle = color; c.globalAlpha = (1 - tt) * 0.5; c.lineWidth = 1.5; c.stroke();
    }
    if (t < 1) requestAnimationFrame(f); else c.clearRect(0, 0, r.width, r.height);
  })(t0);
}

observeReveals();
