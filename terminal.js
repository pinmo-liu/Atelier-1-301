// ============================================================
// terminal.js — the tablet page for Phone as a Key
//
// The terminal does one job: it holds the turn.
// It generates a random action sequence, puts that sequence inside the QR
// code's URL, and shows what is happening right now (idle / verifying /
// verified). The phone that scans the code receives the sequence, so the
// person performing does not choose their own actions.
//
// No network. No server. The sequence travels inside the URL.
// The only thing kept is a daily count, in localStorage, with the same
// forgetting rule as the phone: after FORGET_HOURS it is gone.
// ============================================================

// ---------- what the terminal can ask for ----------
const POOL = ['shake', 'swipe-right', 'swipe-left', 'swipe-up', 'swipe-down', 'hold'];
const SEQ_MIN = 3;
const SEQ_MAX = 5;

const LABEL = {
  'shake': 'SHAKE',
  'swipe-right': 'SWIPE →',
  'swipe-left': 'SWIPE ←',
  'swipe-up': 'SWIPE ↑',
  'swipe-down': 'SWIPE ↓',
  'hold': 'HOLD'
};

// ---------- memory (Level 2, this tablet only) ----------
const COUNT_KEY = 'phoneAsKey.terminal.v1';
const FORGET_HOURS = 24;
const KEEP_RECENT = 5;        // show the last few turn durations

// ---------- the code expires ----------
// A code that lives forever can be photographed and passed around. Thirty
// seconds makes it a turn, not a poster: you have to be here to use it.
const QR_TTL_SECONDS = 30;
let qrExpiresAt = 0;

// ---------- state ----------
let phase = 'idle';           // idle | verifying | verified
let sequence = [];
let turnStartedAt = 0;
let memory = { count: 0, finished: 0, since: Date.now(), recent: [] };

// ---------- elements ----------
const elPhase = document.getElementById('phase');
const elCount = document.getElementById('count');
const elBar = document.getElementById('bar');
const elQr = document.getElementById('qr');
const elSeq = document.getElementById('sequence');
const elAction = document.getElementById('action');
const elAction2 = document.getElementById('action2');
const elHint = document.getElementById('hint');

// ============================================================
// memory
// ============================================================
function loadMemory() {
  try {
    const raw = localStorage.getItem(COUNT_KEY);
    if (!raw) return { count: 0, finished: 0, since: Date.now(), recent: [] };
    const m = JSON.parse(raw);
    // forgetting rule: a day's group is only that day's group
    if (!m.since || Date.now() - m.since > FORGET_HOURS * 3600 * 1000) {
      return { count: 0, finished: 0, since: Date.now(), recent: [] };
    }
    return { count: m.count || 0, finished: m.finished || 0, since: m.since, recent: m.recent || [] };
  } catch (e) {
    return { count: 0, finished: 0, since: Date.now(), recent: [] };
  }
}

function saveMemory() {
  try { localStorage.setItem(COUNT_KEY, JSON.stringify(memory)); } catch (e) { }
}

function hoursLeft() {
  const left = (memory.since + FORGET_HOURS * 3600 * 1000 - Date.now()) / 3600000;
  return Math.max(0, Math.min(FORGET_HOURS, left));
}

// ============================================================
// sequence + QR
// ============================================================
function makeSequence() {
  const bag = POOL.slice();
  const n = SEQ_MIN + Math.floor(Math.random() * (SEQ_MAX - SEQ_MIN + 1));
  const out = [];
  for (let i = 0; i < n && bag.length; i++) {
    const k = Math.floor(Math.random() * bag.length);
    out.push(bag[k]);
    bag.splice(k, 1);
  }
  return out;
}

// The phone page lives next to this one. The sequence rides in the query.
function phoneUrl(seq) {
  const base = location.href.split('?')[0].replace(/terminal\.html$/i, 'index.html');
  return base + '?seq=' + seq.join(',') + '&from=terminal';
}

function renderQr() {
  if (typeof qrcode !== 'function') {
    elQr.textContent = 'QR library missing (no internet?)';
    return;
  }
  const url = phoneUrl(sequence);
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  elQr.innerHTML = qr.createImgTag(9, 4);
  // keep the encoded URL visible to the page itself, for checking and for
  // printing the link under the code if the room needs it
  const img = elQr.querySelector('img');
  if (img) img.title = url;
  window.__terminalUrl = url;
}

// ============================================================
// render
// ============================================================
function pad2(n) { return (n < 10 ? '0' : '') + n; }

function humanSeq(seq) {
  return seq.map(a => LABEL[a] || a).join('  ·  ');
}

function render() {
  document.body.dataset.phase = phase;

  // count + forget bar
  const passed = memory.count;
  const done = memory.finished;
  if (passed === 0) {
    elCount.textContent = 'no one has passed yet today';
  } else {
    elCount.innerHTML =
      '<b>' + passed + '</b> passed &nbsp;·&nbsp; <b>' + done + '</b> survey done';
  }

  const ratio = hoursLeft() / FORGET_HOURS;
  elBar.style.width = (ratio * 100).toFixed(1) + '%';

  if (phase === 'idle') {
    elPhase.textContent = 'READY';
    elSeq.textContent = '';
    elAction.textContent = 'START VERIFYING';
    renderQr();
    updateTtl();
  } else if (phase === 'verifying') {
    elPhase.textContent = 'VERIFYING';
    elSeq.textContent = humanSeq(sequence);
    elHint.textContent = 'The person is performing this sequence on their phone.';
    elAction.textContent = 'MARK VERIFIED';
    elQr.innerHTML = '';
    elQr.textContent = '···';
  } else {
    elPhase.textContent = 'VERIFIED';
    elSeq.textContent = '';
    elHint.textContent = 'Did they finish the survey? Count it, or move on.';
    elAction.textContent = 'SURVEY DONE';
    elAction2.style.display = 'inline-block';
    elQr.innerHTML = '';
    elQr.textContent = '✓';
  }
  if (phase !== 'verified') elAction2.style.display = 'none';
}

// the countdown under the code, in seconds
function updateTtl() {
  if (phase !== 'idle') return;
  const left = Math.max(0, Math.ceil((qrExpiresAt - Date.now()) / 1000));
  elHint.textContent = left > 0
    ? 'New code in ' + left + ' s · scan it with your own phone'
    : 'Renewing the code…';
}

// Called every second. Only the idle screen renews.
function tickQr() {
  if (phase !== 'idle') return;
  if (Date.now() >= qrExpiresAt) {
    issueNewCode();
  } else {
    updateTtl();
  }
}

// fresh sequence + a fresh expiry
function issueNewCode() {
  sequence = makeSequence();
  qrExpiresAt = Date.now() + QR_TTL_SECONDS * 1000;
  renderQr();
  updateTtl();
}

// ============================================================
// the turn
// ============================================================
function nextTurn() {
  phase = 'idle';
  issueNewCode();      // new sequence + new 30 s window
  render();
}

// countSurvey: true when the host confirms the survey was actually finished
function advance(countSurvey) {
  if (phase === 'idle') {
    phase = 'verifying';
    turnStartedAt = Date.now();
    render();
  } else if (phase === 'verifying') {
    const secs = Math.max(1, Math.round((Date.now() - turnStartedAt) / 1000));
    memory.count += 1;                       // passed the verification
    memory.recent.push(secs);
    if (memory.recent.length > KEEP_RECENT) memory.recent = memory.recent.slice(-KEEP_RECENT);
    saveMemory();
    phase = 'verified';
    render();
  } else {
    // verified -> next turn; only count the survey when asked
    if (countSurvey) {
      memory.finished += 1;
      saveMemory();
    }
    nextTurn();
  }
}

// host taps a button. Verified offers two: count the survey, or skip it.
elAction.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  advance(true);
});
elAction2.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  advance(false);
});

// tapping empty space moves the turn forward too, but never counts a survey
document.body.addEventListener('pointerdown', () => advance(false));
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(false); }
});

// ---------- boot ----------
memory = loadMemory();
if (!memory.since) memory.since = Date.now();
qrExpiresAt = Date.now() + QR_TTL_SECONDS * 1000;
sequence = makeSequence();
render();

// renew the code while the screen is idle; the countdown ticks every second
setInterval(tickQr, 1000);

// keep the forget bar honest without a full re-render
setInterval(() => {
  const bar = document.getElementById('bar');
  if (bar) bar.style.width = ((hoursLeft() / FORGET_HOURS) * 100).toFixed(1) + '%';
}, 30000);
