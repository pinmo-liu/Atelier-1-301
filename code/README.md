# Locked Survey — Phase 1 Project Demo

A p5.js sketch, built the same way as the class examples.

**The survey is locked. To unlock it, the person holding the phone must perform
a randomly generated sequence of physical actions.** Each action is checked live
against the phone's own sensors.

The one relation this tests:

> **random action instructions → unlock access to the survey**

Built with **p5.js 2.x + p5-phone**, the same stack as
[Atelier 1 Examples](https://digitalfuturesocadu.github.io/f26-atelier1-examples/)
(Fall 2026).

---

## Files

| File | What it is |
|---|---|
| `sketch.js` | the whole sketch |
| `index.html` | loads p5.js 2.x and p5-phone, then `sketch.js` |

The deployed sketch runs on the p5.js Web Editor:
https://editor.p5js.org/pinmo-liu/sketches/yFXMcohUX

---

## p5-phone functions used

| Call | What it does here |
|---|---|
| `lockGestures()` | a drag is input, never a page scroll or a pinch zoom |
| `showDesktopQr()` | on a laptop, shows the library's own QR code so the page can be opened on a phone |
| `enablePermissionsBanner(['sensors'], msg)` | the library's sensor permission prompt. A banner, not a blocking overlay, so this sketch can show its own consent step first |
| `enablePermissionsTap(['sensors'], msg)` | re-asks after a refusal, from the play screen |
| `sensorsEnabled` | did the permission tap succeed |
| `accelerationX / Y / Z` | the shake reading |
| `rotationX / rotationY` | available if you want a tilt gesture later |

`setShakeThreshold()` and `deviceShaken()` appear in the Class 3 and Class 5
examples but **are not exported by p5-phone 1.15.3** — they are `undefined` at
runtime. This sketch therefore counts threshold crossings itself from
`accelerationX/Y/Z`, inside a time window, the way Class 5 · 03 counts shakes
over time.

---

## The flow

```
SURVEY LOCKED  ──START──▶  "Before you start"  ──CONTINUE──▶  ACTION 1/3 …
                                 │                                  │
                              BACK                              all done
                                 │                                  ▼
                             start screen                      UNLOCKED
                                                               └ OPEN THE SURVEY
```

Two things tell the person what will be read, at two different moments:

1. **This sketch's consent dialog**, before anything starts. It lists the
   sensors this particular run needs and says nothing is recorded or kept.
   Nothing begins until CONTINUE is pressed.
2. **p5-phone's permission banner**, which asks the browser for the sensor
   permission on tap.

---

## The survey link

The survey is already set in `sketch.js`:

```js
let SURVEY_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd22KkCZR0jDiyfum09XB0sS4w4hgihSKz1L37KR1a0BJR4vw/viewform';
```

Any survey URL works. The point of the demo is the **unlock**, not the survey.

**Optional tuning** (same block):

```js
const STEPS = 5;   // actions per run
```

---

## Put it on the p5.js Web Editor

The editor injects its own copy of p5, so `index.html` there does **not** need
the p5 script tag — but it **does** need p5-phone:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Locked Survey</title>
    <style>
      body { margin: 0; padding: 0; overflow: hidden; background: #141414; }
      canvas { touch-action: none; }
    </style>
    <!-- p5 is injected by the Web Editor; do not add a script tag for it -->
    <script src="https://cdn.jsdelivr.net/npm/p5-phone@1.15.3/dist/p5-phone.min.js"></script>
  </head>
  <body>
    <!-- sketch.js is injected by the Web Editor -->
  </body>
</html>
```

Then paste `sketch.js` into the editor's `sketch.js`. **Run it on a laptop
first** — the consent dialog and the unlock should both work with a mouse.

---

## Get a link other phones can open

A phone on the classroom wifi **cannot reach** `localhost` or `127.0.0.1`, so
you need a real public URL.

- **p5.js Web Editor → Share.** The presentation view gives a public URL and the
  sketch stays interactive. Test it on your phone before you rely on it.
- Any static host (GitHub Pages, Netlify drop, Vercel) with these files.
- A tunnel (ngrok / cloudflared) if you self-host.

**HTTPS is required** for the motion sensors.

Once you have the URL, `make-qr.html` renders it as a QR image for the PDF —
edit the URL at the top, or append `?u=<your-url>`.

---

## How it behaves

| Screen | What happens |
|---|---|
| **SURVEY LOCKED** | the START button |
| **Before you start** | lists the sensors, BACK / CONTINUE |
| **ACTION 1/3 …** | one random action at a time, with progress dots |
| **UNLOCKED** | OPEN THE SURVEY, LOCK AGAIN |

| Action | How it is detected | Needs permission |
|---|---|---|
| `swipe-right / left / up / down` | touch direction and distance | no |
| `hold` | press and stay still for ~1.8 s | no |
| `shake` | acceleration magnitude above a threshold, N times in a window | **yes** |

A NEW SEQUENCE button reshuffles if someone gets stuck. If motion is refused,
or the device has no motion sensor, **shake is dropped from the pool** so a run
can never become impossible to finish.

---

## Things I hit while building this

**p5.js 2.x unifies touch and mouse through the Pointer API.** Only
`mousePressed / mouseDragged / mouseReleased` fire; `touchStarted` and friends
are ignored. p5-phone's own comment says so, and it only wraps the mouse
callbacks on 2.x. Every pointer handler here is one of those three, and
coordinates are read from the event's `clientX / clientY` (CSS pixels, which is
what the canvas uses) with `mouseX / mouseY` as the fallback.

**`mag` is a p5 function.** Naming a local variable `mag` makes p5 warn about a
redeclaration. It is `accMag` here.

**The library warns "assign touch/mouse handlers before `lockGestures()`".**
p5-phone saves the handlers that exist at the moment it runs and wraps them. This
sketch declares them at the top level, before `setup()` calls `lockGestures()`,
so the wrap is correct.

**I first hand-rolled a QR encoder, and it was wrong.** It produced matrices that
my own reader decoded happily — so it looked correct — but that zxing-cpp
refused, while accepting python-qrcode's output for the same string at the same
scale. Encoder and reader shared the same wrong assumption, so testing one
against the other proved nothing. That is moot now: `showDesktopQr()` from
p5-phone does the QR, and `make-qr.html` builds the PDF image with
`qrcode-generator`.

**Voice was left out on purpose.** `getUserMedia` needs HTTPS, an explicit
prompt and a quiet room. Too fragile for a live demo.

---

## What was verified, and what was not

Loaded in a headless Chrome at a 390 × 844 phone viewport with a device pixel
ratio of 2, with software WebGL:

- p5 **2.2.3** and p5-phone both load; `gesturesLocked` is true
- the canvas is created at 780 × 1688; no console errors
- START opens the consent dialog
- CONTINUE enters play
- the random sequence is generated, and differs on each run
- swipe right → step 1, hold → step 2 advance correctly
- **motion is unavailable in a headless browser**, so a run containing `shake`
  cannot be finished there — that is expected, not a fault
- the consent dialog and the permission banner render correctly

**Not verified: the `shake` detector and the real permission prompt**, because
neither exists in a headless browser. **Test both on your own phone before the
demo**, and on a friend's phone if you can. Even if motion misbehaves on the
day, `swipe` and `hold` carry the mechanic on their own.
