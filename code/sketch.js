// ============================================================
// Locked Survey — Phase 1 Project Demo
// p5.js 2.x + p5-phone
//
// The survey is locked. To unlock it, the person holding the phone must
// perform a randomly generated sequence of five physical actions. Each action
// is checked live against the phone's own sensors.
//
// The one relation this tests:
//   random action instructions  ->  unlock access to the survey
//
// Built with the same tools as the Class 2/3/5 examples:
//   lockGestures()            - a drag is input, never a page scroll
//   enablePermissionsTap()    - the library's own sensor permission prompt
//   showDesktopQr()           - the library's own QR code, so a laptop can be
//                               used to open the sketch on a phone
//   sensorsEnabled            - did the permission tap succeed
//   accelerationX / Y / Z     - the shake reading
//   createA()                 - a real link element for the survey
//
// The gestures
//   swipe / hold : touch only, no permission needed, most reliable
//   shake        : motion, needs the permission tap, easiest to get wrong
// Voice is deliberately not used - getUserMedia needs HTTPS, a prompt and a
// quiet room, which is too fragile for a live demo.
// ============================================================

// ---------- things to set ----------
let SURVEY_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd22KkCZR0jDiyfum09XB0sS4w4hgihSKz1L37KR1a0BJR4vw/viewform';

const STEPS = 5;          // how many actions one run asks for

// shake tuning
const SHAKE_THRESHOLD = 14;   // acceleration above gravity before a shake counts
const SHAKE_MIN_COUNT = 3;    // crossings needed
const SHAKE_WINDOW_MS = 1200; // they must happen inside this window

// swipe tuning
const SWIPE_MIN_DIST = 70;    // pixels
const SWIPE_MAX_TIME = 900;   // ms
const SWIPE_RATIO = 1.5;      // dominant axis must beat the other by this much

// hold tuning
const HOLD_MS = 1800;
const HOLD_TOLERANCE = 45;    // px of drift allowed

// ---------- state ----------
let state = 'start';     // start | consent | play | unlocked
let sequence = [];       // five action keys, in random order
let stepIndex = 0;
let feedback = '';
let feedbackUntil = 0;
let flashGreen = 0;
let motionRefused = false;

// touch
let touchStart = null;
let touchStartTime = 0;
let touchTravel = 0;
let holdStart = 0;

// shake
let shakeCrossings = [];
let lastAbove = false;

// the survey link (a plain div wrapping a real <a>), shown only when unlocked
let surveyLink = null;
let surveyWrap = null;

// layout
let W, H;

const ACTIONS = {
  'shake':       { label: 'SHAKE', hint: 'shake your phone firmly', kind: 'motion' },
  'swipe-right': { label: 'SWIPE', hint: 'swipe to the right',      kind: 'touch', dir: 'right', arrow: '\u2192' },
  'swipe-left':  { label: 'SWIPE', hint: 'swipe to the left',       kind: 'touch', dir: 'left',  arrow: '\u2190' },
  'swipe-up':    { label: 'SWIPE', hint: 'swipe upwards',           kind: 'touch', dir: 'up',    arrow: '\u2191' },
  'swipe-down':  { label: 'SWIPE', hint: 'swipe downwards',         kind: 'touch', dir: 'down',  arrow: '\u2193' },
  'hold':        { label: 'HOLD',  hint: 'press and hold still',    kind: 'touch' }
};
const POOL = ['shake', 'swipe-right', 'swipe-left', 'swipe-up', 'swipe-down', 'hold'];

// ============================================================
// p5
// ============================================================
function setup() {
  // One canvas pixel per CSS pixel. Without this, p5 2.x sets the canvas CSS
  // size from the width/height passed here, so on a phone with a device pixel
  // ratio of 2 a windowWidth x windowHeight canvas becomes twice the viewport
  // and everything drawn ends up off-centre.
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);

  // a drag is input, not a page scroll or a pinch zoom
  lockGestures();

  // The survey link is a real <a>, wrapped in a plain div that we style and
  // show ourselves. p5's show() rewrites the whole style attribute of its own
  // elements, which overrode the flex centring set here, so the wrapper is
  // plain DOM instead of a p5 element.
  surveyLink = document.createElement('a');
  surveyLink.textContent = 'OPEN THE SURVEY';
  surveyLink.setAttribute('href', SURVEY_URL);
  surveyLink.setAttribute('target', '_blank');
  surveyLink.setAttribute('rel', 'noopener');
  surveyLink.style.cssText =
    'color:#0a0a0a;font-family:Helvetica,Arial,sans-serif;font-weight:bold;' +
    'text-decoration:none;white-space:nowrap;';

  surveyWrap = document.createElement('div');
  surveyWrap.style.cssText =
    'position:fixed;left:0;top:0;display:none;align-items:center;' +
    'justify-content:center;box-sizing:border-box;border-radius:999px;' +
    'background:#1ec878;z-index:10;cursor:pointer;';
  surveyWrap.appendChild(surveyLink);
  document.body.appendChild(surveyWrap);

  // on a laptop, show the library's QR code of this page so it can be opened
  // on a phone. it only makes sense on a public https address.
  if (location.protocol === 'https:' && window.self === window.top) {
    showDesktopQr();
  }

  // a laptop has no motion sensors. this turns true at the first real reading.
  window.addEventListener('devicemotion', function (event) {
    const g = event.accelerationIncludingGravity;
    if (g && g.x !== null) window.__motionArrived = true;
  });

  randomSeed(millis());
  buildSequence();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  W = width; H = height;

  // Set the text alignment here, every frame, not in setup(). Setting it once
  // in setup() does not survive: the running value comes back as "left", so
  // every label starts at its x instead of centring on it. p5 2.x resets the
  // 2D context state between frames, so anything set once in setup() has to be
  // set again here. (Class 6 · 03 Tilt to View does the same for angleMode.)
  textAlign(CENTER, CENTER);

  // a small hook so the state can be read from the console while testing
  window.__demo = {
    state: state, step: stepIndex, total: sequence.length,
    current: currentAction(), seq: sequence.slice(),
    sensors: !!window.sensorsEnabled, locked: !!window.gesturesLocked
  };

  background(17);

  if (flashGreen > 0) {
    noStroke();
    fill(30, 200, 120, flashGreen * 60);
    rect(0, 0, W, H);
    flashGreen *= 0.88;
    if (flashGreen < 0.02) flashGreen = 0;
  }

  if (state === 'start')         drawStart();
  else if (state === 'play')     drawPlay();
  else if (state === 'unlocked') drawUnlocked();

  if (state === 'consent') drawConsent();

  // the survey link only exists on the unlocked screen
  layoutSurveyLink(state === 'unlocked');

  drawFeedback();
  trackShake();
  trackHold();
}

// ============================================================
// screens
// ============================================================
function drawStart() {
  frame();
  noStroke(); fill(255);
  textSize(min(W, H) * 0.075);
  ct('SURVEY LOCKED', W / 2, H * 0.25);

  fill(150);
  textSize(min(W, H) * 0.040);
  ct('This survey opens only for', W / 2, H * 0.37);
  ct('someone standing here, doing', W / 2, H * 0.43);
  ct(wordNumber(STEPS) + ' random actions.', W / 2, H * 0.49);

  // say what the phone will be asked for, before the ask happens
  fill(120);
  textSize(min(W, H) * 0.028);
  ct('This uses your phone\'s touch' + (motionUsable() ? ' and motion' : '') + ' sensors.',
     W / 2, H * 0.565);
  ct('Nothing is recorded, uploaded or kept.', W / 2, H * 0.605);

  button('START', W / 2, H * 0.73, min(W * 0.6, 320), 76, true);
}

function drawPlay() {
  const a = ACTIONS[sequence[stepIndex]];

  noStroke(); fill(150);
  textSize(min(W, H) * 0.033);
  ct('ACTION ' + (stepIndex + 1) + ' OF ' + sequence.length, W / 2, H * 0.11);

  fill(255);
  textSize(min(W, H) * 0.13);
  ct(a.label, W / 2, H * 0.26);

  if (a.arrow) {
    fill(200);
    textSize(min(W, H) * 0.105);
    ct(a.arrow, W / 2, H * 0.375);
  }

  fill(150);
  textSize(min(W, H) * 0.038);
  ct(a.hint, W / 2, H * 0.48);

  drawSteps();

  if (a.kind === 'motion' && !window.sensorsEnabled) {
    fill(230, 170, 60);
    textSize(min(W, H) * 0.030);
    ct('motion is off — tap the banner above', W / 2, H * 0.74);
    button('ALLOW MOTION', W / 2, H * 0.82, min(W * 0.72, 350), 60, false);
  }

  button('NEW SEQUENCE', W / 2, H * 0.93, min(W * 0.5, 240), 50, false);
}

// five slots: done, current, still to come. filled in as each action lands.
function drawSteps() {
  const n = sequence.length;
  const gap = min(54, (W * 0.8) / max(n, 1));
  const total = (n - 1) * gap;
  const y = H * 0.60;
  const R = min(17, gap * 0.34);

  for (let i = 0; i < n; i++) {
    const x = W / 2 - total / 2 + i * gap;
    noStroke();
    if (i < stepIndex) {
      fill(30, 200, 120);
      circle(x, y, R * 2);
      fill(10);
      textSize(R * 0.95);
      text('\u2713', x, y + 1);
    } else if (i === stepIndex) {
      fill(255);
      circle(x, y, R * 2.1);
      fill(20);
      textSize(R * 0.9);
      text(i + 1, x, y + 1);
    } else {
      fill(60);
      circle(x, y, R * 1.6);
    }
  }
}

function drawUnlocked() {
  frame();
  noStroke(); fill(30, 200, 120);
  textSize(min(W, H) * 0.085);
  ct('UNLOCKED', W / 2, H * 0.23);

  fill(200);
  textSize(min(W, H) * 0.036);
  ct('You performed all ' + wordNumber(STEPS) + ' actions', W / 2, H * 0.34);
  ct('on this device, in this place.', W / 2, H * 0.39);

  // the survey link element is laid over this outline in draw()
  noFill(); stroke(30, 200, 120); strokeWeight(2);
  const bw = min(W * 0.92, 460), bh = 84;
  rect(W / 2 - bw / 2, H * 0.58, bw, bh, bh / 2);

  button('LOCK AGAIN', W / 2, H * 0.80, min(W * 0.5, 220), 50, false);
}

// ------------------------------------------------------------
// the consent step: say which sensors are used and why,
// and only start once the person agrees
// ------------------------------------------------------------
function dialog() {
  const w = min(W * 0.88, 460);
  const h = min(H * 0.62, 400);
  return { x: W / 2 - w / 2, y: H / 2 - h / 2, w: w, h: h };
}

function dialogButtons() {
  const d = dialog();
  const bw = (d.w - 48) / 2;
  const by = d.y + d.h - 56;
  return {
    cancel:  { x: d.x + 16,      y: by, w: bw, h: 46 },
    confirm: { x: d.x + 32 + bw, y: by, w: bw, h: 46 }
  };
}

// which sensors will this run actually use?
function sensorsNeeded() {
  const s = [{ name: 'Touch', why: 'swipes and presses' }];
  if (sequence.indexOf('shake') !== -1) s.push({ name: 'Motion', why: 'feeling the shake' });
  return s;
}

function drawConsent() {
  noStroke(); fill(0, 0, 0, 190);
  rect(0, 0, W, H);

  const d = dialog();
  fill(28); stroke(70); strokeWeight(2);
  rect(d.x, d.y, d.w, d.h, 16);
  noStroke();

  let y = d.y + 34;
  fill(255);
  textSize(min(W, H) * 0.044);
  ct('Before you start', W / 2, y);
  y += 34;

  fill(150);
  textSize(min(W, H) * 0.030);
  ct('This demo reads your phone to check', W / 2, y); y += 19;
  ct('that the actions happen here, now.', W / 2, y); y += 30;

  textAlign(LEFT, CENTER);
  for (const s of sensorsNeeded()) {
    fill(30, 200, 120);
    circle(d.x + 32, y, 8);
    fill(230);
    textSize(min(W, H) * 0.032);
    text(s.name + ' — ' + s.why, d.x + 48, y);
    y += 25;
  }
  textAlign(CENTER, CENTER);

  y += 8;
  fill(150);
  textSize(min(W, H) * 0.027);
  ct('Nothing is recorded, uploaded or kept.', W / 2, y); y += 17;
  ct('Your browser asks once, by itself.', W / 2, y); y += 20;
  if (motionRefused) {
    fill(230, 170, 60);
    ct('Motion was refused, so shake is skipped.', W / 2, y);
  } else if (!window.sensorsEnabled) {
    fill(230, 170, 60);
    ct('Tap the banner above to allow sensors.', W / 2, y);
  }

  const b = dialogButtons();
  noStroke(); fill(30, 200, 120);
  rect(b.confirm.x, b.confirm.y, b.confirm.w, b.confirm.h, b.confirm.h / 2);
  fill(10);
  textSize(b.confirm.h * 0.38);
  text('CONTINUE', b.confirm.x + b.confirm.w / 2, b.confirm.y + b.confirm.h / 2 + 1);

  noFill(); stroke(90); strokeWeight(2);
  rect(b.cancel.x, b.cancel.y, b.cancel.w, b.cancel.h, b.cancel.h / 2);
  fill(200); noStroke();
  text('BACK', b.cancel.x + b.cancel.w / 2, b.cancel.y + b.cancel.h / 2 + 1);

  // put the alignment back: this dialog sets LEFT for the sensor list, and
  // textAlign is global, so leaving it would left-align every later screen
  textAlign(CENTER, CENTER);
}

// ------------------------------------------------------------
// the survey link, laid over the canvas when unlocked
// ------------------------------------------------------------
function layoutSurveyLink(show) {
  if (!surveyWrap) return;
  if (!show) { surveyWrap.style.display = 'none'; return; }

  const bw = min(W * 0.92, 460);
  const bh = 84;
  const cx = W / 2;
  const cy = H * 0.58 + bh / 2;

  const c = document.querySelector('canvas');
  const r = c ? c.getBoundingClientRect() : { left: 0, top: 0 };

  const el = surveyWrap.style;
  el.left = (r.left + cx - bw / 2) + 'px';
  el.top = (r.top + cy - bh / 2) + 'px';
  el.width = bw + 'px';
  el.height = bh + 'px';
  el.display = 'flex';

  surveyLink.style.fontSize = Math.round(min(bw * 0.062, 26)) + 'px';
}

// ============================================================
// little drawing helpers
// ============================================================
// Every label in this sketch goes through ct(): measure the string, then place
// it so its own centre sits on x. This does not depend on the text alignment
// state at all, which matters because p5 2.x does not keep textAlign(CENTER)
// set in setup() — it comes back as "left" at runtime, and every label then
// starts at its x instead of centring on it.
function ct(str, x, y) {
  textAlign(LEFT, CENTER);
  text(str, x - textWidth(str) / 2, y);
}

function frame() {
  noFill(); stroke(60); strokeWeight(2);
  rect(14, 14, W - 28, H - 28, 18);
}

function button(label, cx, cy, bw, bh, primary) {
  if (primary) { noStroke(); fill(30, 200, 120); }
  else         { noFill(); stroke(90); strokeWeight(2); }
  rect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2);

  let ts = bh * 0.40;
  textSize(ts);
  while (textWidth(label) > bw - 34 && ts > 8) { ts -= 1; textSize(ts); }

  fill(primary ? 10 : 200);
  noStroke();
  ct(label, cx, cy + 1);
}

function drawFeedback() {
  if (millis() > feedbackUntil || !feedback) return;
  noStroke(); fill(230, 170, 60);
  textSize(min(W, H) * 0.036);
  ct(feedback, W / 2, H * 0.965);
}

function say(msg, ms) {
  feedback = msg;
  feedbackUntil = millis() + (ms || 1400);
}

function over(p, cx, cy, bw, bh) {
  return p.x > cx - bw / 2 && p.x < cx + bw / 2 && p.y > cy - bh / 2 && p.y < cy + bh / 2;
}

function overR(p, r) {
  return p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
}

// ============================================================
// the sequence
// ============================================================
// shake is dropped when the phone has no motion sensor, or when permission was
// refused, so a run can never become impossible to finish
function motionUsable() {
  return !motionRefused && typeof DeviceMotionEvent !== 'undefined';
}

// The step count is written as a word in three places on screen, so it is
// derived from STEPS rather than typed in. Typing "five" while STEPS was 3 put
// a number on the start screen that the run then contradicted.
function wordNumber(n) {
  const w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six',
             'seven', 'eight', 'nine', 'ten'];
  return w[n] || String(n);
}

// five actions, drawn without repeats, in a freshly shuffled order each time
function buildSequence() {
  const bag = POOL.filter(a => a !== 'shake' || motionUsable());
  sequence = [];
  const n = min(STEPS, bag.length);
  for (let i = 0; i < n; i++) {
    const k = floor(random(bag.length));
    sequence.push(bag[k]);
    bag.splice(k, 1);
  }
  stepIndex = 0;
}

function currentAction() {
  return sequence.length ? sequence[stepIndex] : null;
}

function actionDone() {
  stepIndex++;
  flashGreen = 1;
  resetGesture();
  if (stepIndex >= sequence.length) state = 'unlocked';
  else say('good — next', 900);
}

function resetGesture() {
  touchStart = null;
  touchStartTime = 0;
  touchTravel = 0;
  holdStart = 0;
  shakeCrossings = [];
  lastAbove = false;
}

// ============================================================
// input — pointer
//
// p5.js 2.x unifies touch and mouse through the Pointer API, so these three
// callbacks fire for a finger and for a mouse alike. That is also the set
// p5-phone wraps once lockGestures() runs, which keeps the page from
// scrolling while a swipe is being read.
// ============================================================
function pointerPos(e) {
  if (e && typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY };
  return { x: mouseX, y: mouseY };
}

function mousePressed(e) {
  handlePress(pointerPos(e));
  return false;
}

function mouseDragged(e) {
  handleDrag(pointerPos(e));
  return false;
}

function mouseReleased(e) {
  handleRelease(pointerPos(e));
  return false;
}

function handlePress(p) {
  if (state === 'start') {
    if (over(p, W / 2, H * 0.73, min(W * 0.6, 320), 76)) {
      // ask for the sensors right here, in the same tap as START
      enablePermissionsTap(['sensors'], 'Tap to allow motion sensors');
      buildSequence();
      resetGesture();
      state = 'consent';
      return;
    }
  } else if (state === 'consent') {
    const b = dialogButtons();
    if (overR(p, b.confirm)) {
      state = 'play';
      resetGesture();
      say('perform the ' + wordNumber(STEPS) + ' actions in order', 2200);
      return;
    }
    if (overR(p, b.cancel)) { state = 'start'; return; }
    return;
  } else if (state === 'play') {
    const a = ACTIONS[currentAction()];
    if (a && a.kind === 'motion' && !window.sensorsEnabled &&
        over(p, W / 2, H * 0.82, min(W * 0.72, 350), 60)) {
      enablePermissionsTap(['sensors'], 'Tap to allow motion sensors');
      return;
    }
    if (over(p, W / 2, H * 0.93, min(W * 0.5, 240), 50)) {
      buildSequence();
      say('new sequence', 1000);
      return;
    }
  } else if (state === 'unlocked') {
    // the <a> element handles the survey tap; only LOCK AGAIN is read here
    if (over(p, W / 2, H * 0.80, min(W * 0.5, 220), 50)) {
      buildSequence();
      state = 'start';
      say('locked again', 1000);
      return;
    }
  }

  touchStart = p;
  touchStartTime = millis();
  touchTravel = 0;
  holdStart = millis();
}

function handleDrag(p) {
  if (!touchStart) return;
  touchTravel = max(touchTravel, dist(p.x, p.y, touchStart.x, touchStart.y));
}

function handleRelease(p) {
  if (state !== 'play' || !touchStart) { touchStart = null; return; }
  const a = ACTIONS[currentAction()];
  if (!a || a.kind !== 'touch') { touchStart = null; return; }

  const dx = p.x - touchStart.x;
  const dy = p.y - touchStart.y;
  const dt = millis() - touchStartTime;
  const adx = abs(dx), ady = abs(dy);

  if (a.dir) {
    if (dt <= SWIPE_MAX_TIME &&
        max(adx, ady) >= SWIPE_MIN_DIST &&
        max(adx, ady) >= SWIPE_RATIO * min(adx, ady)) {
      const got = adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (got === a.dir) { actionDone(); return; }
      say('wrong direction', 1400);
    } else {
      say('swipe further', 1200);
    }
  } else if (a.label === 'HOLD') {
    const held = millis() - holdStart;
    if (held >= HOLD_MS && touchTravel < HOLD_TOLERANCE) { actionDone(); return; }
    if (held < HOLD_MS) say('hold longer', 1200);
    else                say('you moved — hold still', 1600);
  }

  touchStart = null;
  holdStart = 0;
  touchTravel = 0;
}

// ============================================================
// input — motion
// ============================================================
// p5-phone exposes the readings; this counts threshold crossings inside a time
// window, the way Class 5 · 03 counts shakes over time. (p5-phone 1.15.3 does
// not export setShakeThreshold or deviceShaken, so the counting is here.)
function trackShake() {
  if (state !== 'play') return;
  const a = ACTIONS[currentAction()];
  if (!a || a.label !== 'SHAKE') return;
  if (!window.sensorsEnabled) return;

  const x = typeof accelerationX === 'number' ? accelerationX : 0;
  const y = typeof accelerationY === 'number' ? accelerationY : 0;
  const z = typeof accelerationZ === 'number' ? accelerationZ : 0;
  const accMag = sqrt(x * x + y * y + z * z);   // not "mag": that is a p5 function
  const above = abs(accMag - 9.81) > SHAKE_THRESHOLD;

  if (above && !lastAbove) shakeCrossings.push(millis());
  lastAbove = above;

  const cutoff = millis() - SHAKE_WINDOW_MS;
  shakeCrossings = shakeCrossings.filter(t => t > cutoff);

  if (shakeCrossings.length >= SHAKE_MIN_COUNT) actionDone();
}

function trackHold() {
  if (state !== 'play') return;
  const a = ACTIONS[currentAction()];
  if (!a || a.label !== 'HOLD' || !touchStart) return;

  const t = constrain((millis() - holdStart) / HOLD_MS, 0, 1);
  noFill(); stroke(30, 200, 120); strokeWeight(6);
  arc(W / 2, H * 0.70, 90, 90, -HALF_PI, -HALF_PI + t * TWO_PI);
}
