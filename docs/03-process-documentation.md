# Process documentation (draft — you must rewrite in your own words)

The prototype was developed in short loops: I described what I wanted, DeepSeek generated the p5.js code, and I tested each version on my phone before changing it again.

The code was written in a vibe-coding loop: I described each change in plain English, the assistant wrote the p5.js, and I tested it on my phone until the gestures felt right. What stayed mine was the design — the lock metaphor, the shake-swipe-hold actions, the step count, and the decision to put it on a public terminal. When the tester said three steps ended too soon, that was a human call, not something the model suggested.

The first version used p5.js 1.9 and hand-written sensor code, and because I had not checked the course requirements, the assistant also generated a QR code that was not needed. The second version was rewritten around the course library, p5.js 2.x with p5-phone, which handles the sensor permission and gestures. After testing, I raised the sequence from three actions to five, moved the sensor request to the start, and turned the survey button into a real link. The last pass fixed the bugs the phone revealed: the scaling, the text alignment, and the step count written out in words.
