# Plan V1 — Phone as a Key (group version)

**Goal.** By Playtest 1 on November 12, a real group of four or more can go
through the whole relation in front of themselves, without me explaining it.

## The relation being built

One person verifies an action sequence on their own phone. Only when that
verification completes does the tablet release the next QR code, and only the
person holding that code can start. The waiting watch the screen. The host
releases the turn. The passed leave.

## Slices

| Week of | Slice | What becomes testable | Done when |
|---|---|---|---|
| Nov 3 | Completing a sequence generates a QR carrying the next sequence | Two people can pass the turn with one code | A finishes; B scans and receives a *different* sequence and finishes it |
| Nov 5 | Tablet shows three states: idle / verifying / verified + new QR | Whether the screen alone says what is happening | Without explanation, a waiting person can say "someone is inside" |
| Nov 10 | Add the host and one waiting person | Whether being watched changes how the holder performs | Watched vs unwatched runs show an observable difference in time, retries, or abandonments |
| Nov 12 | Playtest 1 with a real group | Whether the core relation holds | Three or more comparable runs, plus participants' own accounts |

## Risk order

1. **Highest — is the pressure observable at all?** If nobody feels watched,
   the concept collapses. This is why the host and one waiting person are added
   on Nov 10, two days before the test, and not on the day.
2. **Medium — does the state event survive a real room?** WiFi drops are likely.
   Fallback: the host announces the state out loud and taps the tablet.
3. **Low — the QR carrying the sequence.** It is a URL parameter. Nothing to
   break.

## What this plan does not depend on

- Shared state across phones, arriving in class the week before this is due —
  this plan uses a local socket between tablet and phones instead.
- Connecting to hardware, arriving the morning this is due — not used.
- 3D and AR, arriving two days after — not used.
- Persistence, arriving the week after — not used.

Playtest 1 therefore cannot be blocked by the course timeline.

## Minimal technology

- One value moves between devices: a `verified` event, phone to tablet.
- The QR code needs no connection at all; the sequence lives inside its URL.
- No server, no database, no camera, no ML, no AR, no Bluetooth.

## Approved by

Student review, November 2026. Slices reduced from the generated draft:
the initial version included a second role view and an explanation-free entry
test in the same week, which was more than the testing time allows.
